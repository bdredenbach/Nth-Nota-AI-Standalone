"""Wait for Android's permission/clipboard state transitions in the existing device tests."""
from pathlib import Path
tests = Path("app/src/androidTest/java")
p = next(tests.rglob("WeatherSmoke.java"))
c = p.read_text()
old = 'click("Use approximate location"); systemClick("While using the app");'
new = '''
                click("Use approximate location");
                long deadline = SystemClock.uptimeMillis()+15000;
                while (!SetupAccess.location(activity) && SystemClock.uptimeMillis()<deadline) {
                    android.view.accessibility.AccessibilityNodeInfo window = test.getUiAutomation().getRootInActiveWindow();
                    if (window != null) {
                        String owner = String.valueOf(window.getPackageName());
                        if (owner.endsWith(".permissioncontroller")) {
                            for (android.view.accessibility.AccessibilityNodeInfo node : window.findAccessibilityNodeInfosByViewId(owner+":id/permission_allow_foreground_only_button")) {
                                if (node.isEnabled()) node.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK);
                            }
                            for (android.view.accessibility.AccessibilityNodeInfo node : window.findAccessibilityNodeInfosByText("While using the app")) {
                                if (node.isEnabled()) node.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK);
                            }
                        }
                    }
                    SystemClock.sleep(100);
                }
                check(SetupAccess.location(activity),"Android did not grant approximate location");
'''
if c.count(old)!=1:raise RuntimeError("Location prompt moved")
p.write_text(c.replace(old,new))
p = next(tests.rglob("Nota096Smoke.java"))
c = p.read_text()
old='main(()->{android.content.ClipboardManager clipboard=(android.content.ClipboardManager)activity.getSystemService(Context.CLIPBOARD_SERVICE);check(clipboard.hasPrimaryClip()&&code.contentEquals(clipboard.getPrimaryClip().getItemAt(0).getText()),"Code copy lost its whitespace or contents");});'
new='''await(()->{
            android.content.ClipboardManager clipboard=activity.getSystemService(android.content.ClipboardManager.class);
            android.content.ClipData clip=clipboard.getPrimaryClip();
            return clip!=null && clip.getItemCount()>0 && code.contentEquals(clip.getItemAt(0).getText());
        },"Code copy lost its whitespace or contents");'''
if c.count(old)!=1:raise RuntimeError("Clipboard check moved")
p.write_text(c.replace(old,new))

p = next(tests.rglob("Nota096Smoke.java"))
c = p.read_text()
old='main(()->button("Copy code").performClick());'
new='''await(()->activity.hasWindowFocus()
            && !activity.getWindow().getDecorView().getRootWindowInsets().isVisible(android.view.WindowInsets.Type.ime()),
            "Chat did not regain focus after keyboard closed");
        main(()->button("Copy code").performClick());'''
if c.count(old)!=1:raise RuntimeError("Copy code button moved")
p.write_text(c.replace(old,new))
