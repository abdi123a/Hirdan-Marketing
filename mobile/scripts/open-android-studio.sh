#!/bin/bash
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$PATH"
export NODE_BINARY="/opt/homebrew/bin/node"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"

# Prefer the real no-space project path
PROJECT_ROOT="/Users/abdihakim/Documents/Hirdanmarketing/hirdanmarketing"
if [ ! -d "$PROJECT_ROOT/mobile/android" ]; then
  PROJECT_ROOT="${HOME}/hirdanmarketing"
fi

osascript -e 'quit app "Android Studio"' 2>/dev/null || true
sleep 2
open -a "Android Studio" "$PROJECT_ROOT/mobile/android"
echo "Opened Android Studio at: $PROJECT_ROOT/mobile/android"
