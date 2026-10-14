#!/usr/bin/env python3
"""
ClassIQ classroom agent (Raspberry Pi 5 + USB microphone).

Records lecture audio when the teacher presses "Start class", buffers it on
disk in 60-second raw PCM chunks and uploads them to the ClassIQ API with
resumable, checksummed, idempotent uploads. All traffic is outbound HTTPS.

Device contract: packages/shared/src/devices.ts
  POST /api/devices/register                       -> { deviceKey }
  POST /api/devices/me/heartbeat
  GET  /api/devices/me/commands?wait=25            (long-poll)
  POST /api/devices/me/commands/:id/ack
  GET  /api/devices/me/sessions/:id/chunks         -> { received: [...] }
  PUT  /api/devices/me/sessions/:id/chunks/:idx    (raw s16le, X-Chunk-SHA256)
  POST /api/devices/me/sessions/:id/finalize       { totalChunks, durationSec }

Threads: heartbeat, command long-poller, recorder (+ audio source), uploader.

Python 3.11+ standard library only (the Pi has no pip).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import random
import re
import shutil
import signal
import ssl
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
import wave
from dataclasses import dataclass, field
from http.client import HTTPException
from pathlib import Path
from typing import Any, Callable, Iterable

AGENT_VERSION = "2.0.0"

SAMPLE_RATE = 16000
CHANNELS = 1
SAMPLE_WIDTH = 2  # s16le
BYTES_PER_SEC = SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH  # 32000
MAX_CHUNK_BYTES = BYTES_PER_SEC * 60  # server limit (DEVICE_CHUNK_MAX_BYTES)
MAX_CHUNKS_PER_SESSION = 6 * 60
TERMINAL_STATUSES = {"finalized", "failed", "cancelled"}
UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
DEVICE_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{2,63}$")

DEFAULT_CONFIG_PATH = "/etc/classpulse/agent.json"
# Credentials and classroom audio are readable by the agent's own user only.
PRIVATE_DIR_MODE = 0o700
PRIVATE_FILE_MODE = 0o600

log = logging.getLogger("classpulse-agent")


# ---------------------------------------------------------------------------
# Logging (one key=value line per event; journald adds timestamps)
# ---------------------------------------------------------------------------


class KeyValueFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        parts = [f"level={record.levelname.lower()}", f"thread={record.threadName}", f"msg={json.dumps(record.getMessage())}"]
        fields = getattr(record, "fields", None)
        if fields:
            parts.extend(f"{k}={json.dumps(v, default=str)}" for k, v in fields.items())
        if record.exc_info:
            parts.append(f"exc={json.dumps(self.formatException(record.exc_info))}")
        return " ".join(parts)


def setup_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(KeyValueFormatter())
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level.upper())


def _log(level: int, msg: str, **fields: Any) -> None:
    log.log(level, msg, extra={"fields": fields} if fields else None)


def info(msg: str, **fields: Any) -> None:
    _log(logging.INFO, msg, **fields)


def warn(msg: str, **fields: Any) -> None:
    _log(logging.WARNING, msg, **fields)


def error(msg: str, **fields: Any) -> None:
    _log(logging.ERROR, msg, **fields)


# ---------------------------------------------------------------------------
# Configuration & credentials
# ---------------------------------------------------------------------------


class ConfigError(Exception):
    pass


@dataclass
class Config:
    server_url: str
    device_id: str
    enrollment_token: str | None = None
    alsa_device: str = "default"
    chunk_seconds: int = 60
    heartbeat_interval_sec: int = 30
    data_dir: str = "/var/lib/classpulse"
    min_free_disk_mb: int = 500
    allow_insecure_http: bool = False
    # Extra CA bundle (PEM) to trust, e.g. a school's private CA. System CAs are always trusted.
    ca_file: str | None = None
    audio_source: dict[str, Any] = field(default_factory=lambda: {"type": "arecord"})
    log_level: str = "INFO"

    @property
    def chunk_bytes(self) -> int:
        return self.chunk_seconds * BYTES_PER_SEC

    @staticmethod
    def from_dict(raw: dict[str, Any]) -> "Config":
        known = {f for f in Config.__dataclass_fields__}  # type: ignore[attr-defined]
        unknown = set(raw) - known
        if unknown:
            warn("Ignoring unknown config keys", keys=sorted(unknown))
        try:
            cfg = Config(**{k: v for k, v in raw.items() if k in known})
        except TypeError as exc:
            raise ConfigError(f"Missing required config: {exc}") from exc
        cfg.validate()
        return cfg

    def validate(self) -> None:
        self.server_url = str(self.server_url).rstrip("/")
        if self.server_url.startswith("http://"):
            if not self.allow_insecure_http:
                raise ConfigError("server_url must use https:// (set allow_insecure_http only for local development)")
        elif not self.server_url.startswith("https://"):
            raise ConfigError("server_url must start with https://")
        if not DEVICE_ID_RE.match(self.device_id or ""):
            raise ConfigError("device_id must be 3-64 chars: lowercase letters, digits and dashes")
        if not 1 <= int(self.chunk_seconds) <= 60:
            raise ConfigError("chunk_seconds must be between 1 and 60")
        if int(self.heartbeat_interval_sec) < 5:
            raise ConfigError("heartbeat_interval_sec must be at least 5")
        src_type = (self.audio_source or {}).get("type")
        if src_type not in ("arecord", "file"):
            raise ConfigError('audio_source.type must be "arecord" or "file"')
        if src_type == "file" and not self.audio_source.get("path"):
            raise ConfigError("audio_source.path is required for the file source")


def load_config(path: str) -> Config:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            raw = json.load(fh)
    except FileNotFoundError as exc:
        raise ConfigError(f"Config file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ConfigError(f"Config file is not valid JSON: {exc}") from exc
    if not isinstance(raw, dict):
        raise ConfigError("Config must be a JSON object")
    return Config.from_dict(raw)


def ensure_private_dir(path: Path) -> Path:
    """Create a directory (and parents) owner-only, and tighten it if it already exists with a looser mode."""
    path.mkdir(mode=PRIVATE_DIR_MODE, parents=True, exist_ok=True)
    try:
        if path.stat().st_mode & 0o077:
            os.chmod(path, PRIVATE_DIR_MODE)
    except OSError:  # not ours (e.g. a path owned by root in tests): leave it
        pass
    return path


def write_json_atomic(path: Path, data: Any, mode: int | None = None) -> None:
    tmp = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, mode if mode is not None else PRIVATE_FILE_MODE)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, sort_keys=True)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    finally:
        if tmp.exists():
            tmp.unlink()


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


@dataclass
class Credentials:
    device_id: str
    device_key: str
    token_sha256: str | None = None

    @staticmethod
    def path(data_dir: str) -> Path:
        return Path(data_dir) / "credentials.json"

    @staticmethod
    def load(data_dir: str) -> "Credentials | None":
        p = Credentials.path(data_dir)
        if not p.exists():
            return None
        with open(p, "r", encoding="utf-8") as fh:
            raw = json.load(fh)
        return Credentials(raw["device_id"], raw["device_key"], raw.get("token_sha256"))

    def save(self, data_dir: str) -> None:
        p = Credentials.path(data_dir)
        ensure_private_dir(p.parent)
        write_json_atomic(
            p,
            {"device_id": self.device_id, "device_key": self.device_key, "token_sha256": self.token_sha256},
            mode=0o600,
        )
        os.chmod(p, 0o600)


# ---------------------------------------------------------------------------
# HTTP client
# ---------------------------------------------------------------------------


class TransientError(Exception):
    """Network problem: retry later."""


class RedirectRefused(TransientError):
    """The server answered with a redirect. Never followed: it would carry the device key to another URL."""


class _RefuseRedirects(urllib.request.HTTPRedirectHandler):
    """urllib's default handler re-sends every request header (including X-Device-Key) to the redirect
    target, which could be another host or plain HTTP. The agent talks to one fixed server_url, so any
    redirect means a misconfiguration (http:// instead of https://, wrong path) or an attack: refuse it."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[override]
        try:
            fp.close()
        except Exception:  # noqa: BLE001 - best effort
            pass
        raise RedirectRefused(
            f"{req.get_method()} {req.full_url}: server answered HTTP {code} redirect to {newurl!r}; refused "
            "(check server_url: it must be the exact https:// address of ClassIQ)"
        )


class ApiError(Exception):
    def __init__(self, status: int, body: Any):
        self.status = status
        self.body = body if isinstance(body, dict) else {}
        err = self.body.get("error") or {}
        self.code = err.get("code")
        self.details = err.get("details")
        super().__init__(f"HTTP {status} {self.code or ''} {err.get('message', '')}".strip())

    @property
    def retryable(self) -> bool:
        return self.status >= 500 or self.status in (408, 429)


class Api:
    def __init__(
        self,
        base_url: str,
        device_id: str,
        device_key: str | None = None,
        timeout: float = 30.0,
        ca_file: str | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.device_id = device_id
        self.device_key = device_key
        self.timeout = timeout
        # TLS verification with the system CA store (never disabled), plus an optional private CA.
        self._ssl = ssl.create_default_context()
        if ca_file:
            self._ssl.load_verify_locations(cafile=ca_file)
        # Same TLS settings as urlopen(context=...), but redirects raise instead of being followed.
        self._opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=self._ssl), _RefuseRedirects())

    def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: Any = None,
        data: bytes | None = None,
        headers: dict[str, str] | None = None,
        timeout: float | None = None,
        auth: bool = True,
    ) -> Any:
        hdrs = {"User-Agent": f"classpulse-agent/{AGENT_VERSION}", "Accept": "application/json"}
        if json_body is not None:
            data = json.dumps(json_body).encode("utf-8")
            hdrs["Content-Type"] = "application/json"
        if auth:
            if not self.device_key:
                raise RuntimeError("Device is not registered")
            hdrs["X-Device-Id"] = self.device_id
            hdrs["X-Device-Key"] = self.device_key
        hdrs.update(headers or {})
        req = urllib.request.Request(self.base_url + path, data=data, method=method, headers=hdrs)
        try:
            with self._opener.open(req, timeout=timeout or self.timeout) as resp:
                raw = resp.read()
        except urllib.error.HTTPError as exc:
            try:
                body = json.loads(exc.read() or b"{}")
            except (ValueError, OSError):
                body = {}
            raise ApiError(exc.code, body) from None
        except (urllib.error.URLError, OSError, HTTPException, TimeoutError) as exc:
            raise TransientError(f"{method} {path}: {exc}") from None
        if not raw:
            return None
        try:
            return json.loads(raw)
        except ValueError:
            return None

    # -- endpoints ---------------------------------------------------------

    def register(self, enrollment_token: str) -> dict[str, Any]:
        return self._request(
            "POST",
            "/api/devices/register",
            json_body={"enrollmentToken": enrollment_token, "deviceId": self.device_id, "agentVersion": AGENT_VERSION},
            auth=False,
        )

    def heartbeat(self, payload: dict[str, Any]) -> Any:
        return self._request("POST", "/api/devices/me/heartbeat", json_body=payload)

    def poll_command(self, wait: int) -> dict[str, Any] | None:
        res = self._request("GET", f"/api/devices/me/commands?wait={int(wait)}", timeout=wait + 15)
        return (res or {}).get("command")

    def ack(self, command_id: str, ok: bool, err: str | None = None) -> None:
        self._request("POST", f"/api/devices/me/commands/{command_id}/ack", json_body={"ok": ok, "error": err})

    def received_chunks(self, session_id: str) -> tuple[list[int], str | None]:
        res = self._request("GET", f"/api/devices/me/sessions/{session_id}/chunks") or {}
        return [int(i) for i in res.get("received", [])], res.get("status")

    def put_chunk(self, session_id: str, idx: int, data: bytes, sha: str) -> None:
        self._request(
            "PUT",
            f"/api/devices/me/sessions/{session_id}/chunks/{idx}",
            data=data,
            headers={"Content-Type": "application/octet-stream", "X-Chunk-SHA256": sha},
            timeout=120,
        )

    def finalize(self, session_id: str, total_chunks: int, duration_sec: float) -> Any:
        return self._request(
            "POST",
            f"/api/devices/me/sessions/{session_id}/finalize",
            json_body={"totalChunks": total_chunks, "durationSec": round(duration_sec, 3)},
            timeout=600,
        )


