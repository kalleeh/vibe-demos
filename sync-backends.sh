#!/usr/bin/env bash
set -euo pipefail

# sync-backends.sh — converges PocketBase backends on the shared Lightsail instance.
# Reads backends/config.json for server details and port assignments.
# Migrations live at <slug>/pb/pb_migrations/ (co-located with each demo).
#
# Usage: ./sync-backends.sh
# Idempotent — safe to run anytime.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$SCRIPT_DIR/backends/config.json"

if [ ! -f "$CONFIG" ]; then
  echo "ERROR: $CONFIG not found" >&2; exit 1
fi

# Parse server details
SERVER_HOST=$(jq -r '.server.host' "$CONFIG")
SERVER_DOMAIN=$(jq -r '.server.domain' "$CONFIG")
SSH="ssh $SERVER_HOST"

echo "==> Target: ${SERVER_HOST} (*.${SERVER_DOMAIN})"

# Get list of backends from config
BACKENDS=$(jq -r '.backends | to_entries[] | "\(.key) \(.value.port)"' "$CONFIG")

if [ -z "$BACKENDS" ]; then
  echo "No backends declared in $CONFIG — nothing to sync."
  exit 0
fi

# Build Caddyfile from config
CADDYFILE="*.${SERVER_DOMAIN} {\n  tls {\n    dns route53\n  }\n"

while IFS=' ' read -r SLUG PORT; do
  DEMO_PB_DIR="$SCRIPT_DIR/$SLUG/pb"

  echo "--- [$SLUG] port=$PORT ---"

  # Ensure demo has a pb/ directory
  if [ ! -d "$DEMO_PB_DIR" ]; then
    echo "  WARN: $SLUG/pb/ does not exist locally — skipping migrations rsync"
  else
    # Rsync migrations to server. /opt/pocketbase is owned by the pocketbase
    # user and rsync runs over ssh as the login user, so we (a) pre-create the
    # destination — rsync only creates the final path component, not missing
    # intermediates, which breaks the first-ever sync of a new backend — and
    # (b) write via "sudo rsync" so files land in the pocketbase-owned tree.
    # The provisioning block below re-chowns them to pocketbase:pocketbase.
    echo "  Syncing migrations..."
    $SSH "sudo mkdir -p /opt/pocketbase/${SLUG}/pb_migrations"
    rsync -avz --delete -e "ssh" --rsync-path="sudo rsync" \
      "$DEMO_PB_DIR/pb_migrations/" \
      "${SERVER_HOST}:/opt/pocketbase/${SLUG}/pb_migrations/"
  fi

  # Ensure backend is provisioned and running on server
  echo "  Ensuring instance is provisioned..."
  $SSH "sudo bash -s" <<EOF
    set -e
    mkdir -p /opt/pocketbase/${SLUG}/pb_migrations
    ln -sf /opt/pocketbase/pocketbase /opt/pocketbase/${SLUG}/pocketbase
    chown -R pocketbase:pocketbase /opt/pocketbase/${SLUG}

    # Systemd override for port
    mkdir -p /etc/systemd/system/pocketbase@${SLUG}.service.d
    cat > /etc/systemd/system/pocketbase@${SLUG}.service.d/port.conf <<UNIT
[Service]
ExecStart=
ExecStart=/opt/pocketbase/${SLUG}/pocketbase serve --http=127.0.0.1:${PORT}
UNIT

    systemctl daemon-reload
    systemctl enable pocketbase@${SLUG} --now
    systemctl restart pocketbase@${SLUG}
EOF
  echo "  ✓ pocketbase@${SLUG} running on port ${PORT}"

  # Add to Caddyfile
  CADDYFILE+="  @${SLUG} host ${SLUG}.${SERVER_DOMAIN}\n  handle @${SLUG} {\n    reverse_proxy localhost:${PORT}\n  }\n"

done <<< "$BACKENDS"

# Default handler for unknown subdomains
CADDYFILE+="  handle {\n    respond \"Not found\" 404\n  }\n}\n"

# Deploy Caddyfile
echo "==> Deploying Caddyfile..."
echo -e "$CADDYFILE" | $SSH "sudo tee /etc/caddy/Caddyfile > /dev/null && sudo systemctl reload caddy"

# Clean up orphaned backends (running on server but not in config)
echo "==> Checking for orphaned backends..."
RUNNING=$($SSH "systemctl list-units 'pocketbase@*' --no-legend 2>/dev/null | awk '{print \$1}' | sed 's/pocketbase@//;s/\.service//'")
for UNIT in $RUNNING; do
  if ! echo "$BACKENDS" | grep -q "^$UNIT "; then
    echo "  Removing orphaned backend: $UNIT"
    $SSH "sudo systemctl stop pocketbase@${UNIT} && sudo systemctl disable pocketbase@${UNIT}" 2>/dev/null || true
  fi
done

echo "==> Done. All backends synced."
