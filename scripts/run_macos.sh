#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -r requirements.txt

# Build Swift capture helper (scaffold)
if [ -d mac/CaptureCLI ]; then
  (cd mac/CaptureCLI && swift build -c release)
fi

export PYTHONPATH="$REPO_ROOT/src"
# Allow override via JARVIS_CONFIG_PATH; otherwise use default search path in code
export JARVIS_VOICE_DEBUG=${JARVIS_VOICE_DEBUG:-0}
# Suppress deprecation warning from webrtcvad's use of pkg_resources
export PYTHONWARNINGS="ignore::UserWarning:webrtcvad"

# Start Next.js frontend
FRONTEND_DIR="$REPO_ROOT/web-next"
if [ -d "$FRONTEND_DIR" ]; then
  echo "🌐 Starting frontend server..."
  cd "$FRONTEND_DIR"
  if [ ! -d node_modules ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
  fi
  npm run dev -- -p 3001 &
  FRONTEND_PID=$!
  cd "$REPO_ROOT"

  # Cleanup frontend on exit
  cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    if [ -n "${FRONTEND_PID:-}" ]; then
      kill $FRONTEND_PID 2>/dev/null || true
    fi
  }
  trap cleanup EXIT INT TERM

  echo "✅ Frontend running at http://localhost:3001"

  # Keep script running until interrupted
  wait $FRONTEND_PID
fi
