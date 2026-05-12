#!/bin/bash
# Build the Nomadly SMS APK from /app/sms-app — follows the verified
# aarch64-pod sequence in /app/sms-app/README.md.
set -euo pipefail
exec > /tmp/apk_build.log 2>&1

echo "=== STAGE 0: starting at $(date -u +%FT%TZ) on $(uname -m) ==="

export ANDROID_SDK_ROOT=/opt/android-sdk
export ANDROID_HOME=$ANDROID_SDK_ROOT
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-arm64
export PATH="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$JAVA_HOME/bin:$PATH"

# Idempotency: skip work that's already done.
echo "=== STAGE 1: apt deps ==="
if ! command -v javac >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq openjdk-17-jdk-headless unzip curl
else
  echo "java already present: $(java -version 2>&1 | head -1)"
fi

echo "=== STAGE 2: cmdline-tools + platform-34 + build-tools 34.0.0 ==="
if [ ! -x "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]; then
  mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools"
  curl -sSL -o /tmp/cmdtools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
  unzip -q -o /tmp/cmdtools.zip -d "$ANDROID_SDK_ROOT/cmdline-tools/"
  if [ -d "$ANDROID_SDK_ROOT/cmdline-tools/cmdline-tools" ]; then
    rm -rf "$ANDROID_SDK_ROOT/cmdline-tools/latest"
    mv "$ANDROID_SDK_ROOT/cmdline-tools/cmdline-tools" "$ANDROID_SDK_ROOT/cmdline-tools/latest"
  fi
else
  echo "cmdline-tools already present"
fi

if [ ! -d "$ANDROID_SDK_ROOT/platforms/android-34" ] || [ ! -d "$ANDROID_SDK_ROOT/build-tools/34.0.0" ]; then
  yes | sdkmanager --licenses > /dev/null 2>&1 || true
  sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
else
  echo "platform-34 + build-tools 34.0.0 already installed"
fi

echo "=== STAGE 3: native-aarch64 aapt2 ==="
# android/gradle.properties has android.aapt2FromMavenOverride=/opt/aapt2-dir/aapt2
# (note the `-dir` suffix — historical naming). README documents /opt/aapt2/.
# We deploy to BOTH paths so either configuration works.
AAPT2_PATHS=("/opt/aapt2/aapt2" "/opt/aapt2-dir/aapt2")
need_install=0
for p in "${AAPT2_PATHS[@]}"; do
  if [ ! -x "$p" ] || ! "$p" version >/dev/null 2>&1; then need_install=1; fi
done
if [ "$need_install" = "1" ]; then
  curl -sSL -o /tmp/sdk-aarch64.zip \
    https://github.com/lzhiyong/sdk-tools/releases/latest/download/android-sdk-tools-static-aarch64.zip
  mkdir -p /tmp/aarch64 && rm -rf /tmp/aarch64/*
  unzip -o -q /tmp/sdk-aarch64.zip -d /tmp/aarch64
  for p in "${AAPT2_PATHS[@]}"; do
    mkdir -p "$(dirname "$p")"
    cp /tmp/aarch64/build-tools/aapt2 "$p"
    chmod +x "$p"
    echo "Installed $p: $($p version)"
  done
else
  for p in "${AAPT2_PATHS[@]}"; do echo "$p OK: $($p version)"; done
fi

echo "=== STAGE 4: cap sync + gradle assembleDebug ==="
cd /app/sms-app
if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund --silent
fi
echo "sdk.dir=$ANDROID_SDK_ROOT" > android/local.properties
npx cap sync android
cd android
./gradlew assembleDebug --no-daemon

echo "=== STAGE 5: deploy APK ==="
APK=app/build/outputs/apk/debug/app-debug.apk
ls -la "$APK"
mkdir -p /app/backend/static /app/static
cp "$APK" /app/backend/static/nomadly-sms.apk
cp "$APK" /app/static/nomadly-sms.apk
echo "Deployed:"
ls -la /app/backend/static/nomadly-sms.apk /app/static/nomadly-sms.apk

echo "=== STAGE 6: sanity-check baked URL in the APK ==="
mkdir -p /tmp/apk_inspect && rm -rf /tmp/apk_inspect/*
unzip -o -q /app/backend/static/nomadly-sms.apk -d /tmp/apk_inspect
grep -oE "https?://[a-zA-Z0-9./_-]+" /tmp/apk_inspect/assets/public/js/api.js | sort -u || true

echo "=== DONE at $(date -u +%FT%TZ) ==="
