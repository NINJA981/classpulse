# apps/classroom-agent

The Raspberry Pi 5 recorder: one Python 3 file (`agent.py`), **standard library only** (no pip packages). It registers with an enrollment token, records on command, buffers chunks to disk and uploads them. Full guide: `docs/agents/classroom-agent.md`; hardware: `docs/agents/hardware-raspberry-pi.md`.

- Tests: `npm run test:agent` from the repo root (pytest, `tests/`).
- `install.sh`, `classpulse-agent.service` and the paths `/etc/classpulse`, `/var/lib/classpulse`, `/opt/classpulse-agent`, the `classpulse` user and `CLASSPULSE_CONFIG` are on deployed Pis. Don't rename them without a migration in `install.sh`.
- The server side is `apps/api/src/modules/devices/` (device-key auth, never feature-gated).
