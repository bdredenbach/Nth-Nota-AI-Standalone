package com.nth.notaai;

import android.app.Activity;
import android.content.*;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.view.WindowManager;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.*;
import android.widget.FrameLayout;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final String BASE = "https://appassets.androidplatform.net/";
    private static final int FILE = 71, VOICE = 72, EXPORT = 73, IMAGE = 74, CAMERA = 75, CHAT_FILE = 76;
    private final ExecutorService network = Executors.newCachedThreadPool();
    private final ExecutorService files = Executors.newSingleThreadExecutor();
    private ChatImages images;
    private FileShelf shelf;
    private String exportVersion="";
    private boolean fileTemporary;
    private Uri sharedImage;
    private String imageTarget = "";
    private boolean imageTemporary;
    private Uri deferredPick, deferredFile;
    private String fileTarget = "";
    private File cameraFile;
    private java.util.concurrent.Future<?> imageTask;
    private WebView web;
    private FrameLayout frame;
    private SharedPreferences store;
    private Gateway pending;
    private String pendingId = "", importTarget = "", incoming;
    private SpeechOutput output;
    private PhoneHelp phone;
    private java.util.concurrent.Future<?> phoneTask;
    private boolean foreground;
    private LiveVoice live;
    private String pendingVoice = "";
    private boolean ready, dark;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        store = getSharedPreferences("notebook", MODE_PRIVATE);
        images = new ChatImages(this);
        shelf = new FileShelf(this);
        files.execute(() -> images.cleanUnreferenced(store.getAll().values()));
        if (state != null) {
            imageTarget = state.getString("imageTarget","");
            imageTemporary = state.getBoolean("imageTemporary");
            fileTarget = state.getString("fileTarget", "");
            fileTemporary = state.getBoolean("fileTemporary");
            exportVersion=state.getString("exportVersion","");
            String cameraName = state.getString("cameraName", "");
            if (cameraName.matches("photo-[a-zA-Z0-9_-]+\\.jpg")) cameraFile = new File(new File(getCacheDir(), "camera"), cameraName);
            deferredPick = state.getParcelable("deferredPick");
            deferredFile = state.getParcelable("deferredFile");
        }
        frame = new FrameLayout(this);
        phone = new PhoneHelp(this);
        output = new SpeechOutput(this);
        live = new LiveVoice(this, new LiveVoice.Host() {
            public void event(String id, String type, String token, String value) {
                if ("ready".equals(type)) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                emit("live", id, type, token, value);
            }
            public void ended(String id) {
                getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                if (id.equals(pendingVoice)) stopRequest();
            }
        }, output);
        if (WebView.getCurrentWebViewPackage() == null) {
            new android.app.AlertDialog.Builder(this)
                .setTitle("Android System WebView is required")
                .setMessage("Enable or update Android System WebView on this device, then reopen Nth Nota AI.")
                .setPositiveButton("Close", (dialog, which) -> finish())
                .setOnCancelListener(dialog -> finish()).show();
            return;
        }
        web = new WebView(this);
        frame.addView(web);
        setContentView(frame);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            frame.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }
        colors(false);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        // The request interceptor serves packaged assets and returns a local 404 for every other origin.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setTextZoom(Math.round(getResources().getConfiguration().fontScale * 100));
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) { return true; }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri uri = req.getUrl();
                String path = uri.getPath();
                boolean local = "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getAuthority());
                if (local && path != null && path.startsWith("/chat-image/")) {
                    try { return images.response(path.substring("/chat-image/".length())); }
                    catch (IOException ignored) {}
                }
                if (local && path != null && path.matches("/(?:[a-z][a-z-]*\\.js|index\\.html|style\\.css|orbit\\.png|(?:sans|serif)\\.ttf)")) {
                    String mime = path.endsWith("js") ? "application/javascript" : path.endsWith("css") ? "text/css" :
                        path.endsWith("png") ? "image/png" : path.endsWith("ttf") ? "font/ttf" : "text/html";
                    try { return new WebResourceResponse(mime, "UTF-8", getAssets().open(path.substring(1))); }
                    catch (IOException ignored) {}
                }
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not found", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
        });
        web.addJavascriptInterface(new Bridge(), "Nota");
        collect(getIntent());
        web.loadUrl(BASE + "index.html");
    }

    private void collect(Intent intent) {
        if (intent != null && Intent.ACTION_SEND.equals(intent.getAction()) && intent.getType() != null && intent.getType().startsWith("image/")) {
            android.os.Parcelable supplied = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            Uri uri = supplied instanceof Uri ? (Uri)supplied : null;
            if (uri == null && intent.getClipData() != null && intent.getClipData().getItemCount() > 0) uri = intent.getClipData().getItemAt(0).getUri();
            if (uri != null && "content".equals(uri.getScheme())) sharedImage = uri;
            setIntent(new Intent(this, MainActivity.class));
            if (ready) deliverIncoming();
            return;
        }
        if (intent != null && Intent.ACTION_SEND.equals(intent.getAction()) && "text/plain".equals(intent.getType())) {
            CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
            if (text != null && !text.toString().trim().isEmpty()) {
                if (text.length() > 14000) incoming = "";
                else incoming = text.toString();
            }
            setIntent(new Intent(this, MainActivity.class));
            if (ready) deliverIncoming();
        }
    }
    private void deliverIncoming() {
        if (deferredPick!=null) {
            Uri selected=deferredPick;deferredPick=null;
            finishImagePick(selected);
        }
        if (deferredFile != null) {
            Uri selected = deferredFile;
            deferredFile = null;
            loadChatFile(selected, fileTarget,fileTemporary);
        }
        if (sharedImage != null) emit("sharedImage");
        if (incoming == null) return;
        if (incoming.isEmpty()) emit("notice", "Shared text exceeds 14,000 characters. Select a shorter passage.");
        else emit("incoming", incoming);
        incoming = null;
    }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); collect(intent); }

    private void colors(boolean night) {
        dark = night;
        int color = Color.parseColor(dark ? "#1c1c1a" : "#fbf9f5");
        frame.setBackgroundColor(color);
        web.setBackgroundColor(color);
        getWindow().setStatusBarColor(color);
        getWindow().setNavigationBarColor(color);
        getWindow().getDecorView().setSystemUiVisibility(dark ? 0 :
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
    }

    private void emit(String event, String... values) {
        if (isDestroyed() || web == null) return;
        StringBuilder js = new StringBuilder("window.notaEvent && window.notaEvent(").append(JSONObject.quote(event));
        for (String v : values) js.append(",").append(JSONObject.quote(v == null ? "" : v));
        web.evaluateJavascript(js.append(")").toString().replace("\u2028","\\u2028").replace("\u2029","\\u2029"), null);
    }

    private void stopRequest() {
        if(imageTask!=null){imageTask.cancel(true);imageTask=null;}
        if(phoneTask!=null){phoneTask.cancel(true);phoneTask=null;}
        Gateway current = pending;
        pending = null;
        pendingId = "";
        pendingVoice = "";
        if (current != null) network.execute(current::cancel);
    }

    final class Bridge {
        @JavascriptInterface public void mounted() { runOnUiThread(() -> {ready = true; deliverIncoming();}); }
        @JavascriptInterface public String records() {
            JSONObject data = new JSONObject();
            for (Map.Entry<String, ?> row : store.getAll().entrySet()) if (row.getValue() instanceof String) {
                try { data.put(row.getKey(), new JSONObject((String)row.getValue())); } catch (Exception ignored) {}
            }
            return data.toString();
        }
        @JavascriptInterface public boolean record(String key, String json) {
            if (!key.matches("(prefs|organizer|thread-[a-zA-Z0-9-]+|card-[a-zA-Z0-9-]+)")) return false;
            return (json.isEmpty() ? store.edit().remove(key) : store.edit().putString(key, json)).commit();
        }
        @JavascriptInterface public boolean cloud() { return store.getBoolean("consent", false); }
        @JavascriptInterface public void consent(boolean yes) {
            store.edit().putBoolean("consent", yes).apply();
            if (!yes) runOnUiThread(() -> {live.end("", "Cloud questions are off."); stopRequest();});
        }
        @JavascriptInterface public void pinTick() {
            runOnUiThread(() -> web.playSoundEffect(android.view.SoundEffectConstants.CLICK));
        }
        @JavascriptInterface public void theme(boolean night) { runOnUiThread(() -> colors(night)); }
        @JavascriptInterface public void stop() { runOnUiThread(MainActivity.this::stopRequest); }
        @JavascriptInterface public void ask(String id, String payload) {
            request(id, payload, "", "");
        }
        @JavascriptInterface public void askLive(String id, String payload, String session, String token) {
            request(id, payload, session, token);
        }
        private void request(String id, String payload, String session, String token) {
            runOnUiThread(() -> {
                if (!session.isEmpty() && !live.acceptTurn(session, token)) {
                    emit("failure", id, "This voice turn ended before the question was sent.");
                    return;
                }
                if (!cloud()) {emit("failure", id, "Cloud questions are off."); return;}
                stopRequest();
                Gateway job = new Gateway();
                pending = job;
                pendingId = id;
                pendingVoice = session;
                network.execute(() -> {
                    String result = "", error = "";
                    try { result = job.request(payload).toString(); }
                    catch (java.net.SocketTimeoutException e) { error = "The service took too long. Your question is available to retry."; }
                    catch (java.net.UnknownHostException | java.net.ConnectException e) { error = "Couldn’t connect. Check your connection and retry."; }
                    catch (IOException e) { error = e.getMessage() == null ? "Connection interrupted. Try again." : e.getMessage(); }
                    catch (Exception e) { error = "Couldn’t read this reply. Try again."; }
                    final String answer = result, problem = error;
                    runOnUiThread(() -> {
                        if (pending != job || !id.equals(pendingId) || !cloud() || isDestroyed()) return;
                        pending = null; pendingId = ""; pendingVoice = "";
                        emit(problem.isEmpty() ? "answer" : "failure", id, problem.isEmpty() ? answer : problem);
                    });
                });
            });
        }
        @JavascriptInterface public void copy(String text) { runOnUiThread(() -> ((ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Nth Nota AI", text))); }
        @JavascriptInterface public void share(String text) { runOnUiThread(() -> start(Intent.createChooser(new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "Share text"), -1)); }
        @JavascriptInterface public void openSource(String url) {
            Uri uri = Uri.parse(url);
            if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)) return;
            runOnUiThread(() -> start(new Intent(Intent.ACTION_VIEW, uri), -1));
        }
        @JavascriptInterface public String savedFiles() {
            try{return shelf.list().toString();}
            catch(Exception e){return new JSONObject().toString();}
        }
        @JavascriptInterface public void fileWork(String token,String action,String raw) {
            files.execute(()->{
                try{
                    JSONObject args=new JSONObject(raw);
                    JSONObject result;
                    if(action.equals("legacyPhoto")){
                        String id=args.getString("key");
                        result=shelf.oldPhoto(id,images.bytes(id),args.getString("origin"));
                    }else if(action.equals("photo")){
                        String id=args.getString("id");
                        JSONObject meta=shelf.info(id);
                        if(!meta.getString("kind").equals("photo"))throw new IOException("Choose a saved photo.");
                        ByteArrayOutputStream data=new ByteArrayOutputStream();
                        shelf.writeTo(id,data);
                        byte[] bytes=data.toByteArray();
                        android.graphics.BitmapFactory.Options sizes=new android.graphics.BitmapFactory.Options();
                        sizes.inJustDecodeBounds=true;
                        android.graphics.BitmapFactory.decodeByteArray(bytes,0,bytes.length,sizes);
                        result=images.saveJpeg(bytes,args.optBoolean("temporary"),sizes.outWidth,sizes.outHeight).put("shelfId",id);
                    }else result=shelf.operate(action,args);
                    String payload=result.toString();
                    runOnUiThread(()->emit("shelfResult",token,"ok",payload));
                }catch(Exception e){
                    String message=e instanceof IOException&&e.getMessage()!=null?e.getMessage():"Couldn’t complete the file operation. Check available storage and try again.";
                    runOnUiThread(()->emit("shelfResult",token,"error",message));
                }
            });
        }
        @JavascriptInterface public void downloadVersion(String id){
            files.execute(()->{
                try{
                    JSONObject meta=shelf.info(id);
                    String kind=meta.getString("kind"),name=meta.getString("name");
                    String mime=kind.equals("photo")?"image/jpeg":kind.equals("zip")?"application/zip":name.endsWith(".md")?"text/markdown":"text/plain";
                    runOnUiThread(()->{
                        exportVersion=id;
                        start(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE,name),EXPORT);
                    });
                }catch(Exception e){runOnUiThread(()->emit("notice","This file is unavailable."));}
            });
        }
        @JavascriptInterface public void pickImage(String target, boolean temporary) {
            runOnUiThread(() -> {
                imageTarget = target; imageTemporary = temporary;
                Intent picker;
                if (Build.VERSION.SDK_INT >= 33) picker = new Intent(android.provider.MediaStore.ACTION_PICK_IMAGES).setType("image/*");
                else picker = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*");
                try { startActivityForResult(picker,IMAGE); }
                catch (ActivityNotFoundException missing) { start(new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*"),IMAGE); }
            });
        }
        @JavascriptInterface public void takePhoto(String target, boolean temporary) {
            runOnUiThread(() -> {
                imageTarget = target;
                imageTemporary = temporary;
                try {
                    File dir = new File(getCacheDir(), "camera");
                    if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException();
                    cameraFile = File.createTempFile("photo-", ".jpg", dir);
                    Uri outputUri = cameraUri();
                    Intent camera = new Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE)
                        .putExtra(android.provider.MediaStore.EXTRA_OUTPUT, outputUri)
                        .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    camera.setClipData(ClipData.newRawUri("Photo", outputUri));
                    startActivityForResult(camera, CAMERA);
                } catch (IOException | RuntimeException unavailable) {
                    clearCamera();
                    emit("notice", "Couldn’t open the camera. Try Photos instead.");
                }
            });
        }
        @JavascriptInterface public void pickChatFile(String target,boolean temporary) {
            runOnUiThread(() -> {
                fileTarget = target;fileTemporary=temporary;
                // Providers report some .md, .log and .zip files as generic binary data.
                start(new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
                    .putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"text/*", "application/json", "application/zip",
                        "application/x-zip-compressed", "application/octet-stream"}), CHAT_FILE);
            });
        }
        @JavascriptInterface public void acceptSharedImage(String target, boolean temporary) {
            runOnUiThread(() -> {
                Uri uri = sharedImage; sharedImage = null;
                if (uri != null) loadImage(uri,target,temporary);
            });
        }
        @JavascriptInterface public void discardImage(String id) { files.execute(() -> images.discard(id)); }
        @JavascriptInterface public void imageStatus() {
            network.execute(() -> {
                int status = -1;
                try { status = ImageReader.model().checkStatus().get(5,java.util.concurrent.TimeUnit.SECONDS); }
                catch (Exception | LinkageError ignored) {}
                final String name = status == com.google.mlkit.genai.common.FeatureStatus.AVAILABLE ? "available" :
                    status == com.google.mlkit.genai.common.FeatureStatus.DOWNLOADABLE ? "downloadable" :
                    status == com.google.mlkit.genai.common.FeatureStatus.DOWNLOADING ? "downloading" : "unavailable";
                runOnUiThread(() -> emit("imageStatus",name));
            });
        }
        @JavascriptInterface public void setupVision() {
            network.execute(() -> {
                try {
                    var model = ImageReader.model();
                    model.download(new com.google.mlkit.genai.common.DownloadCallback() {
                        public void onDownloadStarted(long size) { runOnUiThread(() -> emit("imageStatus","downloading")); }
                        public void onDownloadProgress(long size) {}
                        public void onDownloadCompleted() { runOnUiThread(() -> emit("imageStatus","available")); }
                        public void onDownloadFailed(com.google.mlkit.genai.common.GenAiException e) { runOnUiThread(() -> emit("notice","On-device vision could not be downloaded. Try again on Wi-Fi.")); }
                    });
                } catch (Exception | LinkageError e) { runOnUiThread(() -> emit("notice","Android could not start the model download.")); }
            });
        }
        @JavascriptInterface public void askImage(String id, String payload) {
            runOnUiThread(() -> {
                stopRequest();
                JSONObject data;
                try { data=new JSONObject(payload); } catch (org.json.JSONException e) {emit("failure",id,"Invalid image request.");return;}
                String session=data.optString("session");
                if (!session.isEmpty() && !live.acceptTurn(session,data.optString("token"))) {emit("failure",id,"This voice turn has ended.");return;}
                Gateway gateway = new Gateway(); pending=gateway;pendingId=id;pendingVoice=session;
                imageTask=network.submit(() -> {
                    String answer="",error="";
                    try {
                        byte[] pixels = images.bytes(data.getString("id"));
                        String mode = data.optString("mode");
                        if ("cloud".equals(mode)) {
                            if (!cloud()) throw new IOException("Cloud questions are off.");
                            answer=gateway.vision(data,pixels).put("imageMethod","Cloud image analysis").toString();
                        } else answer=ImageReader.answer(pixels,data,mode,gateway,this::cloud).toString();
                    } catch (InterruptedException stop) { Thread.currentThread().interrupt();return; }
                    catch (IOException e) { error=e.getMessage(); }
                    catch (Exception | LinkageError e) { error="Couldn’t analyze this image. Try a closer crop or another image."; }
                    final String result=answer,problem=error;
                    runOnUiThread(() -> {
                        if (pending!=gateway || !id.equals(pendingId) || isDestroyed()) return;
                        pending=null;pendingId="";pendingVoice="";imageTask=null;
                        emit(result.isEmpty()?"failure":"answer",id,result.isEmpty()?problem:result);
                    });
                });
            });
        }
        @JavascriptInterface public void pick(String target) { runOnUiThread(() -> {
            importTarget = target;
            start(new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("text/*"), FILE);
        }); }
        @JavascriptInterface public void dictate(String target) { runOnUiThread(() -> {
            importTarget = target;
            start(new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true), VOICE);
        }); }
        @JavascriptInterface public String phoneStatus(){ return phone.status(); }
        @JavascriptInterface public void phoneConfigure(String key,String value){
            runOnUiThread(()->{if(!foreground)return;phone.configure(key,value);emit("phoneStatus");});
        }
        @JavascriptInterface public void phoneOpen(String kind,String value){
            runOnUiThread(()->{if(foreground&&!phone.launch(kind,value))emit("notice","Android couldn’t open that item. It may have moved or been uninstalled.");});
        }
        @JavascriptInterface public void askPhone(String id,String raw,String session,String token){
            runOnUiThread(()->{
                if(!foreground || (!session.isEmpty()&&!live.acceptTurn(session,token))){emit("failure",id,"Return to chat and try again.");return;}
                stopRequest(); pendingId=id;pendingVoice=session;
                phoneTask=network.submit(()->{
                    String response;
                    try{response=phone.answer(new JSONObject(raw)).toString();}
                    catch(InterruptedException stopped){Thread.currentThread().interrupt();return;}
                    catch(Exception unavailable){response="";}
                    final String result=response;
                    runOnUiThread(()->{
                        if(!id.equals(pendingId)||isDestroyed())return;
                        pendingId="";pendingVoice="";phoneTask=null;
                        if(result.isEmpty())emit("failure",id,"Couldn’t get that information. Check Phone setup and try again.");
                        else emit("phoneAnswer",id,result);
                    });
                });
            });
        }
        @JavascriptInterface public void setVoice(boolean system, int pace) {
            runOnUiThread(() -> output.configure(system, pace));
        }
        @JavascriptInterface public void previewVoice(String token) {
            runOnUiThread(() -> output.play("You had two ideas there. I wrote down the first. Where did you want to go with the second?", new SpeechOutput.Listener() {
                @Override public void started() { emit("preview", token, "playing"); }
                @Override public void finished(boolean ok) { emit("preview", token, ok ? "done" : "failed"); }
            }));
        }
        @JavascriptInterface public void readAloud(String text) {
            runOnUiThread(() -> output.play(text, ok -> {if (!ok) emit("notice","Couldn’t read this reply aloud. You can try another voice in Settings.");}));
        }
        @JavascriptInterface public void silence() { runOnUiThread(output::stop); }
        @JavascriptInterface public void beginLive(String session) { runOnUiThread(() -> live.begin(session)); }
        @JavascriptInterface public void listenLive(String session, String token) { runOnUiThread(() -> live.listen(session,token)); }
        @JavascriptInterface public void muteLive(String session) { runOnUiThread(() -> live.mute(session)); }
        @JavascriptInterface public void interruptLive(String session) { runOnUiThread(() -> live.interrupt(session)); }
        @JavascriptInterface public void speakLive(String session, String token, String text) { runOnUiThread(() -> live.speak(session,token,text)); }
        @JavascriptInterface public void endLive(String session) { runOnUiThread(() -> live.end(session,"")); }
        @JavascriptInterface public void leave() { runOnUiThread(MainActivity.this::finish); }
    }

    @Override protected void onResume() { super.onResume(); foreground=true; if (live != null) live.resumed(); if(ready)emit("phoneStatus"); }
    @Override protected void onPause() { if (live != null) live.paused(); super.onPause(); }
    @Override protected void onStop() { foreground=false; if(phoneTask!=null){String id=pendingId;stopRequest();emit("failure",id,"Phone lookup stopped when you left Nota. Retry when you’re ready.");} if (live != null) live.stopped(); if (output != null) output.stop(); emit("previewStopped"); super.onStop(); }
    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(code, permissions, grants);
        if(code==PhoneHelp.LOCATION||code==PhoneHelp.MIC){phone.permissionResult(code);emit("phoneStatus");}
        if (code == LiveVoice.PERMISSION && live != null) live.permissionResult();
    }

    private void start(Intent intent, int code) {
        try { if (code < 0) startActivity(intent); else startActivityForResult(intent, code); }
        catch (ActivityNotFoundException e) { emit("notice", code == VOICE ? "No Android dictation service is installed." : "No app is available for this action."); }
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);state.putString("imageTarget",imageTarget);state.putBoolean("imageTemporary",imageTemporary);
        state.putString("fileTarget", fileTarget);
        state.putBoolean("fileTemporary",fileTemporary);state.putString("exportVersion",exportVersion);
        if (cameraFile != null) state.putString("cameraName", cameraFile.getName());
        state.putParcelable("deferredPick", deferredPick);
        state.putParcelable("deferredFile", deferredFile);
    }
    private Uri cameraUri() {
        return androidx.core.content.FileProvider.getUriForFile(this, getPackageName() + ".camera", cameraFile);
    }
    private void clearCamera() {
        if (cameraFile == null) return;
        cameraFile.delete();
        cameraFile = null;
    }
    private void finishImagePick(Uri uri) {
        File taken = cameraFile;
        cameraFile = null;
        loadImage(uri, imageTarget, imageTemporary, taken);
    }
    private void loadChatFile(Uri uri, String target,boolean temporary) {
        files.execute(() -> {
            try {
                if (!"content".equals(uri.getScheme())) throw new IOException("Choose a file from the Android picker.");
                String mime = getContentResolver().getType(uri);
                String name = "Attachment";
                String column = android.provider.OpenableColumns.DISPLAY_NAME;
                try (android.database.Cursor row = getContentResolver().query(uri, new String[]{column}, null, null, null)) {
                    if (row != null && row.moveToFirst() && !row.isNull(0)) name = row.getString(0);
                }
                try (InputStream input = getContentResolver().openInputStream(uri)) {
                    if (input == null) throw new IOException("Couldn’t open this file.");
                    String type=mime==null?"":mime;
                    JSONObject descriptor;
                    if(temporary){
                        AttachedFile file=AttachedFile.read(input,name,type,getCacheDir());
                        descriptor=new JSONObject().put("name",file.name).put("detail",file.detail).put("body",file.body);
                    }else descriptor=shelf.add(input,name,type,target,"");
                    String payload=descriptor.toString();
                    runOnUiThread(()->emit("chatFile",target,payload));
                }
            } catch (Exception error) {
                runOnUiThread(() -> emit("notice", error instanceof IOException && error.getMessage() != null
                    ? error.getMessage() : "Couldn’t read that file. Try another copy."));
            }
        });
    }
    private void loadImage(Uri uri,String target,boolean temporary) {
        loadImage(uri, target, temporary, null);
    }
    private void loadImage(Uri uri,String target,boolean temporary,File captured) {
        files.execute(() -> {
            try {
                JSONObject descriptor=images.importImage(uri,temporary);
                if(!temporary){
                    String name="Photo-"+new java.text.SimpleDateFormat("yyyyMMdd-HHmmss",Locale.US).format(new Date())+".jpg";
                    try(InputStream in=new ByteArrayInputStream(images.bytes(descriptor.getString("id")))){
                        descriptor.put("shelfId",shelf.add(in,name,"image/jpeg",target,"").getString("id"));
                    }catch(Exception failure){runOnUiThread(()->emit("notice","Photo attached. Couldn’t keep a copy in Files."));}
                }
                runOnUiThread(() -> emit("imagePicked",target,descriptor.toString()));
            } catch (Exception e) {
                runOnUiThread(() -> emit("notice",e instanceof IOException && e.getMessage()!=null?e.getMessage():"Couldn’t open that image. Try another copy."));
            } finally {
                if (captured != null) captured.delete();
            }
        });
    }
    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == CAMERA) {
            if (result == RESULT_OK && cameraFile != null) {
                Uri selected = cameraUri();
                if (ready) finishImagePick(selected); else deferredPick = selected;
            } else clearCamera();
            return;
        }
        if (result != RESULT_OK || data == null) {if (code == EXPORT) exportVersion = ""; return;}
        final String target = importTarget;
        if (code == IMAGE && data.getData() != null) {
            if(ready) finishImagePick(data.getData()); else deferredPick=data.getData();
        } else if (code == CHAT_FILE && data.getData() != null) {
            if (ready) loadChatFile(data.getData(), fileTarget,fileTemporary); else deferredFile = data.getData();
        } else if (code == VOICE) {
            ArrayList<String> words = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (words != null && !words.isEmpty()) emit("dictated", target, words.get(0));
        } else if (code == FILE && data.getData() != null) {
            Uri uri = data.getData();
            files.execute(() -> {
                try (InputStream stream = getContentResolver().openInputStream(uri)) {
                    String text = Gateway.readUtf8(stream, 56000).replaceFirst("^\uFEFF", "");
                    if (text.length() > 14000 || text.contains("\u0000") || text.contains("\uFFFD")) throw new IOException();
                    runOnUiThread(() -> emit("file", target, text));
                } catch (Exception e) { runOnUiThread(() -> emit("notice", "Choose a UTF-8 text file of up to 14,000 characters.")); }
            });
        } else if(code==EXPORT && data.getData()!=null && !exportVersion.isEmpty()){
            String version=exportVersion;exportVersion="";
            Uri uri=data.getData();
            files.execute(()->{
                try{
                    try(OutputStream out=getContentResolver().openOutputStream(uri,"wt")){
                        if(out==null)throw new IOException();
                        shelf.writeTo(version,out);
                    }
                    runOnUiThread(()->emit("notice","File downloaded."));
                }catch(Exception e){runOnUiThread(()->emit("notice","Couldn’t download the file. Choose another location."));}
            });
        }
    }
    private void handleBack() { if (ready) emit("back"); else finish(); }
    // API 33+ uses the registered OnBackInvokedCallback. Older devices dispatch this method.
    @android.annotation.SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed() { handleBack(); }
    @Override protected void onDestroy() {
        if (live != null) live.stopped();
        stopRequest();
        network.shutdown();
        files.execute(shelf::close);files.shutdown();
        if (output != null) output.close();
        if (web != null) {web.removeJavascriptInterface("Nota"); frame.removeView(web); web.destroy(); web = null;}
        super.onDestroy();
    }
}
