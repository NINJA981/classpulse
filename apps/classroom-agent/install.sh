#!/usr/bin/env bash
# Install / upgrade the ClassPulse classroom agent on Raspberry Pi OS (Bookworm).
# Usage: sudo ./install.sh
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root: sudo $0" >&2
  exit 1
fi

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR=/opt/classpulse-agent
CONF_DIR=/etc/classpulse
DATA_DIR=/var/lib/classpulse
UNIT=/etc/systemd/system/classpulse-agent.service

command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 1; }
python3 - <<'PY' || { echo "Python 3.11+ is required" >&2; exit 1; }
import sys
sys.exit(0 if sys.version_info >= (3, 11) else 1)
PY
command -v arecord >/dev/null || { echo "Installing alsa-utils (arecord)…"; apt-get update -qq && apt-get install -y -qq alsa-utils; }

# Dedicated unprivileged system user, allowed to use the sound card.
if ! id classpulse >/dev/null 2>&1; then
  useradd --system --home-dir "$DATA_DIR" --no-create-home --shell /usr/sbin/nologin --gid audio classpulse
fi
usermod -a -G audio classpulse

install -d -m 0755 "$APP_DIR"
install -m 0755 "$SRC_DIR/agent.py" "$APP_DIR/agent.py"
install -m 0644 "$SRC_DIR/README.md" "$APP_DIR/README.md"

install -d -m 0750 -o root -g audio "$CONF_DIR"
if [[ ! -f "$CONF_DIR/agent.json" ]]; then
  install -m 0640 -o root -g audio "$SRC_DIR/agent.example.json" "$CONF_DIR/agent.json"
  CONFIG_CREATED=1
fi

install -d -m 0750 -o classpulse -g audio "$DATA_DIR" "$DATA_DIR/buffer"

install -m 0644 "$SRC_DIR/classpulse-agent.service" "$UNIT"
systemctl daemon-reload
systemctl enable classpulse-agent.service >/dev/null

echo
echo "ClassPulse agent installed to $APP_DIR."
echo
echo "Next steps:"
if [[ "${CONFIG_CREATED:-0}" == 1 ]]; then
  echo "  1. In ClassPulse: Admin > Devices > Add device, pick the room and copy the enrollment token."
  echo "  2. Edit $CONF_DIR/agent.json: set server_url, device_id, enrollment_token and alsa_device"
  echo "     (list microphones with: arecord -l)."
else
  echo "  1. Review $CONF_DIR/agent.json (existing config kept)."
  echo "  2. To move/re-provision the device, put a NEW enrollment token in the config."
fi
echo "  3. Test the microphone: sudo -u classpulse arecord -D <alsa_device> -f S16_LE -r 16000 -c 1 -d 5 /tmp/test.wav"
echo "  4. Start: systemctl restart classpulse-agent && journalctl -u classpulse-agent -f"
