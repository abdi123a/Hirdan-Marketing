#!/bin/bash
# Start Metro so the Android emulator can reach it at 10.0.2.2:8081
set -euo pipefail
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools:$PATH"
export NODE_BINARY="${NODE_BINARY:-/opt/homebrew/bin/node}"
unset CI

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if curl -sf --max-time 1 http://127.0.0.1:8081/status >/dev/null; then
  echo "Metro already running on http://127.0.0.1:8081"
else
  echo "Starting Metro (keep this terminal open)..."
fi

if command -v adb >/dev/null && adb devices 2>/dev/null | grep -q $'device$'; then
  adb reverse tcp:8081 tcp:8081 >/dev/null || true
  echo "adb reverse tcp:8081 tcp:8081"
fi

# --lan binds all interfaces so the emulator's 10.0.2.2 can connect
exec npx expo start --port 8081 --lan
