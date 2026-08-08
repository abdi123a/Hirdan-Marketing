#!/usr/bin/env bash
# Open Android Studio with Homebrew Node on PATH.
# Use this if Gradle sync fails with: Cannot run program "node"
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-/usr/bin:/bin}"
export NODE_BINARY="${NODE_BINARY:-$(command -v node)}"

# Prefer the Google Android Studio app name; fall back to JetBrains Toolbox naming.
if [[ -d "/Applications/Android Studio.app" ]]; then
  open -a "Android Studio" "$@"
elif [[ -d "/Applications/Android Studio Preview.app" ]]; then
  open -a "Android Studio Preview" "$@"
else
  echo "Android Studio.app not found in /Applications" >&2
  exit 1
fi
