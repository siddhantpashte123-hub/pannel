#!/usr/bin/env bash
set -e

# ==============================================================================
#  OBSIDIAN // Native Bot Hosting Panel (Zero-Docker)
#  One-Command Interactive Installer & Manager (Port 2222)
# ==============================================================================

REPO_URL="${OBSIDIAN_REPO:-https://github.com/siddhantpashte123-hub/pannel.git}"
REPO_BRANCH="${OBSIDIAN_BRANCH:-main}"
INSTALL_DIR="/opt/obsidian-panel"
DATA_DIR="/var/lib/obsidian-panel"
LOG_FILE="/var/log/obsidian-panel.log"
PID_FILE="/var/run/obsidian-panel.pid"
SERVICE_NAME="obsidian-panel"
PANEL_PORT="2222"

# Monochrome Premium ANSI Colors
W="\033[1;37m"
G="\033[0;37m"
D="\033[0;90m"
GRN="\033[1;32m"
RED="\033[1;31m"
YLW="\033[1;33m"
NC="\033[0m"

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    echo -e "${RED}[ERROR] Please run as root or install sudo.${NC}"
    exit 1
  fi
fi

has_systemd() {
  [ "$(ps -p 1 -o comm= 2>/dev/null || true)" = "systemd" ] && command -v systemctl >/dev/null 2>&1
}

print_banner() {
  clear 2>/dev/null || true
  echo -e "${W}"
  echo "   ██████╗ ██████╗ ███████╗██╗██████╗ ██╗ █████╗ ███╗   ██╗"
  echo "  ██╔═══██╗██╔══██╗██╔════╝██║██╔══██╗██║██╔══██╗████╗  ██║"
  echo "  ██║   ██║██████╔╝███████╗██║██║  ██║██║███████║██╔██╗ ██║"
  echo "  ██║   ██║██╔══██╗╚════██║██║██║  ██║██║██╔══██║██║╚██╗██║"
  echo "  ╚██████╔╝██████╔╝███████║██║██████╔╝██║██║  ██║██║ ╚████║"
  echo "   ╚═════╝ ╚═════╝ ╚══════╝╚═╝╚═════╝ ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝"
  echo -e "${D}  ──────────────────────────────────────────────────────────${NC}"
  echo -e "${W}   PREMIUM BOT HOSTING PANEL  ${D}|  ${G}ZERO-DOCKER  ${D}|  ${W}PORT ${PANEL_PORT}${NC}"
  echo -e "${D}  ──────────────────────────────────────────────────────────${NC}"
  echo ""
}

get_public_ip() {
  local ip
  ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  if [ -z "$ip" ]; then
    ip="YOUR_VPS_IP"
  fi
  echo "$ip"
}

read_input() {
  local prompt="$1"
  local var_name="$2"
  if [ -e /dev/tty ]; then
    printf "%b" "$prompt" >/dev/tty
    IFS= read -r "$var_name" </dev/tty || true
  else
    printf "%b" "$prompt"
    IFS= read -r "$var_name" || true
  fi
}

install_system_deps() {
  echo -e "${W}[1/5] Checking OS & installing base packages (No Docker)...${NC}"
  $SUDO apt-get update -qq
  $SUDO apt-get install -y -qq curl git ca-certificates gnupg python3 python3-pip python3-venv lsof iproute2 >/dev/null 2>&1 || \
    $SUDO apt-get install -y curl git ca-certificates gnupg python3 python3-pip

  local need_node=0
  if ! command -v node >/dev/null 2>&1; then
    need_node=1
  else
    local major
    major=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "${major:-0}" -lt 18 ]; then
      need_node=1
    fi
  fi

  if [ "$need_node" -eq 1 ]; then
    echo -e "${W}      Installing Node.js 22 LTS...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO -E bash - >/dev/null 2>&1
    $SUDO apt-get install -y -qq nodejs >/dev/null 2>&1 || $SUDO apt-get install -y nodejs
  fi
  echo -e "${GRN}      Node $(node -v) & Python $(python3 --version 2>&1 | awk '{print $2}') ready.${NC}"
}

stop_panel_daemon() {
  if has_systemd && $SUDO systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    $SUDO systemctl stop "$SERVICE_NAME" || true
  fi
  if [ -f "$PID_FILE" ]; then
    local old_pid
    old_pid=$(cat "$PID_FILE" 2>/dev/null || true)
    if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
      kill "$old_pid" 2>/dev/null || true
      sleep 1
      kill -9 "$old_pid" 2>/dev/null || true
    fi
    $SUDO rm -f "$PID_FILE"
  fi
}

