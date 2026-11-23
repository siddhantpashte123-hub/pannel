# OBSIDIAN // Native Bot Hosting Panel (Zero-Docker)

Ultra-premium, pitch-black **Bot Hosting Panel** engineered specifically for VPS environments where **Docker is not supported**. Runs natively on Ubuntu/Debian Linux on port **2222** with an interactive Admin Panel, multi-user client quotas, live WebSocket console, built-in file manager & code editor, and a 1-command interactive CLI manager.

## 1-Command VPS Install

Run this single command on your Ubuntu/Debian VPS:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/siddhantpashte123-hub/pannel/main/install.sh)
```

Or if you cloned this repo:

```bash
bash install.sh
```

Running it immediately opens the interactive manager:

```text
1 install
2 uninstall
3 logs
4 status
```

After installation, you can reopen the menu anytime by typing `panelctl`.

## Features

- **Zero Docker Required**: Native Linux child-process isolation (`setsid` / process groups), `/proc/<pid>` live CPU & RSS memory telemetry, and crash auto-restart.
- **Port 2222**: Single unified server serving both the API/WebSocket engine and the React UI on `http://<VPS_IP>:2222`.
- **Premium Pure-Black UI**: Pitch-black obsidian aesthetic where clicked/active icons illuminate crisp white with smooth spring animations.
- **Admin Panel**:
  - Create & manage client user accounts and quotas (`maxBots`, `role`, `status`).
  - Serve / provision new Node.js, Python 3, Bash, or custom bots to any user.
  - Real-time VPS host telemetry (CPU, Memory, Disk, OS, Kernel, Audit Logs).
- **Bot Control Center**:
  - Live WebSocket streaming console + interactive `stdin` input + Start / Restart / Stop / Kill controls.
  - One-click package installer (`npm install`, `pip3 install -r requirements.txt`).
  - Built-in File Manager with folder browsing, multi-file upload, and live code editor.
  - Startup command, runtime selector, and `.env` environment variable manager.

## Local Development

```bash
npm install
npm --prefix client install
npm --prefix client run build
npm start
```

Open `http://localhost:2222` (Default login: `admin` / `admin123`, configurable via `PANEL_ADMIN_USER` and `PANEL_ADMIN_PASS`).
