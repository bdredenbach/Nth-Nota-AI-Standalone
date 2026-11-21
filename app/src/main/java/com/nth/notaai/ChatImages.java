package com.nth.notaai;

import android.content.Context;
import android.graphics.*;
import android.media.ExifInterface;
import android.net.Uri;
import android.webkit.WebResourceResponse;
import org.json.JSONObject;
import java.io.*;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

final class ChatImages {
    private static final int EDGE = 2048, MAX_SOURCE = 32 * 1024 * 1024;
    private final Context context;
    private final File directory;
    private final Map<String, byte[]> temporary = new ConcurrentHashMap<>();

    ChatImages(Context context) {
        this.context = context;
        directory = new File(context.getNoBackupFilesDir(), "chat-images");
    }

    static boolean validId(String id) { return id != null && id.matches("[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}"); }

    JSONObject importImage(Uri uri, boolean temp) throws Exception {
        if (!"content".equals(uri.getScheme())) throw new IOException("Choose an image from the Android picker.");
        String type = context.getContentResolver().getType(uri);
        if (type != null && !type.startsWith("image/") && !type.equals("application/octet-stream")) throw new IOException("Choose a photo or screenshot.");
        byte[] original;
        try (InputStream stream = context.getContentResolver().openInputStream(uri)) {
            if (stream == null) throw new IOException("Android could not open this image.");
            ByteArrayOutputStream data = new ByteArrayOutputStream();
            byte[] block = new byte[32768];
            for (int n; (n = stream.read(block)) != -1;) {
                if (data.size() + n > MAX_SOURCE) throw new IOException("This image is over 32 MB. Crop it or choose a smaller copy.");
                data.write(block, 0, n);
            }
            original = data.toByteArray();
        }
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(original, 0, original.length, options);
        if (options.outWidth <= 0 || options.outHeight <= 0) throw new IOException("Android couldn’t decode this image. Try PNG or JPEG.");
        int edge = Math.max(options.outWidth, options.outHeight);
        options.inJustDecodeBounds = false;
        options.inSampleSize = 1;
        while (edge / options.inSampleSize > EDGE * 1.5) options.inSampleSize *= 2;
        Bitmap bitmap = BitmapFactory.decodeByteArray(original, 0, original.length, options);
        if (bitmap == null) throw new IOException("Couldn’t read the selected image.");
        try {
            Matrix m = new Matrix();
            int orientation = 1;
            try {
                orientation = new ExifInterface(new ByteArrayInputStream(original)).getAttributeInt(ExifInterface.TAG_ORIENTATION, 1);
            } catch (IOException ignored) {}
            switch (orientation) {
                case 2: m.setScale(-1,1); break;
                case 3: m.setRotate(180); break;
                case 4: m.setScale(1,-1); break;
                case 5: m.setRotate(90); m.postScale(-1,1); break;
                case 6: m.setRotate(90); break;
                case 7: m.setRotate(-90); m.postScale(-1,1); break;
                case 8: m.setRotate(-90); break;
            }
            float scale = Math.min(1f, (float) EDGE / Math.max(bitmap.getWidth(),bitmap.getHeight()));
            m.postScale(scale, scale);
            Bitmap upright = Bitmap.createBitmap(bitmap, 0,0,bitmap.getWidth(),bitmap.getHeight(),m,true);
            if (upright != bitmap) { bitmap.recycle(); bitmap = upright; }
            if (bitmap.hasAlpha()) {
                Bitmap flat = Bitmap.createBitmap(bitmap.getWidth(), bitmap.getHeight(), Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(flat);
                canvas.drawColor(Color.WHITE); canvas.drawBitmap(bitmap,0,0,null);
                bitmap.recycle(); bitmap = flat;
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            for (int quality : new int[]{94,85,72,58,42}) {
                out.reset();
                if (!bitmap.compress(Bitmap.CompressFormat.JPEG, quality, out)) throw new IOException("Couldn’t prepare this image.");
                if (out.size() <= 1200000) break;
            }
            if (out.size() > 1200000) throw new IOException("Crop the image to the area you want to discuss.");
            return saveJpeg(out.toByteArray(),temp,bitmap.getWidth(),bitmap.getHeight());
        } finally { bitmap.recycle(); }
    }

    JSONObject saveJpeg(byte[] data, boolean temp,int width,int height) throws Exception {
        String id=UUID.randomUUID().toString();
        if(temp)temporary.put(id,data);
        else{
            if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("Couldn’t save the photo.");
            File dest=new File(directory,id);
            try(OutputStream out=new FileOutputStream(dest)){out.write(data);}
            catch(IOException failure){dest.delete();throw failure;}
        }
        return new JSONObject().put("id",id).put("width",width).put("height",height);
    }

    byte[] bytes(String id) throws IOException {
        if (!validId(id)) throw new IOException("Choose the image again.");
        byte[] data = temporary.get(id);
        if (data != null) return data;
        File file = new File(directory,id);
        if (!file.isFile()) throw new IOException("This image is missing from the device. Attach it again.");
        return Files.readAllBytes(file.toPath());
    }

    WebResourceResponse response(String id) throws IOException {
        return new WebResourceResponse("image/jpeg",null,200,"OK",Collections.singletonMap("Cache-Control","no-store"),new ByteArrayInputStream(bytes(id)));
    }

    void discard(String id) {
        if (!validId(id)) return;
        temporary.remove(id);
        new File(directory,id).delete();
    }

    void cleanUnreferenced(Collection<?> records) {
        File[] files = directory.listFiles();
        if (files == null) return;
        Set<String> ids = new HashSet<>();
        for (Object raw : records) {
            if (!(raw instanceof String)) continue;
            try {
                JSONObject thread = new JSONObject((String)raw);
                if (!thread.has("turns")) continue;
                addId(ids,thread);
                org.json.JSONArray turns = thread.getJSONArray("turns");
                for (int i=0;i<turns.length();i++) addId(ids,turns.getJSONObject(i));
            } catch (org.json.JSONException malformed) { return; }
        }
        for (File file : files) if (validId(file.getName()) && !ids.contains(file.getName())) file.delete();
    }
    private static void addId(Set<String> ids,JSONObject owner) {
        JSONObject image = owner.optJSONObject("image");
        if (image != null) ids.add(image.optString("id"));
    }
}