start_panel_daemon() {
  stop_panel_daemon
  if has_systemd; then
    $SUDO tee "/etc/systemd/system/${SERVICE_NAME}.service" >/dev/null <<EOF
[Unit]
Description=Obsidian Native Bot Hosting Panel
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=/usr/bin/env node ${INSTALL_DIR}/server/index.js
Restart=always
RestartSec=3
StandardOutput=append:${LOG_FILE}
StandardError=append:${LOG_FILE}

[Install]
WantedBy=multi-user.target
EOF
    $SUDO systemctl daemon-reload
    $SUDO systemctl enable --now "$SERVICE_NAME"
  else
    echo -e "${YLW}      Container/No-Systemd VPS detected — starting native background daemon...${NC}"
    $SUDO touch "$LOG_FILE"
    $SUDO bash -c "set -a; source '${INSTALL_DIR}/.env'; set +a; cd '${INSTALL_DIR}' && setsid nohup node server/index.js >> '${LOG_FILE}' 2>&1 < /dev/null & echo \$! > '${PID_FILE}'"
  fi
}

do_install() {
  echo -e "${W}Starting Obsidian Panel Installation on Port ${PANEL_PORT}...${NC}"
  echo ""

  install_system_deps

  echo -e "${W}[2/5] Deploying panel source to ${INSTALL_DIR}...${NC}"
  $SUDO mkdir -p "$INSTALL_DIR" "$DATA_DIR"
  $SUDO touch "$LOG_FILE"

  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || pwd)"

  if [ -f "${script_dir}/server/index.js" ] && [ -f "${script_dir}/client/package.json" ]; then
    echo -e "${D}      Copying from local repository (${script_dir})...${NC}"
    $SUDO tar --exclude='node_modules' --exclude='client/node_modules' --exclude='data' --exclude='.git' -cf - -C "$script_dir" . | $SUDO tar -xf - -C "$INSTALL_DIR"
  else
    echo -e "${D}      Cloning from ${REPO_URL} (${REPO_BRANCH})...${NC}"
    local tmp_dir="/tmp/obsidian-src-$$"
    rm -rf "$tmp_dir"
    git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$tmp_dir" || git clone --depth 1 "$REPO_URL" "$tmp_dir"
    $SUDO tar --exclude='.git' -cf - -C "$tmp_dir" . | $SUDO tar -xf - -C "$INSTALL_DIR"
    rm -rf "$tmp_dir"
  fi

  echo -e "${W}[3/5] Installing backend & building pitch-black frontend...${NC}"
  cd "$INSTALL_DIR"
  $SUDO npm install --omit=dev --no-audit --no-fund
  $SUDO npm --prefix client install --no-audit --no-fund
  $SUDO npm --prefix client run build

  echo -e "${W}[4/5] Configuring Admin credentials & Port ${PANEL_PORT}...${NC}"
  local admin_user admin_pass
  read_input "  Admin username [default: admin]: " admin_user
  admin_user="${admin_user:-admin}"
  read_input "  Admin password [default: admin123]: " admin_pass
  admin_pass="${admin_pass:-admin123}"

  $SUDO tee "${INSTALL_DIR}/.env" >/dev/null <<EOF
PORT=${PANEL_PORT}
HOST=0.0.0.0
PANEL_DATA_DIR=${DATA_DIR}
PANEL_ADMIN_USER=${admin_user}
PANEL_ADMIN_PASS=${admin_pass}
EOF
  $SUDO chmod 600 "${INSTALL_DIR}/.env"

  # Open firewall port if ufw is enabled
  if command -v ufw >/dev/null 2>&1 && $SUDO ufw status 2>/dev/null | grep -q "Status: active"; then
    $SUDO ufw allow "${PANEL_PORT}/tcp" >/dev/null 2>&1 || true
  fi

  # Install global panelctl command
  $SUDO cp "${INSTALL_DIR}/install.sh" /usr/local/bin/panelctl
  $SUDO chmod +x /usr/local/bin/panelctl

  echo -e "${W}[5/5] Starting Obsidian Panel on 0.0.0.0:${PANEL_PORT}...${NC}"
  start_panel_daemon
  sleep 2

  local ip
  ip=$(get_public_ip)
  echo ""
  echo -e "${D}  ──────────────────────────────────────────────────────────${NC}"
  if curl -fsS "http://127.0.0.1:${PANEL_PORT}/api/health" >/dev/null 2>&1; then
    echo -e "${GRN}  ✔ OBSIDIAN PANEL INSTALLED & RUNNING!${NC}"
  else
    echo -e "${YLW}  ⚠ Panel started — check 'panelctl' -> 3 logs if unreachable.${NC}"
  fi
  echo -e "${D}  ──────────────────────────────────────────────────────────${NC}"
  echo -e "  ${W}Panel URL :${NC} http://${ip}:${PANEL_PORT}"
  echo -e "  ${W}Username  :${NC} ${admin_user}"
  echo -e "  ${W}Password  :${NC} ${admin_pass}"
  echo -e "  ${W}CLI Menu  :${NC} panelctl  (1 install | 2 uninstall | 3 logs | 4 status)"
  echo -e "${D}  ──────────────────────────────────────────────────────────${NC}"
  echo ""
}