class Backoff:
    """Exponential backoff with jitter: base * 2^n capped, scaled by a random factor in [0.5, 1]."""

    def __init__(self, base: float = 1.0, cap: float = 300.0, rng: random.Random | None = None):
        self.base = base
        self.cap = cap
        self.attempt = 0
        self._rng = rng or random.Random()

    def next_delay(self) -> float:
        delay = min(self.cap, self.base * (2 ** self.attempt))
        self.attempt = min(self.attempt + 1, 30)
        return delay * self._rng.uniform(0.5, 1.0)

    def reset(self) -> None:
        self.attempt = 0


# ---------------------------------------------------------------------------
# On-disk buffer: <data_dir>/buffer/<sessionId>/{manifest.json, 00000.pcm, ...}
# ---------------------------------------------------------------------------


class Buffer:
    def __init__(self, data_dir: str):
        ensure_private_dir(Path(data_dir))
        self.root = ensure_private_dir(Path(data_dir) / "buffer")
        self._lock = threading.RLock()
        self.changed = threading.Event()

    def _dir(self, session_id: str) -> Path:
        if not UUID_RE.match(session_id):
            raise ValueError(f"invalid session id {session_id!r}")
        return self.root / session_id.lower()

    def _manifest_path(self, session_id: str) -> Path:
        return self._dir(session_id) / "manifest.json"

    def _save(self, session_id: str, m: dict[str, Any]) -> None:
        write_json_atomic(self._manifest_path(session_id), m)

    def manifest(self, session_id: str) -> dict[str, Any] | None:
        with self._lock:
            p = self._manifest_path(session_id)
            if not p.exists():
                return None
            with open(p, "r", encoding="utf-8") as fh:
                return json.load(fh)

    def create_session(self, session_id: str, lesson_id: str | None) -> dict[str, Any]:
        with self._lock:
            existing = self.manifest(session_id)
            if existing:
                return existing
            ensure_private_dir(self._dir(session_id))
            m = {
                "sessionId": session_id.lower(),
                "lessonId": lesson_id,
                "createdAt": time.time(),
                "stopped": False,
                "nextIdx": 0,
                "totalBytes": 0,
                "chunks": {},  # idx -> {sha256, bytes}
                "uploaded": [],
            }
            self._save(session_id, m)
            return m

    def write_chunk(self, session_id: str, idx: int, data: bytes) -> str:
        if len(data) == 0 or len(data) % 2 or len(data) > MAX_CHUNK_BYTES:
            raise ValueError(f"bad chunk length {len(data)}")
        sha = sha256_hex(data)
        with self._lock:
            m = self.manifest(session_id)
            if m is None:
                raise KeyError(session_id)
            path = self._dir(session_id) / f"{idx:05d}.pcm"
            tmp = path.with_suffix(".pcm.tmp")
            fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, PRIVATE_FILE_MODE)
            with os.fdopen(fd, "wb") as fh:
                fh.write(data)
                fh.flush()
                os.fsync(fh.fileno())
            os.replace(tmp, path)
            m["chunks"][str(idx)] = {"sha256": sha, "bytes": len(data)}
            m["nextIdx"] = max(m["nextIdx"], idx + 1)
            m["totalBytes"] = sum(c["bytes"] for c in m["chunks"].values())
            self._save(session_id, m)
        self.changed.set()
        return sha

    def read_chunk(self, session_id: str, idx: int) -> bytes:
        with open(self._dir(session_id) / f"{idx:05d}.pcm", "rb") as fh:
            return fh.read()

    def pending_chunks(self, session_id: str) -> list[int]:
        m = self.manifest(session_id)
        if not m:
            return []
        uploaded = set(m["uploaded"])
        return sorted(int(i) for i in m["chunks"] if int(i) not in uploaded)

    def mark_uploaded(self, session_id: str, idx: int) -> None:
        """Only called after the server confirmed the chunk (2xx or listed as received)."""
        with self._lock:
            m = self.manifest(session_id)
            if not m:
                return
            if idx not in m["uploaded"]:
                m["uploaded"].append(idx)
                m["uploaded"].sort()
                self._save(session_id, m)
            try:
                (self._dir(session_id) / f"{idx:05d}.pcm").unlink()
            except FileNotFoundError:
                pass

    def mark_stopped(self, session_id: str) -> None:
        with self._lock:
            m = self.manifest(session_id)
            if not m or m["stopped"]:
                return
            m["stopped"] = True
            m["stoppedAt"] = time.time()
            self._save(session_id, m)
        self.changed.set()

    def remove(self, session_id: str) -> None:
        with self._lock:
            shutil.rmtree(self._dir(session_id), ignore_errors=True)

    def sessions(self) -> list[str]:
        out = []
        with self._lock:
            for d in self.root.iterdir():
                if d.is_dir() and UUID_RE.match(d.name) and (d / "manifest.json").exists():
                    out.append(d.name)
        return sorted(out, key=lambda s: (self.manifest(s) or {}).get("createdAt", 0))

    def backlog(self) -> int:
        return sum(len(self.pending_chunks(s)) for s in self.sessions())


