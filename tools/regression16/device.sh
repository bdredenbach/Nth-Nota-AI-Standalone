#!/bin/bash
set -eu
export QA_DIR="$PWD/regression-evidence"
mkdir -p "$QA_DIR"
adb shell 'getprop ro.build.version.sdk; getprop ro.build.version.release; getprop ro.build.fingerprint' | tee "$QA_DIR/device.txt"
test "$(adb shell getprop ro.build.version.sdk | tr -d '\r')" = 36
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell dumpsys package com.nth.notaai | grep -m2 -E 'versionCode|versionName' | tee -a "$QA_DIR/device.txt"
adb shell input keyevent KEYCODE_WAKEUP
adb shell wm dismiss-keyguard
connect(){
 adb shell am start -n com.nth.notaai/.MainActivity
 for _ in $(seq 1 90); do
  pid=$(adb shell pidof com.nth.notaai | tr -d '\r')
  if [ -n "$pid" ];then
   adb forward tcp:9227 "localabstract:webview_devtools_remote_$pid" >/dev/null
   if curl -fsS --max-time 2 http://127.0.0.1:9227/json/list 2>/dev/null | grep -q webSocketDebuggerUrl;then return 0;fi
  fi
  sleep 1
 done
 adb shell dumpsys webviewupdate
 return 1
}
failed=0
suite(){
 if python3 tools/regression16/exercise.py "$@" > "$QA_DIR/$1.log" 2>&1; then
  echo "$1 completed" | tee -a "$QA_DIR/suites.txt"
 else
  tail -12 "$QA_DIR/$1.log"
  echo "$1 failed" | tee -a "$QA_DIR/suites.txt"
  failed=1
 fi
}
connect
suite voice-final
adb exec-out screencap -p > "$QA_DIR/chat.png"
adb logcat -d -b crash > "$QA_DIR/crashes.txt"
exit "$failed"
