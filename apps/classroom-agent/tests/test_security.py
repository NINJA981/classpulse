"""
Security properties of the agent: the device key never follows a redirect, and credentials and audio are
owner-only on disk.
Run with:  python -m pytest apps/classroom-agent/tests -q
"""
from __future__ import annotations

import os
import stat
import sys
import tempfile
import threading
import unittest
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import agent as A  # noqa: E402


class _Server:
    """Records every request; answers with `status` and an optional Location header."""

    def __init__(self, status: int = 200, location: str | None = None) -> None:
        self.requests: list[tuple[str, str, dict[str, str]]] = []
        srv = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):  # silence
                pass

            def _any(self) -> None:
                n = int(self.headers.get("Content-Length") or 0)
                if n:
                    self.rfile.read(n)
                srv.requests.append((self.command, self.path, dict(self.headers.items())))
                body = b'{"ok":true}'
                self.send_response(status)
                if location:
                    self.send_header("Location", location)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            do_GET = do_POST = do_PUT = _any

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.httpd.server_address[1]}"
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def close(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()


class RedirectTests(unittest.TestCase):
    def setUp(self) -> None:
        self.elsewhere = _Server()

    def tearDown(self) -> None:
        self.elsewhere.close()

    def test_redirects_are_refused_and_the_device_key_is_never_forwarded(self):
        for code in (301, 302, 303, 307, 308):
            with self.subTest(code=code):
                redirector = _Server(status=code, location=f"{self.elsewhere.url}/steal")
                try:
                    api = A.Api(redirector.url, "rpi-test-1", "secret-key", timeout=5)
                    with self.assertRaises(A.RedirectRefused) as ctx:
                        api.heartbeat({"agentVersion": A.AGENT_VERSION})
                    # Transient: buffered audio is kept and retried, never dropped as a client error.
                    self.assertIsInstance(ctx.exception, A.TransientError)
                    self.assertIn(str(code), str(ctx.exception))
                    self.assertEqual(len(redirector.requests), 1)
                    self.assertEqual(redirector.requests[0][2].get("X-Device-Key"), "secret-key")
                finally:
                    redirector.close()
        self.assertEqual(self.elsewhere.requests, [], "the redirect target must never be contacted")

    def test_chunk_upload_redirect_keeps_the_chunk(self):
        redirector = _Server(status=307, location=f"{self.elsewhere.url}/steal")
        tmp = tempfile.TemporaryDirectory()
        try:
            api = A.Api(redirector.url, "rpi-test-1", "secret-key", timeout=5)
            buf = A.Buffer(tmp.name)
            sid = str(uuid.uuid4())
            buf.create_session(sid, None)
            buf.write_chunk(sid, 0, b"\x00\x01" * 100)
            with self.assertRaises(A.TransientError):
                api.put_chunk(sid, 0, buf.read_chunk(sid, 0), A.sha256_hex(buf.read_chunk(sid, 0)))
            self.assertEqual(buf.pending_chunks(sid), [0])
            self.assertEqual(self.elsewhere.requests, [])
        finally:
            redirector.close()
            tmp.cleanup()

    def test_plain_success_still_works(self):
        api = A.Api(self.elsewhere.url, "rpi-test-1", "secret-key", timeout=5)
        self.assertEqual(api.heartbeat({}), {"ok": True})


@unittest.skipUnless(os.name == "posix", "POSIX file modes")
class FileModeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.tmp.name) / "state"

    def tearDown(self) -> None:
        self.tmp.cleanup()

    @staticmethod
    def mode(p: Path) -> int:
        return stat.S_IMODE(os.stat(p).st_mode)

    def test_buffer_dirs_and_files_are_owner_only_even_with_a_loose_umask(self):
        old = os.umask(0o022)
        try:
            buf = A.Buffer(str(self.data_dir))
            sid = str(uuid.uuid4())
            buf.create_session(sid, None)
            buf.write_chunk(sid, 0, b"\x00\x01" * 100)
        finally:
            os.umask(old)
        session_dir = self.data_dir / "buffer" / sid
        self.assertEqual(self.mode(self.data_dir), 0o700)
        self.assertEqual(self.mode(self.data_dir / "buffer"), 0o700)
        self.assertEqual(self.mode(session_dir), 0o700)
        self.assertEqual(self.mode(session_dir / "00000.pcm"), 0o600)
        self.assertEqual(self.mode(session_dir / "manifest.json"), 0o600)

    def test_existing_loose_state_dir_is_tightened(self):
        self.data_dir.mkdir()
        os.chmod(self.data_dir, 0o755)
        (self.data_dir / "buffer").mkdir()
        os.chmod(self.data_dir / "buffer", 0o750)
        A.Buffer(str(self.data_dir))
        self.assertEqual(self.mode(self.data_dir), 0o700)
        self.assertEqual(self.mode(self.data_dir / "buffer"), 0o700)

    def test_credentials_are_0600_in_a_0700_dir(self):
        A.Credentials("rpi-test-1", "secret-key").save(str(self.data_dir))
        self.assertEqual(self.mode(self.data_dir), 0o700)
        self.assertEqual(self.mode(self.data_dir / "credentials.json"), 0o600)


if __name__ == "__main__":
    unittest.main()