# ---------------------------------------------------------------------------
# Audio sources
# ---------------------------------------------------------------------------


class SourceError(Exception):
    pass


class AudioSource:
    """Yields raw s16le/16 kHz/mono bytes. `read` returns b"" at end of stream."""

    def open(self) -> None: ...

    def read(self, n: int) -> bytes:
        raise NotImplementedError

    def close(self) -> None: ...

    #: True when the source ended because the input is finished (file), not because it failed.
    exhausted = False


class ArecordSource(AudioSource):
    def __init__(self, device: str):
        self.device = device
        self.proc: subprocess.Popen[bytes] | None = None

    def open(self) -> None:
        cmd = ["arecord", "-q", "-D", self.device, "-f", "S16_LE", "-r", str(SAMPLE_RATE), "-c", str(CHANNELS), "-t", "raw"]
        try:
            self.proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except OSError as exc:
            raise SourceError(f"cannot start arecord: {exc}") from exc

    def read(self, n: int) -> bytes:
        assert self.proc and self.proc.stdout
        data = self.proc.stdout.read(n)
        if not data:
            err = b""
            if self.proc.stderr:
                try:
                    err = self.proc.stderr.read(2000) or b""
                except OSError:
                    pass
            code = self.proc.poll()
            raise SourceError(f"arecord stopped (exit {code}): {err.decode(errors='replace').strip()[:300]}")
        return data

    def close(self) -> None:
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        self.proc = None


