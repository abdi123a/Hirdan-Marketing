#!/bin/bash
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$PATH"
export NODE_BINARY="/opt/homebrew/bin/node"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"

# Always open via the no-space symlink (NDK/CMake break on spaces in paths)
PROJECT_ROOT="${HOME}/hirdanmarketing"
if [ ! -d "$PROJECT_ROOT/mobile/android" ]; then
  ln -sfn "/Users/abdihakim/Documents/Hirdanmarketing/untitled folder/Agency/hirdanmarketing" "$PROJECT_ROOT"
fi

osascript -e 'quit app "Android Studio"' 2>/dev/null || true
sleep 2
open -a "Android Studio" "$PROJECT_ROOT/mobile/android"
echo "Opened Android Studio at: $PROJECT_ROOT/mobile/android"
