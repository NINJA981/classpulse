# ClassPulse classroom agent

A small Python service for a **Raspberry Pi 5 with a USB microphone**, one per classroom.
When a teacher presses **Start class** in ClassPulse, the agent records the lecture,
buffers it on the SD card in 60-second chunks and uploads it to the ClassPulse server.
When the teacher presses **Stop**, the agent finishes uploading and the server turns the
recording into a lesson (transcript, summary, quiz).

- Python 3.11+ standard library only. Nothing to `pip install`.
- **Outbound HTTPS (443) only.** The Pi never accepts inbound connections, so no port forwarding or static IP is needed.
- Audio never leaves the Pi unencrypted. Chunks are checksummed (SHA-256), uploads resume after reboots or network loss, and a chunk is deleted locally only after the server confirms it.

## Hardware

| Part | Notes |
|---|---|
| Raspberry Pi 5 (2 GB or more) | Raspberry Pi OS Bookworm (64-bit, Lite is fine) |
| USB microphone or USB audio interface | Any class-compliant device that `arecord -l` lists. A boundary/conference mic near the teacher works best. |
| 32 GB+ microSD (A2) or USB SSD | About 115 MB of buffer space per recorded hour |
| Official 27 W USB-C PSU, case with a fan | Long recordings keep the CPU warm. Temperature is reported to the admin console. |
| Wired Ethernet (preferred) or Wi-Fi | Outbound TCP 443 to the ClassPulse server only |

## Install

```bash
# copy this directory to the Pi (scp/USB stick/git), then:
cd classroom-agent
sudo ./install.sh
```

`install.sh` does the following:
- creates the `classpulse` system user (in the `audio` group)
- installs the agent to `/opt/classpulse-agent`
- creates `/etc/classpulse/agent.json` from `agent.example.json` (an existing config is kept)
- creates `/var/lib/classpulse`
- installs and enables `classpulse-agent.service`

## Provisioning

1. In ClassPulse, an admin opens **Admin › Devices › Add device**, picks the room and copies
   the **enrollment token**. Tokens are single-use, are shown only once and expire after 24 hours.
2. Choose the microphone. On the Pi, run:
   ```bash
   arecord -l
   # card 2: Device [USB PnP Sound Device], device 0: USB Audio [USB Audio]
   ```
   Use `plughw:CARD=Device,DEV=0` (the card's short name) rather than `hw:2,0`, because card numbers can change between boots.
   Record a short test clip as the service user:
   ```bash
   sudo -u classpulse arecord -D plughw:CARD=Device,DEV=0 -f S16_LE -r 16000 -c 1 -d 5 /tmp/t.wav && aplay /tmp/t.wav
   ```
3. Edit `/etc/classpulse/agent.json`:

   | Key | Default | Meaning |
   |---|---|---|
   | `server_url` | (required) | e.g. `https://app.classpulse.example`. Must be `https://`. |
   | `device_id` | (required) | Unique name: 3–64 characters of lowercase letters, digits and dashes, e.g. `rpi5-room-101` |
   | `enrollment_token` | (required the first time) | Token from step 1 |
   | `alsa_device` | `default` | ALSA capture device from `arecord -l` |
   | `chunk_seconds` | `60` | Chunk length (1–60) |
   | `heartbeat_interval_sec` | `30` | Health report interval |
   | `data_dir` | `/var/lib/classpulse` | Credentials and the upload buffer |
   | `min_free_disk_mb` | `500` | Below this, new recordings are refused and the device reports an error |
   | `allow_insecure_http` | `false` | Allows `http://` URLs. Use it for local development only. |
   | `audio_source` | `{"type":"arecord"}` | Or `{"type":"file","path":"/path/x.wav","realtime":true}` to feed a 16 kHz mono 16-bit WAV instead of the microphone (CI and demos) |

4. Start the agent with `sudo systemctl restart classpulse-agent`. On first start it registers with
   the token and saves its device key to `/var/lib/classpulse/credentials.json` (mode 0600). The device
   then shows as **online** in Admin › Devices.

To **move a device to another room** or **replace a revoked key**, put a *new* enrollment token in
`agent.json` and restart. The agent re-registers, and the old key stops working. The server never
hands out an existing key again.

## How it works

| Thread | Job |
|---|---|
| heartbeat | Every 30 s, sends status, mic, CPU temperature/usage, memory, free disk and upload backlog |
| commands | Long-polls `GET /api/devices/me/commands?wait=25` for `start_recording` / `stop_recording` and acknowledges each one. Redelivered commands are handled idempotently. |
| recorder | Runs `arecord -f S16_LE -r 16000 -c 1 -t raw` and writes `buffer/<session>/<idx>.pcm` plus `manifest.json` (SHA-256 per chunk). If arecord dies (for example, the mic is unplugged), it restarts and reports `micOk=false`. |
| uploader | Asks the server which chunks it already has and PUTs the missing ones with `X-Chunk-SHA256`. Retries use exponential backoff with jitter. A chunk is deleted locally only after a 2xx response. Once the session is stopped and drained, it calls `finalize`. |

The agent survives reboots and restarts:
- A class that was still recording is resumed into the same session.
- Stopped sessions finish uploading.
- Sessions the server has cancelled are discarded.

`SIGTERM` (systemctl stop) flushes the partial chunk and keeps the buffer.

## Operations

```bash
journalctl -u classpulse-agent -f          # live logs (one key=value line per event)
journalctl -u classpulse-agent --since today | grep level=error
systemctl status classpulse-agent
ls /var/lib/classpulse/buffer/              # sessions still waiting to upload
```

## Troubleshooting

| Symptom | Check |
|---|---|
| Device stays **offline** | `journalctl -u classpulse-agent`. Check DNS, HTTPS reachability (`curl -I https://<server>/api/health/live`) and the clock (`timedatectl`; TLS fails if the clock is wrong). |
| `Registration refused` | The token was already used or expired. Issue a new one in Admin › Devices. |
| `Device key rejected (revoked?)` | An admin revoked the device. Provision it again with a new token. |
| `micOk=false` / "No microphone detected" | Run `arecord -l` and reseat the USB mic. Check that `alsa_device` uses the card name. Check that the `classpulse` user is in `audio` (`id classpulse`). |
| Start fails with "Not enough free disk space" | Free space or let the backlog upload. Buffered audio is never deleted automatically. |
| Backlog keeps growing | Uploads are failing. Look for `Upload retry scheduled` errors and check bandwidth (about 2 MB per minute of audio). |
| `server is missing chunks … already uploaded` | Server-side data loss. Ask the teacher to upload the class audio file manually. |

## Development

```bash
python -m pytest apps/classroom-agent/tests -q    # or: python -m unittest discover -s apps/classroom-agent/tests
```

To run against a local API with a WAV file instead of a microphone:

```json
{
  "server_url": "http://localhost:5000",
  "allow_insecure_http": true,
  "device_id": "dev-pi-1",
  "enrollment_token": "<token from Admin › Devices>",
  "data_dir": "./.agent-data",
  "audio_source": { "type": "file", "path": "lecture-16k-mono.wav", "realtime": false }
}
```

```bash
ffmpeg -i lecture.mp3 -ar 16000 -ac 1 -c:a pcm_s16le lecture-16k-mono.wav
python apps/classroom-agent/agent.py --config ./agent.dev.json
```
