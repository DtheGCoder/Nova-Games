#!/usr/bin/env bash
# =============================================================================
#  NOVA — auto-updater.  Run by a systemd timer every 2 minutes (as root).
#  Checks GitHub for new commits on the tracked branch; if found, hard-resets
#  to the remote, reinstalls deps and restarts the service.  data/ and
#  node_modules/ are gitignored, so accounts & sessions survive updates.
# =============================================================================
set -euo pipefail

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
SERVICE="${SERVICE:-nova-blackjack}"
LOG="${LOG:-/var/log/nova-update.log}"
log() { echo "[$(date '+%F %T')] $*" >> "$LOG" 2>/dev/null || true; }

command -v git >/dev/null 2>&1 || { log "git not installed"; exit 0; }
git config --global --add safe.directory "$REPO_DIR" 2>/dev/null || true

BRANCH="$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"

# Fetch quietly; if the network/remote is down just try again next tick.
git -C "$REPO_DIR" fetch --quiet origin "$BRANCH" 2>/dev/null || { log "fetch failed"; exit 0; }

LOCAL="$(git -C "$REPO_DIR" rev-parse HEAD)"
REMOTE="$(git -C "$REPO_DIR" rev-parse "origin/$BRANCH" 2>/dev/null || echo "$LOCAL")"
[ "$LOCAL" = "$REMOTE" ] && exit 0   # already up to date

log "update $LOCAL -> $REMOTE on '$BRANCH'"
git -C "$REPO_DIR" reset --hard "origin/$BRANCH" >> "$LOG" 2>&1

# (Re)install only if package files changed or modules missing.
if [ ! -d "$REPO_DIR/node_modules" ] || ! git -C "$REPO_DIR" diff --quiet "$LOCAL" "$REMOTE" -- package.json package-lock.json; then
  log "npm install"
  npm --prefix "$REPO_DIR" install --omit=dev --no-audit --no-fund >> "$LOG" 2>&1 || log "npm install warning"
fi

# Propagate any improvement to this updater itself to the stable copy.
install -m 0755 "$REPO_DIR/update.sh" /usr/local/bin/nova-update.sh 2>/dev/null || true

systemctl restart "$SERVICE" >> "$LOG" 2>&1 || log "restart failed"
log "update complete -> $REMOTE"
