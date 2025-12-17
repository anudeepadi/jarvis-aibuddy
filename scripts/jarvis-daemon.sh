#!/usr/bin/env bash
# Jarvis Voice Assistant - Daemon Wrapper for launchd
# This script is designed to be called by launchd for auto-start

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$REPO_ROOT"

# Activate virtual environment
if [ -f .venv/bin/activate ]; then
    source .venv/bin/activate
else
    echo "Virtual environment not found at $REPO_ROOT/.venv" >&2
    exit 1
fi

# Set up Python path
export PYTHONPATH="$REPO_ROOT/src"

# Load environment variables from .env if it exists
if [ -f "$REPO_ROOT/.env" ]; then
    set -a
    source "$REPO_ROOT/.env"
    set +a
fi

# Run the daemon
exec python -m jarvis.daemon
