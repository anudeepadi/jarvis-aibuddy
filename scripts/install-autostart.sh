#!/usr/bin/env bash
# Jarvis Voice Assistant - Auto-Start Installation Script
# This script installs the launchd service for macOS auto-start

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
PLIST_NAME="com.jarvis.daemon.plist"
PLIST_SRC="$SCRIPT_DIR/$PLIST_NAME"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"
LOG_DIR="$HOME/.local/share/jarvis/logs"

echo "Jarvis Auto-Start Installer"
echo "==========================="
echo ""

# Check if the plist template exists
if [ ! -f "$PLIST_SRC" ]; then
    echo "Error: Plist template not found at $PLIST_SRC" >&2
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "$REPO_ROOT/.venv" ]; then
    echo "Error: Virtual environment not found at $REPO_ROOT/.venv" >&2
    echo "Please run 'python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt' first" >&2
    exit 1
fi

# Create log directory
mkdir -p "$LOG_DIR"
echo "Log directory: $LOG_DIR"

# Make daemon script executable
chmod +x "$SCRIPT_DIR/jarvis-daemon.sh"
echo "Made jarvis-daemon.sh executable"

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$HOME/Library/LaunchAgents"

# Unload existing service if present
if [ -f "$PLIST_DEST" ]; then
    echo "Unloading existing service..."
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
fi

# Generate the plist with actual paths
echo "Generating launchd plist..."
sed -e "s|JARVIS_REPO_PATH|$REPO_ROOT|g" \
    -e "s|JARVIS_LOG_PATH|$LOG_DIR|g" \
    "$PLIST_SRC" > "$PLIST_DEST"

echo "Installed plist to: $PLIST_DEST"

# Load the service
echo "Loading service..."
launchctl load "$PLIST_DEST"

echo ""
echo "Installation complete!"
echo ""
echo "Commands:"
echo "  Start now:    launchctl start com.jarvis.daemon"
echo "  Stop:         launchctl stop com.jarvis.daemon"
echo "  Unload:       launchctl unload ~/Library/LaunchAgents/$PLIST_NAME"
echo "  View logs:    tail -f $LOG_DIR/jarvis.log"
echo "  View errors:  tail -f $LOG_DIR/jarvis.error.log"
echo ""
echo "The service will automatically start when you log in."
