#!/usr/bin/env bash
# Jarvis Voice Assistant - Auto-Start Uninstallation Script
# This script removes the launchd service

set -euo pipefail

PLIST_NAME="com.jarvis.daemon.plist"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME"

echo "Jarvis Auto-Start Uninstaller"
echo "=============================="
echo ""

if [ ! -f "$PLIST_PATH" ]; then
    echo "Auto-start service is not installed."
    exit 0
fi

# Stop the service if running
echo "Stopping service..."
launchctl stop com.jarvis.daemon 2>/dev/null || true

# Unload the service
echo "Unloading service..."
launchctl unload "$PLIST_PATH" 2>/dev/null || true

# Remove the plist
echo "Removing plist..."
rm -f "$PLIST_PATH"

echo ""
echo "Auto-start service has been removed."
echo "Jarvis will no longer start automatically on login."
