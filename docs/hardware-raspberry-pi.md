# Classroom hardware: Raspberry Pi 5 recorder

This is the single source of truth for the classroom device. It replaces older notes that described a Pi Zero, WebSocket streaming, or "zero audio retention".

## Bill of materials (per classroom)

| Item | Notes |
|---|---|
| Raspberry Pi 5 (4 GB) | 2 GB is enough. 4 GB leaves headroom for OS updates. |
| Official 27 W USB-C PSU | Under-voltage causes USB microphone dropouts. |
| 32 GB+ A2 microSD (or NVMe HAT) | Holds the local audio buffer. One hour of audio is about 115 MB. |
| Active cooler or case with fan | Keeps the CPU below 70 °C. The heartbeat reports the temperature. |
| USB boundary/conference microphone | Any UAC-compliant USB mic. It must support 16 kHz mono capture (most do, via ALSA resampling). |
| Network | Campus Wi-Fi or Ethernet. Ethernet is preferred where possible. |

## How it works

- The agent is a Python 3 program that uses only the standard library, so there is nothing to `pip install` on the Pi. It runs under systemd.
- **Outbound HTTPS only.** The Pi never accepts inbound connections, so no port forwarding is needed. It polls the server for commands.
- **Teacher-controlled.** A recording starts when a teacher presses **Start recording** in `/teacher/record` and stops when they press **Stop**.
- **Audio format.** `arecord -f S16_LE -r 16000 -c 1` (raw PCM), split into 60-second chunks with a sha256 hash for each.
- **Resilient.**
  - Chunks are written to `/var/lib/classpulse/buffer` before they are uploaded.
  - If the network drops, recording continues, and the uploader resumes from the server's list of received chunks.
  - A chunk is deleted locally only after the server confirms it.
- **Health.** A heartbeat every 30 seconds reports mic status, CPU temperature and load, memory, free disk and upload backlog. All of this is shown in **Admin → Classroom devices**. A device with no heartbeat for 90 seconds is shown as offline.
- **Disk guard.** If free space drops below `min_free_disk_mb`, the Pi refuses to start new recordings and reports the reason. It never deletes chunks that haven't been uploaded.

## Provisioning a device

1. Flash **Raspberry Pi OS Lite (64-bit, Bookworm)** with Raspberry Pi Imager. Set the hostname (for example `cp-room-101`), Wi-Fi and SSH keys.
2. Connect the USB mic, then find its ALSA name:
   ```bash
   arecord -l                      # e.g. card 2: Device [USB Audio Device], device 0
   arecord -D plughw:2,0 -f S16_LE -r 16000 -c 1 -d 5 /tmp/test.wav && aplay /tmp/test.wav
   ```
3. In the web app, go to **Admin → Classroom devices → Add classroom device**. Pick the room and give the device a name. Copy the **enrollment token**. It can be used once and expires after 24 hours.
4. On the Pi:
   ```bash
   sudo apt update && sudo apt install -y python3 alsa-utils
   git clone <repo> /tmp/classpulse && cd /tmp/classpulse/apps/classroom-agent
   sudo ./install.sh
   sudo nano /etc/classpulse/agent.json
   ```
   Set the following in `/etc/classpulse/agent.json`:
   ```json
   {
     "server_url": "https://app.school.org",
     "device_id": "rpi5-room-101",
     "enrollment_token": "<token from step 3>",
     "alsa_device": "plughw:2,0"
   }
   ```
   If the campus network inspects TLS with its own certificate authority, also set `"ca_file": "/etc/classpulse/campus-ca.pem"`. TLS verification is never disabled.
5. `sudo systemctl enable --now classpulse-agent && journalctl -u classpulse-agent -f`. The device registers and then shows as **online** in the admin console. The enrollment token is consumed, and the device key is stored in `/var/lib/classpulse/credentials.json` (mode 0600).

To **replace or re-provision** a Pi: revoke the old device in the admin console, then issue a new token for the room.

## Network requirements

- Outbound TCP 443 to the ClassPulse domain, plus DNS and NTP. Accurate time matters for TLS.
- Bandwidth: each 60-second chunk is about 1.9 MB, which averages about 32 KB/s while recording. Buffered chunks catch up after an outage.
- Captive-portal Wi-Fi is **not** supported. Ask campus IT for a device network, or use Ethernet.

## Troubleshooting

| Symptom | Check |
|---|---|
| Device shows offline | `systemctl status classpulse-agent`, `journalctl -u classpulse-agent -n 100`. Check DNS and time sync (`timedatectl`) and run `curl -I https://<domain>/api/health/live`. |
| Mic not OK | `arecord -l`. Check `alsa_device` in the config. Reseat the USB mic. Try `plughw:` instead of `hw:`. |
| Upload backlog keeps growing | Network throughput. Check that the heartbeat's `lastError` doesn't show an expired key. |
| `401` errors in the log | The device was revoked. Re-provision it with a new enrollment token. |
| Recording never starts | The teacher must pick the section whose room has this device. Commands expire after 2 minutes if not picked up. |

## Updating the agent

```bash
cd /tmp/classpulse && git pull && cd apps/classroom-agent && sudo ./install.sh && sudo systemctl restart classpulse-agent
```

The agent finishes uploading any buffered chunks after a restart.