do_uninstall() {
  echo -e "${YLW}Uninstalling Obsidian Panel...${NC}"
  stop_panel_daemon

  if has_systemd; then
    $SUDO systemctl disable "$SERVICE_NAME" >/dev/null 2>&1 || true
    $SUDO rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
    $SUDO systemctl daemon-reload || true
  fi

  $SUDO rm -rf "$INSTALL_DIR"
  $SUDO rm -f /usr/local/bin/panelctl "$PID_FILE" "$LOG_FILE"

  local wipe_data
  read_input "  Delete all bot data in ${DATA_DIR}? [y/N]: " wipe_data
  if [[ "$wipe_data" =~ ^[Yy]$ ]]; then
    $SUDO rm -rf "$DATA_DIR"
    echo -e "${GRN}  ✔ Panel & all bot data completely removed.${NC}"
  else
    echo -e "${GRN}  ✔ Panel uninstalled. Bot data preserved in ${DATA_DIR}.${NC}"
  fi
}

do_logs() {
  echo -e "${W}Streaming Obsidian Panel logs (Ctrl+C to exit)...${NC}"
  echo ""
  if has_systemd && $SUDO systemctl list-unit-files | grep -q "^${SERVICE_NAME}.service"; then
    $SUDO journalctl -u "$SERVICE_NAME" -n 100 -f
  elif [ -f "$LOG_FILE" ]; then
    $SUDO tail -n 100 -f "$LOG_FILE"
  else
    echo -e "${RED}No log file found at ${LOG_FILE}. Is Obsidian Panel installed?${NC}"
  fi
}

do_status() {
  echo -e "${W}Obsidian Panel Status${NC}"
  echo -e "${D}────────────────────────────────────────────${NC}"

  local running=0
  local pid=""

  if has_systemd && $SUDO systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    running=1
    pid=$($SUDO systemctl show -p MainPID --value "$SERVICE_NAME" 2>/dev/null || true)
  elif [ -f "$PID_FILE" ]; then
    pid=$(cat "$PID_FILE" 2>/dev/null || true)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      running=1
    fi
  fi

  if [ "$running" -eq 0 ] && curl -fsS "http://127.0.0.1:${PANEL_PORT}/api/health" >/dev/null 2>&1; then
    running=1
    pid=$(pgrep -f "server/index.js" 2>/dev/null | head -n 1 || echo "active")
  fi

  if [ "$running" -eq 1 ]; then
    echo -e "  Service : ${GRN}ONLINE (ACTIVE)${NC}"
    echo -e "  PID     : ${W}${pid}${NC}"
  else
    echo -e "  Service : ${RED}OFFLINE (STOPPED)${NC}"
  fi

  if curl -fsS "http://127.0.0.1:${PANEL_PORT}/api/health" >/dev/null 2>&1; then
    echo -e "  Port    : ${GRN}${PANEL_PORT} LISTENING${NC}"
  else
    echo -e "  Port    : ${RED}${PANEL_PORT} NOT LISTENING${NC}"
  fi

  echo -e "  Engine  : ${W}Native Process Engine (Zero-Docker)${NC}"
  echo -e "  URL     : ${W}http://$(get_public_ip):${PANEL_PORT}${NC}"
  echo -e "${D}────────────────────────────────────────────${NC}"
}

show_menu() {
  print_banner
  echo -e "  ${W}1${NC} ${G}install${NC}"
  echo -e "  ${W}2${NC} ${G}uninstall${NC}"
  echo -e "  ${W}3${NC} ${G}logs${NC}"
  echo -e "  ${W}4${NC} ${G}status${NC}"
  echo ""
  local choice
  read_input "  ${W}Select option [1-4]: ${NC}" choice
  echo ""
  case "$choice" in
    1|install)
      do_install
      ;;
    2|uninstall)
      do_uninstall
      ;;
    3|logs)
      do_logs
      ;;
    4|status)
      do_status
      ;;
    *)
      echo -e "${RED}Invalid choice. Please enter 1, 2, 3, or 4.${NC}"
      exit 1
      ;;
  esac
}

case "${1:-}" in
  --install|install|1)
    print_banner
    do_install
    ;;
  --uninstall|uninstall|2)
    print_banner
    do_uninstall
    ;;
  --logs|logs|3)
    print_banner
    do_logs
    ;;
  --status|status|4)
    print_banner
    do_status
    ;;
  *)
    show_menu
    ;;
esac
