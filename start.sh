#!/usr/bin/env bash
# =============================================================================
#  NOVA CASINO — One-shot installer & launcher  (run from the cloned repo)
#
#  Installs Node, deps, a systemd autostart service, an nginx HTTPS reverse
#  proxy on port 524, AND an auto-updater that pulls new commits from GitHub
#  every 2 minutes and redeploys automatically.
#
#  Recommended server setup:
#     sudo git clone https://github.com/DtheGCoder/Nova-Games.git /opt/nova-games
#     cd /opt/nova-games
#     sudo bash start.sh
#
#  Re-running is safe & idempotent. To update manually: git pull && sudo bash start.sh
#  (or just wait ~2 min for the auto-updater after you push to GitHub).
# =============================================================================
set -euo pipefail

# ----------------------------- CONFIG ----------------------------------------
DOMAIN="anonymchat.digital"
HTTPS_PORT="524"
APP_PORT="3524"
APP_NAME="nova-blackjack"          # systemd service id
DATA_DIR="/var/lib/nova-games"     # runtime data (accounts/sessions) — outside git
SERVICE_USER="www-data"
UPDATE_INTERVAL="2min"             # auto-update check interval
CERT_FULLCHAIN="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
CERT_PRIVKEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
# Admin bootstrap (created on first run if missing; always flagged admin):
ADMIN_USER="${ADMIN_USER:-Damian}"
ADMIN_PW="${ADMIN_PW:-0815}"
# -----------------------------------------------------------------------------

C_G='\033[1;32m'; C_Y='\033[1;33m'; C_R='\033[1;31m'; C_B='\033[1;36m'; C_0='\033[0m'
log()  { echo -e "${C_G}▶${C_0} $*"; }
warn() { echo -e "${C_Y}⚠${C_0} $*"; }
err()  { echo -e "${C_R}✖${C_0} $*" >&2; }
step() { echo -e "\n${C_B}━━ $* ━━${C_0}"; }

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # run directly from the repo

# ----------------------------- 0. checks -------------------------------------
step "Prüfungen"
[[ "${EUID}" -ne 0 ]] && { err "Bitte als root:  sudo bash start.sh"; exit 1; }
command -v nginx >/dev/null 2>&1 || { err "nginx nicht installiert."; exit 1; }
log "App-Verzeichnis: ${APP_DIR}"

if [[ ! -f "${CERT_FULLCHAIN}" ]]; then
  warn "Zertifikat nicht unter ${CERT_FULLCHAIN}"
  FOUND="$(find /etc/letsencrypt/live -maxdepth 2 -name fullchain.pem 2>/dev/null | head -n1 || true)"
  if [[ -n "${FOUND}" ]]; then CERT_FULLCHAIN="${FOUND}"; CERT_PRIVKEY="$(dirname "${FOUND}")/privkey.pem"; log "Zertifikat: ${CERT_FULLCHAIN}";
  else err "Kein Let's-Encrypt-Zertifikat gefunden."; exit 1; fi
fi

# ----------------------------- 1. packages -----------------------------------
step "Pakete (Node.js, git)"
PKG=""
command -v apt-get >/dev/null 2>&1 && PKG=apt
command -v dnf     >/dev/null 2>&1 && PKG=dnf
NODE_OK=0
if command -v node >/dev/null 2>&1; then
  [[ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -ge 18 ]] && { NODE_OK=1; log "Node $(node -v) vorhanden"; }
fi
if [[ "${NODE_OK}" -ne 1 ]]; then
  log "Installiere Node.js 20 LTS …"
  if [[ "$PKG" == apt ]]; then curl -fsSL https://deb.nodesource.com/setup_20.x | bash -; apt-get install -y nodejs;
  elif [[ "$PKG" == dnf ]]; then curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -; dnf install -y nodejs;
  else err "Kein apt/dnf. Node 18+ manuell installieren."; exit 1; fi
fi
if ! command -v git >/dev/null 2>&1; then
  log "Installiere git …"
  [[ "$PKG" == apt ]] && apt-get install -y git
  [[ "$PKG" == dnf ]] && dnf install -y git
fi
git config --global --add safe.directory "${APP_DIR}" 2>/dev/null || true

# ----------------------------- 2. deps + data --------------------------------
step "Abhängigkeiten & Datenverzeichnis"
( cd "${APP_DIR}" && npm install --omit=dev --no-audit --no-fund )
mkdir -p "${DATA_DIR}"
chown -R "${SERVICE_USER}:${SERVICE_USER}" "${DATA_DIR}"
log "Daten unter ${DATA_DIR} (Backups: dieses Verzeichnis sichern)"

# ----------------------------- 3. service ------------------------------------
step "systemd-Dienst (Autostart)"
cat > "/etc/systemd/system/${APP_NAME}.service" <<EOF
[Unit]
Description=NOVA Casino multiplayer server
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${APP_PORT}
Environment=DATA_DIR=${DATA_DIR}
Environment=ADMIN_USER=${ADMIN_USER}
Environment=ADMIN_PW=${ADMIN_PW}
ExecStart=$(command -v node) ${APP_DIR}/server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ReadWritePaths=${DATA_DIR}

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable "${APP_NAME}" >/dev/null 2>&1 || true
systemctl restart "${APP_NAME}"
sleep 1
systemctl is-active --quiet "${APP_NAME}" \
  && log "Dienst läuft & startet beim Boot" \
  || { err "Dienst startet nicht:  journalctl -u ${APP_NAME} -n 40"; exit 1; }