class FileSource(AudioSource):
    """Feeds a 16 kHz mono 16-bit WAV file (CI / end-to-end tests), optionally at real-time pace."""

    def __init__(self, path: str, realtime: bool = True, stop_event: threading.Event | None = None):
        self.path = path
        self.realtime = realtime
        self.stop_event = stop_event or threading.Event()
        self.wav: wave.Wave_read | None = None
        self._started = 0.0
        self._delivered = 0
        self.exhausted = False

    def open(self) -> None:
        try:
            self.wav = wave.open(self.path, "rb")
        except (OSError, wave.Error, EOFError) as exc:
            raise SourceError(f"cannot open WAV {self.path}: {exc}") from exc
        rate, channels, width = self.wav.getframerate(), self.wav.getnchannels(), self.wav.getsampwidth()
        if (rate, channels, width) != (SAMPLE_RATE, CHANNELS, SAMPLE_WIDTH):
            self.wav.close()
            raise SourceError(
                f"WAV must be 16000 Hz mono 16-bit PCM (got {rate} Hz, {channels} ch, {width * 8}-bit); "
                "convert it with: ffmpeg -i in.wav -ar 16000 -ac 1 -c:a pcm_s16le out.wav"
            )
        self._started = time.monotonic()
        self._delivered = 0

    def read(self, n: int) -> bytes:
        assert self.wav
        if self.realtime:
            due = self._started + self._delivered / BYTES_PER_SEC
            delay = due - time.monotonic()
            if delay > 0 and self.stop_event.wait(delay):
                return b""
        data = self.wav.readframes(n // SAMPLE_WIDTH)
        if not data:
            self.exhausted = True
        self._delivered += len(data)
        return data

    def close(self) -> None:
        if self.wav:
            self.wav.close()
            self.wav = None


def make_source(cfg: Config, stop_event: threading.Event) -> AudioSource:
    src = cfg.audio_source or {"type": "arecord"}
    if src.get("type") == "file":
        return FileSource(str(src["path"]), bool(src.get("realtime", True)), stop_event)
    return ArecordSource(cfg.alsa_device)


def mic_status(cfg: Config) -> tuple[bool, str | None]:
    src = cfg.audio_source or {}
    if src.get("type") == "file":
        p = Path(str(src.get("path", "")))
        return p.is_file(), f"file:{p.name}"
    try:
        out = subprocess.run(["arecord", "-l"], capture_output=True, text=True, timeout=5).stdout
    except (OSError, subprocess.SubprocessError):
        return False, None
    # e.g. "card 2: Device [USB PnP Sound Device], device 0: USB Audio [USB Audio]"
    m = re.search(r"^card \d+: [^\[]*\[([^\]]+)\]", out, re.MULTILINE)
    return (m is not None), (m.group(1).strip() if m else None)


# ---------------------------------------------------------------------------
# Recorder
# ---------------------------------------------------------------------------


class Recorder:
    """Captures one session at a time into fixed-size chunks in the buffer."""

    READ_BYTES = 3200  # 0.1 s

    def __init__(
        self,
        cfg: Config,
        buffer: Buffer,
        source_factory: Callable[[threading.Event], AudioSource] | None = None,
        restart_delay: float = 2.0,
    ):
        self.cfg = cfg
        self.buffer = buffer
        self.source_factory = source_factory or (lambda ev: make_source(cfg, ev))
        self.restart_delay = restart_delay
        self.session_id: str | None = None
        self.mic_ok = True
        self.last_error: str | None = None
        self.source_finished = threading.Event()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._pending = bytearray()
        self._next_idx = 0
        self._lock = threading.Lock()

    @property
    def active(self) -> bool:
        return self.session_id is not None

    def start(self, session_id: str, lesson_id: str | None) -> None:
        with self._lock:
            if self.session_id:
                raise RuntimeError("already recording")
            m = self.buffer.create_session(session_id, lesson_id)
            # Probe the source synchronously so a bad mic/file fails the start command.
            self._stop = threading.Event()
            source = self.source_factory(self._stop)
            source.open()
            self.session_id = session_id.lower()
            self._next_idx = int(m["nextIdx"])
            self._pending = bytearray()
            self.source_finished.clear()
            self.mic_ok = True
            self._thread = threading.Thread(target=self._run, args=(source,), name="recorder", daemon=True)
            self._thread.start()
        info("Recording started", sessionId=session_id, resumeAtChunk=self._next_idx)

    def stop(self, mark_stopped: bool = True) -> str | None:
        """Stop capturing and flush the partial chunk. `mark_stopped` marks the session ready to finalize."""
        with self._lock:
            sid = self.session_id
            if not sid:
                return None
            self._stop.set()
            if self._thread:
                self._thread.join(timeout=15)
            self._flush(final=True)
            self.session_id = None
            self._thread = None
        if mark_stopped:
            self.buffer.mark_stopped(sid)
        m = self.buffer.manifest(sid) or {}
        info("Recording stopped", sessionId=sid, chunks=len(m.get("chunks", {})), seconds=round(m.get("totalBytes", 0) / BYTES_PER_SEC, 1), final=mark_stopped)
        return sid

    def _run(self, source: AudioSource) -> None:
        while not self._stop.is_set():
            try:
                while not self._stop.is_set():
                    data = source.read(self.READ_BYTES)
                    if not data:
                        break
                    self._feed(data)
                    if self._next_idx >= MAX_CHUNKS_PER_SESSION:
                        warn("Maximum recording length reached; capture paused", sessionId=self.session_id)
                        self._stop.wait()
                        break
            except SourceError as exc:
                self.mic_ok = False
                self.last_error = str(exc)[:500]
                error("Audio capture failed; restarting", err=self.last_error)
            except OSError as exc:  # disk full etc.
                self.last_error = f"Buffer write failed: {exc}"[:500]
                error("Buffer write failed", err=str(exc))
            finally:
                source.close()
            if self._stop.is_set():
                break
            if source.exhausted:
                info("Audio file finished; waiting for stop command", sessionId=self.session_id)
                self._flush(final=True)
                self.source_finished.set()
                self._stop.wait()
                break
            # Restart the source (e.g. arecord crashed / USB mic replugged).
            if self._stop.wait(self.restart_delay):
                break
            source = self.source_factory(self._stop)
            try:
                source.open()
                self.mic_ok = True
            except SourceError as exc:
                self.mic_ok = False
                self.last_error = str(exc)[:500]
                error("Audio source unavailable", err=self.last_error)

    def _feed(self, data: bytes) -> None:
        self._pending.extend(data)
        size = self.cfg.chunk_bytes
        while len(self._pending) >= size:
            self._write(bytes(self._pending[:size]))
            del self._pending[:size]

    def _flush(self, final: bool) -> None:
        if final and self._pending and self.session_id:
            data = bytes(self._pending)
            if len(data) % 2:
                data = data[:-1]
            self._pending = bytearray()
            if data:
                self._write(data)

    def _write(self, data: bytes) -> None:
        sid = self.session_id
        if not sid:
            return
        idx = self._next_idx
        self.buffer.write_chunk(sid, idx, data)
        self._next_idx = idx + 1


# ---------------------------------------------------------------------------
# Uploader
# ---------------------------------------------------------------------------


class PermanentUploadError(Exception):
    pass


class Uploader:
    def __init__(self, buffer: Buffer, api: Api, recorder: Recorder | None = None, backoff: Backoff | None = None):
        self.buffer = buffer
        self.api = api
        self.recorder = recorder
        self.backoff = backoff or Backoff(base=2.0, cap=300.0)
        self._synced: set[str] = set()
        self.last_error: str | None = None

    def run(self, stop: threading.Event) -> None:
        while not stop.is_set():
            ok = self.run_once()
            if ok:
                self.backoff.reset()
                self.buffer.changed.wait(5)
                self.buffer.changed.clear()
            else:
                delay = self.backoff.next_delay()
                warn("Upload retry scheduled", delaySec=round(delay, 1), err=self.last_error)
                stop.wait(delay)

    def run_once(self) -> bool:
        """Process every buffered session once. Returns False if a retryable error occurred."""
        ok = True
        for sid in self.buffer.sessions():
            try:
                self._process(sid)
            except (TransientError, ApiError) as exc:
                if isinstance(exc, ApiError) and not exc.retryable:
                    error("Upload rejected", sessionId=sid, err=str(exc))
                self.last_error = str(exc)[:500]
                ok = False
            except PermanentUploadError as exc:
                self.last_error = str(exc)[:500]
                error("Upload problem needs attention", sessionId=sid, err=str(exc))
                ok = False
            except Exception as exc:  # never let one bad session kill the uploader thread
                self.last_error = repr(exc)[:500]
                log.exception("Unexpected upload error", extra={"fields": {"sessionId": sid}})
                ok = False
        return ok

    def _server_terminal(self, sid: str) -> bool:
        try:
            _, status = self.api.received_chunks(sid)
        except ApiError as exc:
            if exc.status == 404:
                warn("Server does not know this recording; discarding local copy", sessionId=sid)
                return True
            raise
        return status in TERMINAL_STATUSES

    def _drop(self, sid: str, why: str) -> None:
        info("Discarding local recording", sessionId=sid, reason=why)
        self.buffer.remove(sid)
        self._synced.discard(sid)

    def _process(self, sid: str) -> None:
        m = self.buffer.manifest(sid)
        if not m:
            return
        pending = self.buffer.pending_chunks(sid)

        if pending and sid not in self._synced:
            try:
                received, status = self.api.received_chunks(sid)
            except ApiError as exc:
                if exc.status == 404:
                    return self._drop(sid, "unknown session")
                raise
            if status in TERMINAL_STATUSES:
                return self._drop(sid, f"session {status}")
            confirmed = 0
            for idx in received:
                if idx in pending:
                    self.buffer.mark_uploaded(sid, idx)
                    confirmed += 1
            if confirmed:
                info("Resumed upload; server already had chunks", sessionId=sid, skipped=confirmed)
            self._synced.add(sid)
            pending = self.buffer.pending_chunks(sid)

        for idx in pending:
            # Re-read the manifest: the recorder may have written chunks since `m` was loaded.
            entry = ((self.buffer.manifest(sid) or {}).get("chunks") or {}).get(str(idx))
            if not entry:
                continue
            data = self.buffer.read_chunk(sid, idx)
            sha = entry["sha256"]
            if sha256_hex(data) != sha:
                raise PermanentUploadError(f"local chunk {idx} is corrupt (checksum mismatch)")
            try:
                self.api.put_chunk(sid, idx, data, sha)
            except ApiError as exc:
                if exc.status in (404, 409) and self._server_terminal(sid):
                    return self._drop(sid, "session closed on server")
                raise
            self.buffer.mark_uploaded(sid, idx)
            self.backoff.reset()

        m = self.buffer.manifest(sid) or m
        if not m.get("stopped") or self.buffer.pending_chunks(sid):
            return
        total = len(m["chunks"])
        if total == 0:
            warn("Stopped recording has no audio; nothing to finalize", sessionId=sid)
            return self._drop(sid, "empty")
        duration = m.get("totalBytes", 0) / BYTES_PER_SEC
        try:
            self.api.finalize(sid, total, duration)
        except ApiError as exc:
            if exc.status == 409 and isinstance(exc.details, dict) and exc.details.get("missing"):
                # The server lost chunks we already deleted locally: unrecoverable.
                self._synced.discard(sid)
                raise PermanentUploadError(f"server is missing chunks {exc.details['missing'][:10]} that were already uploaded")
            if exc.status in (404, 409) and self._server_terminal(sid):
                return self._drop(sid, "session closed on server")
            raise
        info("Recording finalized", sessionId=sid, chunks=total, seconds=round(duration, 1))
        self.buffer.remove(sid)
        self._synced.discard(sid)


# ---------------------------------------------------------------------------
# System stats
# ---------------------------------------------------------------------------


class SystemStats:
    def __init__(self) -> None:
        self._last_cpu: tuple[int, int] | None = None

    @staticmethod
    def cpu_temp_c() -> float | None:
        try:
            return round(int(Path("/sys/class/thermal/thermal_zone0/temp").read_text().strip()) / 1000.0, 1)
        except (OSError, ValueError):
            return None

    def cpu_pct(self) -> float | None:
        try:
            fields = Path("/proc/stat").read_text().splitlines()[0].split()[1:]
            values = [int(v) for v in fields]
        except (OSError, ValueError, IndexError):
            return None
        idle = values[3] + (values[4] if len(values) > 4 else 0)
        total = sum(values)
        last, self._last_cpu = self._last_cpu, (idle, total)
        if not last or total == last[1]:
            return None
        return round(max(0.0, min(100.0, 100.0 * (1 - (idle - last[0]) / (total - last[1])))), 1)

    @staticmethod
    def mem_pct() -> float | None:
        try:
            info_ = {}
            for line in Path("/proc/meminfo").read_text().splitlines():
                k, v = line.split(":", 1)
                info_[k] = int(v.strip().split()[0])
            return round(100.0 * (1 - info_["MemAvailable"] / info_["MemTotal"]), 1)
        except (OSError, ValueError, KeyError, ZeroDivisionError):
            return None

    @staticmethod
    def disk_free_mb(path: str) -> float | None:
        try:
            return round(shutil.disk_usage(path).free / (1024 * 1024), 1)
        except OSError:
            return None


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------


class Agent:
    def __init__(self, cfg: Config, api: Api | None = None, source_factory: Callable[[threading.Event], AudioSource] | None = None,
                 disk_free_mb: Callable[[], float | None] | None = None):
        self.cfg = cfg
        ensure_private_dir(Path(cfg.data_dir))
        self.api = api or Api(cfg.server_url, cfg.device_id, ca_file=cfg.ca_file)
        self.buffer = Buffer(cfg.data_dir)
        self.recorder = Recorder(cfg, self.buffer, source_factory)
        self.uploader = Uploader(self.buffer, self.api, self.recorder)
        self.stats = SystemStats()
        self.stop_event = threading.Event()
        self._disk_free = disk_free_mb or (lambda: SystemStats.disk_free_mb(cfg.data_dir))
        self._handled: dict[str, tuple[bool, str | None]] = {}
        self._command_lock = threading.Lock()
        self._threads: list[threading.Thread] = []

    # -- provisioning --------------------------------------------------------

    def ensure_registered(self) -> None:
        creds = Credentials.load(self.cfg.data_dir)
        token = self.cfg.enrollment_token
        token_sha = sha256_hex(token.encode()) if token else None
        if creds and creds.device_id == self.cfg.device_id and (not token_sha or creds.token_sha256 == token_sha):
            self.api.device_key = creds.device_key
            return
        if not token:
            raise ConfigError("Device is not registered: set enrollment_token in the config (issued in Admin > Devices)")
        backoff = Backoff(base=5.0, cap=300.0)
        while not self.stop_event.is_set():
            try:
                res = self.api.register(token)
                break
            except ApiError as exc:
                if exc.retryable:
                    warn("Registration failed; retrying", err=str(exc))
                else:
                    raise ConfigError(f"Registration refused: {exc}. Ask an admin for a new enrollment token.") from None
            except TransientError as exc:
                warn("Server unreachable during registration; retrying", err=str(exc))
            self.stop_event.wait(backoff.next_delay())
        else:
            raise SystemExit(0)
        Credentials(self.cfg.device_id, res["deviceKey"], token_sha).save(self.cfg.data_dir)
        self.api.device_key = res["deviceKey"]
        info("Device registered", deviceId=self.cfg.device_id, room=(res.get("room") or {}).get("name"))

    # -- commands ------------------------------------------------------------

    def handle_command(self, cmd: dict[str, Any]) -> tuple[bool, str | None]:
        """Run a command (idempotent per command id) and return the ack result."""
        cid = str(cmd.get("id"))
        with self._command_lock:
            if cid in self._handled:
                return self._handled[cid]
            result = self._run_command(cmd)
            self._handled[cid] = result
            if len(self._handled) > 200:
                self._handled.pop(next(iter(self._handled)))
            return result

    def _run_command(self, cmd: dict[str, Any]) -> tuple[bool, str | None]:
        ctype = cmd.get("type")
        payload = cmd.get("payload") or {}
        sid = str(payload.get("sessionId", "")).lower()
        if not UUID_RE.match(sid):
            return False, "Invalid session id"
        if ctype == "start_recording":
            if self.recorder.session_id == sid:
                return True, None
            if self.recorder.active:
                return False, "The device is already recording another class"
            free = self._disk_free()
            if free is not None and free < self.cfg.min_free_disk_mb:
                return False, f"Not enough free disk space on the device ({int(free)} MB free)"
            try:
                self.recorder.start(sid, payload.get("lessonId"))
            except (SourceError, OSError) as exc:
                m = self.buffer.manifest(sid)
                if m is not None and not m["chunks"]:
                    self.buffer.remove(sid)  # never discard audio already captured
                return False, f"Could not start the microphone: {exc}"[:500]
            return True, None
        if ctype == "stop_recording":
            if self.recorder.session_id == sid:
                self.recorder.stop(mark_stopped=True)
            elif self.buffer.manifest(sid):
                self.buffer.mark_stopped(sid)
            return True, None
        return False, f"Unknown command {ctype}"

    def ack_with_retry(self, cid: str, ok: bool, err: str | None) -> None:
        backoff = Backoff(base=1.0, cap=30.0)
        for _ in range(6):
            try:
                self.api.ack(cid, ok, err)
                return
            except ApiError as exc:
                if not exc.retryable:
                    warn("Command ack rejected", commandId=cid, err=str(exc))
                    return
            except TransientError as exc:
                warn("Command ack failed; retrying", commandId=cid, err=str(exc))
            if self.stop_event.wait(backoff.next_delay()):
                return

    def command_loop(self) -> None:
        backoff = Backoff(base=2.0, cap=60.0)
        while not self.stop_event.is_set():
            try:
                cmd = self.api.poll_command(25)
                backoff.reset()
            except (ApiError, TransientError) as exc:
                if isinstance(exc, ApiError) and exc.status == 401:
                    error("Device key rejected (revoked?). Re-provision with a new enrollment token.")
                self.stop_event.wait(backoff.next_delay())
                continue
            if not cmd:
                continue
            info("Command received", commandId=cmd.get("id"), type=cmd.get("type"))
            ok, err = self.handle_command(cmd)
            self.ack_with_retry(str(cmd.get("id")), ok, err)
            if not ok:
                warn("Command failed", commandId=cmd.get("id"), err=err)

    # -- heartbeat -----------------------------------------------------------

    def heartbeat_payload(self) -> dict[str, Any]:
        mic_ok, mic_name = mic_status(self.cfg)
        if self.recorder.active and not self.recorder.mic_ok:
            mic_ok = False
        free = self._disk_free()
        backlog = self.buffer.backlog()
        last_error = self.recorder.last_error or self.uploader.last_error
        low_disk = free is not None and free < self.cfg.min_free_disk_mb
        if self.recorder.active:
            status = "recording"
        elif low_disk or not mic_ok:
            status = "error"
            last_error = "Low disk space" if low_disk else (last_error or "No microphone detected")
        elif backlog:
            status = "uploading"
        else:
            status = "idle"
        return {
            "status": status,
            "micOk": bool(mic_ok),
            "micName": mic_name,
            "cpuTempC": SystemStats.cpu_temp_c(),
            "cpuPct": self.stats.cpu_pct(),
            "memPct": SystemStats.mem_pct(),
            "diskFreeMb": free,
            "backlogChunks": backlog,
            "activeSessionId": self.recorder.session_id,
            "agentVersion": AGENT_VERSION,
            "lastError": (last_error or None) and str(last_error)[:500],
        }

    def heartbeat_loop(self) -> None:
        while not self.stop_event.is_set():
            try:
                self.api.heartbeat(self.heartbeat_payload())
            except ApiError as exc:
                if exc.status == 401:
                    error("Device key rejected (revoked?). Re-provision with a new enrollment token.")
                else:
                    warn("Heartbeat failed", err=str(exc))
            except TransientError as exc:
                warn("Heartbeat failed", err=str(exc))
            except Exception as exc:  # never let stats collection kill the thread
                error("Heartbeat error", err=repr(exc))
            self.stop_event.wait(self.cfg.heartbeat_interval_sec)

    # -- lifecycle -----------------------------------------------------------

    def resume_sessions(self) -> None:
        """After a reboot/crash: continue recording a class that is still running, finalize the rest."""
        unstopped = [s for s in self.buffer.sessions() if not (self.buffer.manifest(s) or {}).get("stopped")]
        for i, sid in enumerate(reversed(unstopped)):  # newest first
            status: str | None = "recording"
            try:
                _, status = self.api.received_chunks(sid)
            except ApiError as exc:
                status = "gone" if exc.status == 404 else "recording"
            except TransientError:
                status = "recording"  # offline: keep recording, upload later
            if status in TERMINAL_STATUSES or status == "gone":
                self.buffer.remove(sid)
                info("Dropped stale local recording", sessionId=sid, status=status)
            elif status in ("recording", "pending") and i == 0:
                try:
                    m = self.buffer.manifest(sid) or {}
                    self.recorder.start(sid, m.get("lessonId"))
                    info("Resumed recording after restart", sessionId=sid)
                except (SourceError, OSError, RuntimeError) as exc:
                    error("Could not resume recording", sessionId=sid, err=str(exc))
                    self.buffer.mark_stopped(sid)
            else:
                self.buffer.mark_stopped(sid)
        backlog = self.buffer.backlog()
        if backlog:
            info("Upload backlog found", chunks=backlog)

    def start(self) -> None:
        self.ensure_registered()
        self.resume_sessions()
        for name, target in (
            ("heartbeat", self.heartbeat_loop),
            ("commands", self.command_loop),
            ("uploader", lambda: self.uploader.run(self.stop_event)),
        ):
            t = threading.Thread(target=target, name=name, daemon=True)
            t.start()
            self._threads.append(t)
        info("Agent started", version=AGENT_VERSION, deviceId=self.cfg.device_id, server=self.cfg.server_url)

    def shutdown(self) -> None:
        """SIGTERM: stop capturing (keeping the session resumable) and keep the buffer."""
        info("Shutting down")
        self.stop_event.set()
        self.recorder.stop(mark_stopped=False)
        self.buffer.changed.set()
        for t in self._threads:
            t.join(timeout=5)


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="ClassIQ classroom recording agent")
    parser.add_argument("--config", default=os.environ.get("CLASSPULSE_CONFIG", DEFAULT_CONFIG_PATH))
    parser.add_argument("--version", action="version", version=AGENT_VERSION)
    args = parser.parse_args(list(argv) if argv is not None else None)

    setup_logging()
    try:
        cfg = load_config(args.config)
    except ConfigError as exc:
        error("Invalid configuration", err=str(exc), path=args.config)
        return 2
    setup_logging(cfg.log_level)

    agent = Agent(cfg)
    stopping = threading.Event()

    def on_signal(signum: int, _frame: Any) -> None:
        info("Signal received", signal=signal.Signals(signum).name)
        stopping.set()

    signal.signal(signal.SIGTERM, on_signal)
    signal.signal(signal.SIGINT, on_signal)

    try:
        agent.start()
    except ConfigError as exc:
        error("Cannot start", err=str(exc))
        # Avoid a tight systemd restart loop on a permanent provisioning problem.
        stopping.wait(60)
        return 2
    while not stopping.wait(1):
        pass
    agent.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
