# NOVA BLACKJACK 🃏

Professionelles Multiplayer-Blackjack — Mobile-First, animiert, mit Räumen,
Side Bets und Live-Wettbewerb. Node/Socket.IO-Backend + nginx-HTTPS-Proxy.

**Live-Ziel:** `https://anonymchat.digital:524`

---

## 🚀 Deployment (1 Befehl)

Den kompletten Ordner `blackjack/` auf den Linux-Server kopieren, dann:

```bash
cd blackjack
sudo bash start.sh
```

Das Skript macht **alles automatisch** und lässt deine bestehenden Seiten unangetastet:

| Schritt | Was passiert |
|---|---|
| Node.js | installiert Node 20 LTS, falls nicht vorhanden (≥18) |
| App | kopiert nach `/opt/nova-blackjack`, `npm install` |
| Autostart | `systemd`-Dienst `nova-blackjack` (Restart + Boot-Start) |
| HTTPS | neuer nginx-Server-Block auf **Port 524** mit deinem Let's-Encrypt-Cert |
| Sicherheit | nutzt vorhandenes Zertifikat, Security-Header, TLS 1.2/1.3 |
| Firewall | öffnet Port 524 (ufw/firewalld, falls aktiv) |
| Cert-Renew | Hook, der nginx nach Zertifikatserneuerung neu lädt |

> **Sicher für bestehende Seiten:** Es wird nur eine *eigene* Datei
> `…/nova-blackjack.conf` angelegt. Vorhandene nginx-Konfigs werden nie
> verändert. Schlägt `nginx -t` fehl, wird die neue Datei automatisch entfernt.

Übernimmt das Skript ein anderes Zertifikat/Domain? Oben in `start.sh` die
Variablen `DOMAIN`, `HTTPS_PORT`, `APP_PORT` anpassen.

---

## 🎮 Features

- **Accounts:** Registrierung mit Username + Passwort (kein E-Mail nötig),
  Login bleibt **30 Tage** gespeichert. Passwörter werden gehasht (scrypt).
- **Hub-Startseite:** alle Spiele gelistet (Blackjack & NOVA Quiz live, weitere „bald"),
  globale Geld-Rangliste, Profil mit Guthaben. Leicht um neue Spiele erweiterbar.
- **NOVA Quiz:** Multiplayer-Wissensquiz mit Einsätzen. **4 Spielmodi**, dynamisch mischbar:
  - **Quiz** (Multiple Choice), **Wahr/Falsch**, **Schätzen** (am nächsten dran gewinnt),
    **Top-Liste** (nenne so viele richtige wie möglich, z. B. „Top-Lebensmittel im Supermarkt").
  - Confidence-Wager pro Frage, Tempo-Bonus, Streak-Multiplikator, Power-ups (50:50 & 2×),
    Cash- oder Turnier-Modus mit Elimination.
  - **22 Kategorien**, ~530 Frage-Prompts + ~1.150 Top-Listen-Antworten (≈ 1.600 Fakten).
  - Inhalte in `questions.js` (Multiple Choice) und `quiz-content.js` (TF/Schätzen/Top-Listen),
    Engine in `quiz.js` — alles trivial erweiterbar (einfach Einträge ergänzen).
- **Zwei Modi pro Tisch:**
  - **Freies Spiel** — Spaß-Chips, kein Risiko, Rebuy erlaubt.
  - **Turnier (Elimination)** — Buy-in aus dem Guthaben in den Pot; wer auf
    0 Chips fällt, scheidet aus; **der letzte gewinnt den ganzen Pot**.
    Aufgeben (Forfeit) jederzeit möglich.
- **Räume** mit 4-stelligem Code + Einladungslink (`/#CODE`)
- **Profi-Regeln:** Hit · Stand · Double · Split (bis 4 Hände) · Surrender · Insurance
- **Side Bets:** Perfect Pairs (bis 25:1) · 21+3 (bis 100:1) — pro Raum schaltbar
- **Host-Einstellungen:** Decks, Dealer Soft-17, 3:2 / 6:5, Start-Chips, Min/Max,
  Timer, max. Spieler, Double-after-Split u. v. m.
- **Wettbewerb (live):** Chip-Leaderboard, Streaks, Rundengewinner,
  SVG-Emotes & Chat **während** des Spiels
- **100 % SVG-Grafik** (keine Emojis), sequentielles Karten-Dealing,
  Flip-Animationen, Konfetti, Web-Audio-Sounds, Haptik, Timer-Ring
- **Mobile-First**, läuft als PWA-artige Vollbild-App

### 💾 Daten / Persistenz
Accounts, Guthaben und Statistiken liegen als JSON unter
`/opt/nova-blackjack/data/` (`accounts.json`, `tokens.json`).
Für Backups einfach dieses Verzeichnis sichern. Es wird automatisch angelegt
und gehört dem Service-User `www-data` (vom Installer gesetzt).

---

## 🛠️ Befehle

```bash
systemctl status  nova-blackjack    # Status
journalctl -u     nova-blackjack -f # Live-Logs
systemctl restart nova-blackjack    # Neustart
sudo bash start.sh                  # Update (erneut ausführen)
```

## Lokal testen

```bash
npm install
PORT=3524 npm start
# http://localhost:3524
```

## Deinstallieren

```bash
sudo systemctl disable --now nova-blackjack
sudo rm /etc/systemd/system/nova-blackjack.service
sudo rm /etc/nginx/sites-{available,enabled}/nova-blackjack.conf 2>/dev/null
sudo rm /etc/nginx/conf.d/nova-blackjack.conf 2>/dev/null
sudo nginx -t && sudo systemctl reload nginx
sudo rm -rf /opt/nova-blackjack
```