# ----------------------------- 4. auto-updater -------------------------------
step "Auto-Updater (alle ${UPDATE_INTERVAL})"
install -m 0755 "${APP_DIR}/update.sh" /usr/local/bin/nova-update.sh
cat > "/etc/systemd/system/${APP_NAME}-update.service" <<EOF
[Unit]
Description=NOVA Casino auto-update from GitHub
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
Environment=REPO_DIR=${APP_DIR}
Environment=SERVICE=${APP_NAME}
ExecStart=/usr/local/bin/nova-update.sh
EOF
cat > "/etc/systemd/system/${APP_NAME}-update.timer" <<EOF
[Unit]
Description=Check GitHub for NOVA Casino updates every ${UPDATE_INTERVAL}

[Timer]
OnBootSec=${UPDATE_INTERVAL}
OnUnitActiveSec=${UPDATE_INTERVAL}
AccuracySec=15s
Persistent=true

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now "${APP_NAME}-update.timer" >/dev/null 2>&1 || true
log "Auto-Update aktiv — neue GitHub-Commits sind in ≤ ${UPDATE_INTERVAL} live"

# ----------------------------- 5. nginx --------------------------------------
step "nginx HTTPS-Proxy auf Port ${HTTPS_PORT}"
if [[ -d /etc/nginx/sites-available && -d /etc/nginx/sites-enabled ]]; then
  NGINX_CONF="/etc/nginx/sites-available/${APP_NAME}.conf"; NGINX_LINK="/etc/nginx/sites-enabled/${APP_NAME}.conf"
else NGINX_CONF="/etc/nginx/conf.d/${APP_NAME}.conf"; NGINX_LINK=""; fi
cat > "${NGINX_CONF}" <<EOF
# Managed by NOVA installer — isolated file, does not touch other sites.
server {
    listen ${HTTPS_PORT} ssl;
    listen [::]:${HTTPS_PORT} ssl;
    http2 on;
    server_name ${DOMAIN};

    ssl_certificate     ${CERT_FULLCHAIN};
    ssl_certificate_key ${CERT_PRIVKEY};
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header Referrer-Policy strict-origin-when-cross-origin;
    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 90s;
    }
}
EOF
[[ -n "${NGINX_LINK}" ]] && ln -sf "${NGINX_CONF}" "${NGINX_LINK}"
if nginx -t 2>/tmp/nginx_test.log; then
  systemctl reload nginx; systemctl enable nginx >/dev/null 2>&1 || true
  log "nginx neu geladen (bestehende Seiten unberührt)"
else
  err "nginx-Test fehlgeschlagen — Änderung zurückgenommen:"; cat /tmp/nginx_test.log >&2
  rm -f "${NGINX_CONF}"; [[ -n "${NGINX_LINK}" ]] && rm -f "${NGINX_LINK}"; exit 1
fi

# ----------------------------- 6. firewall + cert hook -----------------------
step "Firewall & Cert-Renew-Hook"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow "${HTTPS_PORT}/tcp" >/dev/null 2>&1 || true; log "ufw: Port ${HTTPS_PORT} frei"
elif command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port="${HTTPS_PORT}/tcp" >/dev/null 2>&1 || true; firewall-cmd --reload >/dev/null 2>&1 || true; log "firewalld: Port ${HTTPS_PORT} frei"
else warn "Keine aktive Firewall erkannt — Port ${HTTPS_PORT}/tcp ggf. extern öffnen."; fi
if [[ -d /etc/letsencrypt ]]; then
  mkdir -p /etc/letsencrypt/renewal-hooks/deploy
  printf '#!/usr/bin/env bash\nsystemctl reload nginx\n' > "/etc/letsencrypt/renewal-hooks/deploy/reload-nginx-${APP_NAME}.sh"
  chmod +x "/etc/letsencrypt/renewal-hooks/deploy/reload-nginx-${APP_NAME}.sh"
fi

# ----------------------------- done ------------------------------------------
step "Fertig 🎉"
echo -e "${C_G}NOVA CASINO läuft!${C_0}"
echo -e "  ➜  ${C_B}https://${DOMAIN}:${HTTPS_PORT}${C_0}"
echo -e "  Admin-Login: ${C_Y}${ADMIN_USER}${C_0} / ${C_Y}${ADMIN_PW}${C_0}  (über Hub → Admin)"
echo
echo "Befehle:"
echo "  Status     : systemctl status ${APP_NAME}"
echo "  Logs       : journalctl -u ${APP_NAME} -f"
echo "  Updater    : systemctl list-timers ${APP_NAME}-update.timer"
echo "  Update-Log : tail -f /var/log/nova-update.log"
