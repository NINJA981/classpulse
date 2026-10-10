"""
Agent tests against a stub HTTP server running in a thread.
Run with:  python -m pytest apps/classroom-agent/tests -q   (or: python -m unittest discover -s apps/classroom-agent/tests)
"""
from __future__ import annotations

import hashlib
import json
import os
import random
import sys
import tempfile
import threading
import time
import unittest
import uuid
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import agent as A  # noqa: E402


class StubServer:
    """Minimal fake of the ClassPulse device API."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.chunks: dict[str, dict[int, bytes]] = {}
        self.status: dict[str, str] = {}
        self.finalized: dict[str, dict] = {}
        self.requests: list[tuple[str, str]] = []
        self.fail_puts = 0  # respond 503 to the next N chunk PUTs
        self.commands: list[dict] = []
        self.acks: dict[str, dict] = {}
        self.heartbeats: list[dict] = []
        self.registered: list[dict] = []
        stub = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):  # silence
                pass

            def _json(self, code: int, body) -> None:
                raw = json.dumps(body).encode()
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

            def _body(self) -> bytes:
                n = int(self.headers.get("Content-Length") or 0)
                return self.rfile.read(n) if n else b""

            def _authed(self) -> bool:
                if self.headers.get("X-Device-Key") != "secret-key":
                    self._json(401, {"error": {"code": "UNAUTHENTICATED", "message": "no"}})
                    return False
                return True

            def do_POST(self):
                stub.requests.append(("POST", self.path))
                body = self._body()
                if self.path == "/api/devices/register":
                    data = json.loads(body)
                    stub.registered.append(data)
                    return self._json(201, {"deviceId": data["deviceId"], "deviceKey": "secret-key", "room": {"id": "r", "name": "Room 1"}})
                if not self._authed():
                    return
                parts = self.path.split("/")
                if self.path == "/api/devices/me/heartbeat":
                    stub.heartbeats.append(json.loads(body))
                    return self._json(200, {"serverTime": "now"})
                if self.path.endswith("/ack"):
                    stub.acks[parts[-2]] = json.loads(body)
                    self.send_response(204)
                    self.end_headers()
                    return
                if self.path.endswith("/finalize"):
                    sid = parts[-2]
                    data = json.loads(body)
                    with stub.lock:
                        have = stub.chunks.get(sid, {})
                        missing = [i for i in range(data["totalChunks"]) if i not in have]
                        if missing:
                            return self._json(409, {"error": {"code": "CONFLICT", "message": "missing", "details": {"missing": missing}}})
                        stub.finalized[sid] = data
                        stub.status[sid] = "finalized"
                    return self._json(200, {"id": sid, "status": "finalized"})
                self._json(404, {"error": {"code": "NOT_FOUND", "message": "?"}})

            def do_GET(self):
                stub.requests.append(("GET", self.path))
                if not self._authed():
                    return
                if self.path.startswith("/api/devices/me/commands"):
                    with stub.lock:
                        cmd = stub.commands.pop(0) if stub.commands else None
                    if cmd is None:
                        time.sleep(0.05)
                    return self._json(200, {"command": cmd})
                parts = self.path.split("/")
                if self.path.endswith("/chunks"):
                    sid = parts[-2]
                    with stub.lock:
                        if sid not in stub.status:
                            return self._json(404, {"error": {"code": "NOT_FOUND", "message": "x"}})
                        return self._json(200, {"received": sorted(stub.chunks.get(sid, {})), "status": stub.status[sid]})
                self._json(404, {"error": {"code": "NOT_FOUND", "message": "?"}})

            def do_PUT(self):
                stub.requests.append(("PUT", self.path))
                body = self._body()
                if not self._authed():
                    return
                parts = self.path.split("/")
                sid, idx = parts[-3], int(parts[-1])
                with stub.lock:
                    if stub.fail_puts > 0:
                        stub.fail_puts -= 1
                        return self._json(503, {"error": {"code": "INTERNAL", "message": "busy"}})
                    if hashlib.sha256(body).hexdigest() != self.headers.get("X-Chunk-SHA256"):
                        return self._json(400, {"error": {"code": "BAD_REQUEST", "message": "sha"}})
                    if stub.status.get(sid) not in ("recording", "stopping"):
                        return self._json(409, {"error": {"code": "INVALID_STATE", "message": "closed"}})
                    stub.chunks.setdefault(sid, {})[idx] = body
                return self._json(200, {"idx": idx})

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.httpd.server_address[1]}"
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    def close(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()

    def puts(self, sid: str) -> list[int]:
        return [int(p.rsplit("/", 1)[1]) for m, p in self.requests if m == "PUT" and f"/sessions/{sid}/" in p]


def make_wav(path: Path, seconds: float, rate: int = 16000, channels: int = 1) -> bytes:
    n = int(rate * seconds)
    frames = b"".join(int(1000 * ((i % 40) - 20)).to_bytes(2, "little", signed=True) for i in range(n)) * channels
    with wave.open(str(path), "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(frames)
    return frames


class AgentTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.data_dir = self.tmp.name
        self.server = StubServer()
        self.api = A.Api(self.server.url, "rpi-test-1", "secret-key", timeout=5)
        self.buffer = A.Buffer(self.data_dir)

    def tearDown(self) -> None:
        self.server.close()
        self.tmp.cleanup()

    def config(self, **overrides) -> A.Config:
        base = dict(
            server_url=self.server.url,
            device_id="rpi-test-1",
            allow_insecure_http=True,
            data_dir=self.data_dir,
            chunk_seconds=1,
            audio_source={"type": "file", "path": str(Path(self.data_dir) / "in.wav"), "realtime": False},
        )
        base.update(overrides)
        return A.Config.from_dict(base)

    def new_session(self, status: str = "recording") -> str:
        sid = str(uuid.uuid4())
        self.server.status[sid] = status
        self.buffer.create_session(sid, str(uuid.uuid4()))
        return sid


class ConfigTests(AgentTestCase):
    def test_requires_https_unless_explicitly_allowed(self):
        with self.assertRaises(A.ConfigError):
            A.Config.from_dict({"server_url": "http://x", "device_id": "rpi-1"})
        A.Config.from_dict({"server_url": "https://x", "device_id": "rpi-1"})
        with self.assertRaises(A.ConfigError):
            A.Config.from_dict({"server_url": "https://x", "device_id": "Bad_ID"})

    def test_registers_once_and_persists_credentials_0600(self):
        cfg = self.config(enrollment_token="t" * 32)
        agent = A.Agent(cfg, api=A.Api(cfg.server_url, cfg.device_id))
        agent.ensure_registered()
        creds = json.loads((Path(self.data_dir) / "credentials.json").read_text())
        self.assertEqual(creds["device_key"], "secret-key")
        self.assertNotIn("enrollment_token", creds)
        if os.name == "posix":
            self.assertEqual(os.stat(Path(self.data_dir) / "credentials.json").st_mode & 0o777, 0o600)
        agent2 = A.Agent(cfg, api=A.Api(cfg.server_url, cfg.device_id))
        agent2.ensure_registered()
        self.assertEqual(len(self.server.registered), 1)  # credentials reused


class ChunkingTests(AgentTestCase):
    def test_recorder_splits_audio_into_chunks_with_manifest_sha(self):
        frames = make_wav(Path(self.data_dir) / "in.wav", 2.5)
        cfg = self.config()
        rec = A.Recorder(cfg, self.buffer)
        sid = str(uuid.uuid4())
        rec.start(sid, None)
        self.assertTrue(rec.source_finished.wait(10))
        rec.stop()
        m = self.buffer.manifest(sid)
        self.assertTrue(m["stopped"])
        self.assertEqual(sorted(int(i) for i in m["chunks"]), [0, 1, 2])
        sizes = [m["chunks"][str(i)]["bytes"] for i in range(3)]
        self.assertEqual(sizes, [32000, 32000, 16000])
        self.assertEqual(m["totalBytes"], len(frames))
        joined = b""
        for i in range(3):
            data = self.buffer.read_chunk(sid, i)
            self.assertEqual(hashlib.sha256(data).hexdigest(), m["chunks"][str(i)]["sha256"])
            joined += data
        self.assertEqual(joined, frames)

    def test_file_source_rejects_non_16k_mono(self):
        make_wav(Path(self.data_dir) / "in.wav", 0.5, rate=44100)
        rec = A.Recorder(self.config(), self.buffer)
        with self.assertRaises(A.SourceError):
            rec.start(str(uuid.uuid4()), None)
        self.assertFalse(rec.active)

    def test_realtime_file_source_is_paced(self):
        make_wav(Path(self.data_dir) / "in.wav", 1.0)
        cfg = self.config(audio_source={"type": "file", "path": str(Path(self.data_dir) / "in.wav"), "realtime": True})
        rec = A.Recorder(cfg, self.buffer)
        t0 = time.monotonic()
        rec.start(str(uuid.uuid4()), None)
        self.assertTrue(rec.source_finished.wait(10))
        self.assertGreaterEqual(time.monotonic() - t0, 0.85)
        rec.stop()


class UploadTests(AgentTestCase):
    def test_resume_skips_chunks_the_server_already_has(self):
        sid = self.new_session()
        payloads = [bytes([i]) * 64 for i in range(4)]
        for i, p in enumerate(payloads):
            self.buffer.write_chunk(sid, i, p)
        self.server.chunks[sid] = {0: payloads[0], 1: payloads[1]}
        up = A.Uploader(self.buffer, self.api)
        self.assertTrue(up.run_once())
        self.assertEqual(self.server.puts(sid), [2, 3])
        self.assertEqual(self.buffer.pending_chunks(sid), [])
        self.assertEqual(sorted(self.server.chunks[sid]), [0, 1, 2, 3])
        # Local files are gone only after the server confirmed them.
        self.assertFalse(any(p.suffix == ".pcm" for p in (Path(self.data_dir) / "buffer" / sid).iterdir()))

    def test_backoff_on_5xx_then_success_keeps_chunk_until_2xx(self):
        sid = self.new_session()
        self.buffer.write_chunk(sid, 0, b"\x01\x00" * 100)
        self.server.fail_puts = 2
        up = A.Uploader(self.buffer, self.api, backoff=A.Backoff(base=0.01, cap=0.05, rng=random.Random(1)))
        self.assertFalse(up.run_once())
        self.assertEqual(self.buffer.pending_chunks(sid), [0])  # not deleted after 503
        self.assertTrue((Path(self.data_dir) / "buffer" / sid / "00000.pcm").exists())
        delays = [up.backoff.next_delay() for _ in range(3)]
        self.assertTrue(delays[0] <= 0.01 and delays[1] <= 0.02 and delays[2] <= 0.04)
        self.assertGreater(delays[2], delays[0] / 2)

        stop = threading.Event()
        t = threading.Thread(target=up.run, args=(stop,), daemon=True)
        t.start()
        deadline = time.time() + 5
        while self.buffer.pending_chunks(sid) and time.time() < deadline:
            time.sleep(0.02)
        stop.set()
        self.buffer.changed.set()
        t.join(2)
        self.assertEqual(self.buffer.pending_chunks(sid), [])
        self.assertEqual(self.server.puts(sid), [0, 0, 0])  # 503, 503, 200

    def test_finalize_after_stop_and_drain(self):
        sid = self.new_session()
        self.buffer.write_chunk(sid, 0, b"\x00\x01" * 16000)
        self.buffer.write_chunk(sid, 1, b"\x00\x01" * 8000)
        up = A.Uploader(self.buffer, self.api)
        self.assertTrue(up.run_once())
        self.assertNotIn(sid, self.server.finalized)  # still recording: no finalize yet
        self.buffer.mark_stopped(sid)
        self.server.status[sid] = "stopping"
        self.assertTrue(up.run_once())
        self.assertEqual(self.server.finalized[sid], {"totalChunks": 2, "durationSec": 1.5})
        self.assertIsNone(self.buffer.manifest(sid))  # local session cleaned up

    def test_cancelled_session_is_dropped(self):
        sid = self.new_session(status="cancelled")
        self.buffer.write_chunk(sid, 0, b"\x00\x00" * 10)
        up = A.Uploader(self.buffer, self.api)
        self.assertTrue(up.run_once())
        self.assertIsNone(self.buffer.manifest(sid))


class CommandTests(AgentTestCase):
    def test_start_and_stop_commands_with_disk_guard(self):
        make_wav(Path(self.data_dir) / "in.wav", 1.2)
        free = {"mb": 100.0}
        cfg = self.config(min_free_disk_mb=500)
        agent = A.Agent(cfg, api=self.api, disk_free_mb=lambda: free["mb"])
        sid = str(uuid.uuid4())
        start = {"id": str(uuid.uuid4()), "type": "start_recording", "payload": {"sessionId": sid, "lessonId": str(uuid.uuid4())}}
        ok, err = agent.handle_command(start)
        self.assertFalse(ok)
        self.assertIn("disk", err)
        self.assertIsNone(self.buffer.manifest(sid))

        free["mb"] = 10_000.0
        start2 = dict(start, id=str(uuid.uuid4()))
        self.assertEqual(agent.handle_command(start2), (True, None))
        self.assertEqual(agent.handle_command(start2), (True, None))  # redelivered: idempotent
        self.assertEqual(agent.heartbeat_payload()["status"], "recording")
        self.assertTrue(agent.recorder.source_finished.wait(10))
        stop = {"id": str(uuid.uuid4()), "type": "stop_recording", "payload": {"sessionId": sid}}
        self.assertEqual(agent.handle_command(stop), (True, None))
        self.assertFalse(agent.recorder.active)
        m = self.buffer.manifest(sid)
        self.assertTrue(m["stopped"])
        self.assertEqual(len(m["chunks"]), 2)

    def test_end_to_end_with_stub_server(self):
        """Command poll → record from WAV → stop → upload → finalize, all through the agent threads."""
        make_wav(Path(self.data_dir) / "in.wav", 2.2)
        cfg = self.config(heartbeat_interval_sec=5, enrollment_token="t" * 32)
        agent = A.Agent(cfg, api=A.Api(cfg.server_url, cfg.device_id, timeout=5), disk_free_mb=lambda: 10_000.0)
        sid = str(uuid.uuid4())
        self.server.status[sid] = "recording"
        start_id, stop_id = str(uuid.uuid4()), str(uuid.uuid4())
        self.server.commands.append({"id": start_id, "type": "start_recording", "payload": {"sessionId": sid, "lessonId": str(uuid.uuid4())}})
        agent.start()
        try:
            self.assertTrue(agent.recorder.source_finished.wait(10))
            self.server.status[sid] = "stopping"
            self.server.commands.append({"id": stop_id, "type": "stop_recording", "payload": {"sessionId": sid}})
            deadline = time.time() + 15
            while sid not in self.server.finalized and time.time() < deadline:
                time.sleep(0.05)
        finally:
            agent.shutdown()
        self.assertEqual(self.server.acks[start_id], {"ok": True, "error": None})
        self.assertEqual(self.server.acks[stop_id], {"ok": True, "error": None})
        self.assertEqual(self.server.finalized[sid]["totalChunks"], 3)
        self.assertAlmostEqual(self.server.finalized[sid]["durationSec"], 2.2, places=2)
        self.assertTrue(self.server.heartbeats)
        hb = self.server.heartbeats[0]
        for key in ("status", "micOk", "backlogChunks", "agentVersion", "diskFreeMb"):
            self.assertIn(key, hb)


if __name__ == "__main__":
    unittest.main()
