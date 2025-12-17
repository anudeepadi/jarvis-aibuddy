#!/usr/bin/env bash
# Jarvis Voice Assistant - Auto-Start Installation Script (Linux)
# This script installs the systemd user service for Linux auto-start

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="jarvis.service"
SERVICE_SRC="$SCRIPT_DIR/$SERVICE_NAME"
SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_DEST="$SERVICE_DIR/$SERVICE_NAME"
LOG_DIR="$HOME/.local/share/jarvis/logs"

echo "Jarvis Auto-Start Installer (Linux)"
echo "===================================="
echo ""

# Check if systemd is available
if ! command -v systemctl &> /dev/null; then
    echo "Error: systemctl not found. This script requires systemd." >&2
    exit 1
fi

# Check if the service template exists
if [ ! -f "$SERVICE_SRC" ]; then
    echo "Error: Service template not found at $SERVICE_SRC" >&2
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "$REPO_ROOT/.venv" ]; then
    echo "Error: Virtual environment not found at $REPO_ROOT/.venv" >&2
    echo "Please run 'python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt' first" >&2
    exit 1
fi

# Create directories
mkdir -p "$LOG_DIR"
mkdir -p "$SERVICE_DIR"
echo "Log directory: $LOG_DIR"

# Make daemon script executable
chmod +x "$SCRIPT_DIR/jarvis-daemon.sh"
echo "Made jarvis-daemon.sh executable"

# Stop and disable existing service if present
systemctl --user stop jarvis.service 2>/dev/null || true
systemctl --user disable jarvis.service 2>/dev/null || true

# Generate the service file with actual paths
echo "Generating systemd service..."
sed -e "s|JARVIS_REPO_PATH|$REPO_ROOT|g" \
    -e "s|JARVIS_LOG_PATH|$LOG_DIR|g" \
    "$SERVICE_SRC" > "$SERVICE_DEST"

echo "Installed service to: $SERVICE_DEST"

# Reload systemd and enable the service
echo "Enabling service..."
systemctl --user daemon-reload
systemctl --user enable jarvis.service

echo ""
echo "Installation complete!"
echo ""
echo "Commands:"
echo "  Start now:    systemctl --user start jarvis"
echo "  Stop:         systemctl --user stop jarvis"
echo "  Status:       systemctl --user status jarvis"
echo "  Disable:      systemctl --user disable jarvis"
echo "  View logs:    tail -f $LOG_DIR/jarvis.log"
echo "  View errors:  tail -f $LOG_DIR/jarvis.error.log"
echo ""
echo "The service will automatically start when you log in."
echo ""
echo "Note: To run user services at boot without login, run:"
echo "  sudo loginctl enable-linger $USER"
