#!/usr/bin/env bash
set -euo pipefail

# Kaburlu backend: safe production deploy helper (systemd)
# Usage: ./scripts/deploy-prod.sh /var/www/kaburlu-backend-v2 kaburlu
# Args:
#   $1 - app directory (default: /var/www/kaburlu-backend-v2)
#   $2 - systemd unit name (default: kaburlu)

APP_DIR="${1:-/var/www/kaburlu-backend-v2}"
UNIT="${2:-kaburlu}"

if [ ! -d "$APP_DIR/.git" ]; then
  echo "ERROR: $APP_DIR is not a git repo" >&2
  exit 1
fi

cd "$APP_DIR"
echo "[1/5] Fetching latest code..."
git fetch --all --prune
LATEST=$(git rev-parse --short origin/main)
CURR=$(git rev-parse --short HEAD)
echo "Current: $CURR  Remote: $LATEST"

echo "[2/5] Pulling fast-forward..."
git pull --ff-only

echo "[3/5] Installing production deps..."
export NODE_ENV=production
npm ci --omit=dev --no-audit

# Optional DB bootstrap if search_path issues were ever seen
# node scripts/db-bootstrap.js || true

echo "[4/5] Restarting systemd unit: $UNIT"
sudo systemctl restart "$UNIT"

echo "[5/5] Status:"
sudo systemctl status "$UNIT" --no-pager -n 100 || true

echo "Done. Tip: tail logs with: sudo journalctl -u $UNIT -n 200 -f"
