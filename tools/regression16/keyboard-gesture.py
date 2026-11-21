"""Tap the actual composer after snap and capture its window and screen bounds."""
from pathlib import Path

target = next(Path("app/src/androidTest/java").rglob("ElevenChatSmoke.java"))
source = target.read_text()
old='ui(()->{chat().web.performClick();chat().question.requestFocus();home.getSystemService(InputMethodManager.class).showSoftInput(chat().question,InputMethodManager.SHOW_IMPLICIT);});'
new='''
        ui(()->chat().web.performClick());
        waitForIdleSync();
        final Rect visible = new Rect();
        ui(()->{
            android.widget.EditText field = chat().question;
            boolean shown = field.getGlobalVisibleRect(visible);
            android.util.Log.i("NotaQA", "Composer after snap: " + visible + " width=" + field.getWidth()
                + " height=" + field.getHeight() + " hasWindowFocus=" + field.hasWindowFocus()
                + " isShown=" + field.isShown() + " enabled=" + field.isEnabled() + " rootFocus=" + root.findFocus());
            check(shown && visible.width()>0 && visible.height()>0,"Snapped composer is visible and tappable: " + visible);
        });
        long now = SystemClock.uptimeMillis();
        sendPointerSync(MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, visible.centerX(), visible.centerY(), 0));
        sendPointerSync(MotionEvent.obtain(now, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP, visible.centerX(), visible.centerY(), 0));
        waitForIdleSync();
        ui(()->android.util.Log.i("NotaQA", "Focus after touch: " + root.findFocus()
            + " hasWindowFocus=" + chat().question.hasWindowFocus() + " imeActive="
            + home.getSystemService(InputMethodManager.class).isActive(chat().question)));
'''
if source.count(old)!=1: raise RuntimeError("Keyboard assertion moved")
target.write_text(source.replace(old,new))
