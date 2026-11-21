#!/bin/bash
set -euo pipefail
cd client
adb install -r -t app/build/outputs/apk/debug/app-debug.apk
adb install -r -t app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
if [ -f fixture/build/outputs/apk/debug/fixture-debug.apk ]; then
  adb install -r -t fixture/build/outputs/apk/debug/fixture-debug.apk
fi
adb shell input keyevent KEYCODE_WAKEUP
adb shell wm dismiss-keyguard
mkdir -p ../regression-evidence
evidence=../regression-evidence/device.txt
adb shell getprop ro.build.version.sdk | tr -d '\r' | tee "$evidence"
test "$(head -1 "$evidence")" = "$API_LEVEL"
log=../regression-evidence/nota.txt
case "$EDITION" in
  3d) timeout 360s adb shell am instrument -w -e phase nota com.nth.desktop3d.test/com.nth.desktop3d.test.SmokeInstrumentation | tee "$log" ;;
  ten) timeout 360s adb shell am instrument -w com.nthexperience.desktop.ten.test/com.nthexperience.desktop.TenChatSmoke | tee "$log" ;;
  eleven) timeout 360s adb shell am instrument -w com.nthexperience.desktop.eleven.test/com.nthexperience.desktop.ElevenChatSmoke | tee "$log" ;;
  *) exit 2 ;;
esac
grep -Eq 'PASS:|OK \(nota integration test\)' "$log"
if grep -Eq 'FAIL:|shortMsg=|Process crashed|INSTRUMENTATION_FAILED' "$log"; then exit 1; fi
