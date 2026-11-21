"""Exercise native launcher chat against the shared service inside disposable emulators."""
import os
from pathlib import Path

edition = os.environ["EDITION"]
tests = Path("app/src/androidTest/java")
shared_check = r'''
        String wording = follow.text.toLowerCase(java.util.Locale.US);
        android.util.Log.i("NotaQA", "Correction: " + follow.text + " sources=" + follow.sources.size());
        check(wording.contains("friday") && wording.matches("(?s).*\\b4(?::00)?\\s*p\\.?m\\.?.*")
                && wording.contains("room b") && !wording.contains("thursday")
                && follow.sources.isEmpty() && !follow.searchFallback, "Incorrect follow-up: " + follow.text);
'''
if edition in {"ten", "eleven"}:
    target = next(tests.rglob(edition.title() + "ChatSmoke.java"))
    source = target.read_text()
    start = source.index("    void realQuestions()")
    end = source.index("    void waitReply(", start)
    method = '''
    void realQuestions()throws Exception {
        enable();
        ui(()->chat().newChat());
        sendChat("Remember that my rehearsal is Thursday at 4 PM in Room B.");
        waitReply(1);
        sendChat("It moved to Friday. Give just the updated day, time, and room.");
        waitReply(2);
        LiveAnswer follow = chat().store.conversations.current().turns.get(1).answer;
''' + shared_check + '''
        ui(()->chat().cloud.performClick());
        await(()->!chat().cloud.isChecked(), "Cloud opt-out");
    }
'''
    source = (source[:start] + method + source[end:]).replace("live sourced question, follow-up and source open","live personal correction and cloud opt-out")
else:
    target = next(tests.rglob("Nota096Smoke.java"))
    source = target.read_text()
    start = source.index("    public void run()")
    end = source.index("    private void storage()", start)
    method = '''
    public void run()throws Exception {
        main(()->{
            store.preferences.edit().putBoolean("cloud_ai", true).putBoolean("nota_web_always", false).apply();
            call(activity,"showSettings","nota");
            chat().newChat();
        });
        send("Remember that my rehearsal is Thursday at 4 PM in Room B.");
        waitForReply(1);
        send("It moved to Friday. Give just the updated day, time, and room.");
        waitForReply(2);
        NotaConversation conversation = (NotaConversation)field(chat(),"conversations");
        LiveAnswer follow = conversation.current().turns.get(1).answer;
''' + shared_check + '''
        main(()->{model.set("cloud_ai",0);chat().syncCloud();});
        check(!store.preferences.getBoolean("cloud_ai",true), "Cloud opt-out");
    }
    private void waitForReply(int count) throws Exception {
        for (int i=0; i<90; i++) {
            final boolean[] done = {false};
            main(()->{
                NotaConversation current = (NotaConversation)field(chat(),"conversations");
                done[0] = !chat().busy() && current.current().turns.size() >= count;
            });
            if (done[0]) return;
            SystemClock.sleep(1000);
        }
        throw new AssertionError("Timed out waiting for a live reply");
    }
'''
    source = source[:start] + method + source[end:]
target.write_text(source)
