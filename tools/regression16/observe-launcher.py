"""Capture layout diagnostics and recognize the system permission action by its resource ID."""
import os
from pathlib import Path

edition = os.environ["EDITION"]
tests = Path("app/src/androidTest/java")
if edition == "3d":
    target = next(tests.rglob("Trial093Support.java"))
    source = target.read_text()
    needle = "if(root!=null)for(AccessibilityNodeInfo node:root.findAccessibilityNodeInfosByText(text))"
    insert = '''
        if (root != null && "While using the app".equals(text)) {
            for (String owner : new String[]{"com.android.permissioncontroller", "com.google.android.permissioncontroller"}) {
                for (AccessibilityNodeInfo action : root.findAccessibilityNodeInfosByViewId(owner + ":id/permission_allow_foreground_only_button")) {
                    if (action.isEnabled() && action.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return;
                }
            }
            java.util.ArrayDeque<AccessibilityNodeInfo> pending = new java.util.ArrayDeque<>();
            pending.add(root);
            StringBuilder labels = new StringBuilder();
            while (!pending.isEmpty()) {
                AccessibilityNodeInfo node = pending.removeFirst();
                if (node.getText() != null) labels.append(node.getText()).append(" | ");
                for (int i=0; i<node.getChildCount(); i++) {
                    AccessibilityNodeInfo child=node.getChild(i);
                    if (child!=null) pending.add(child);
                }
            }
            android.util.Log.i("NotaQA", root.getPackageName() + " " + labels);
        }
        '''
elif edition == "ten":
    target = next(tests.rglob("TenChatSmoke.java"))
    source = target.read_text()
    needle = "if(!control.getGlobalVisibleRect(visible)||visible.height()!=control.getHeight()) return false;"
    insert = '''control.getGlobalVisibleRect(visible);
        android.util.Log.i("NotaQA", "control=" + control.getClass().getSimpleName()
            + " bounds=" + visible + " height=" + control.getHeight() + " screen=" + root.getWidth() + "x" + root.getHeight());
        '''
else:
    raise SystemExit(0)
if source.count(needle) != 1:
    raise RuntimeError("Expected a single matching assertion in " + str(target))
target.write_text(source.replace(needle, insert + needle))
