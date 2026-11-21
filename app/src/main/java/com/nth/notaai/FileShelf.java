package com.nth.notaai;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.*;
import org.json.*;
import java.io.*;
import java.util.*;

/** Each immutable version and its bytes are committed together. Chunks fit Android cursor windows. */
final class FileShelf extends SQLiteOpenHelper {
    private final File cache;
    FileShelf(Context context) {
        super(context,"saved-files.db",null,1);
        cache=context.getCacheDir();
    }
    @Override public void onConfigure(SQLiteDatabase db){db.setForeignKeyConstraintsEnabled(true);}
    @Override public void onCreate(SQLiteDatabase db){
        db.execSQL("CREATE TABLE versions(id TEXT PRIMARY KEY,family TEXT NOT NULL,num INTEGER NOT NULL,parent TEXT NOT NULL,name TEXT NOT NULL,kind TEXT NOT NULL,created INTEGER NOT NULL,origin TEXT NOT NULL,detail TEXT NOT NULL,body TEXT NOT NULL,size INTEGER NOT NULL,export_key TEXT NOT NULL,UNIQUE(family,num))");
        db.execSQL("CREATE INDEX export_history ON versions(export_key,num)");
        db.execSQL("CREATE TABLE chunks(version TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE, seq INTEGER NOT NULL,data BLOB NOT NULL,PRIMARY KEY(version,seq))");
    }
    @Override public void onUpgrade(SQLiteDatabase db,int oldVersion,int version){throw new IllegalStateException("Unknown file schema");}

    private static final String META="id,family,num,parent,name,kind,created,origin,detail,size";
    private static JSONObject row(Cursor c)throws JSONException{
        JSONObject out=new JSONObject();
        for(String key:c.getColumnNames()){
            int i=c.getColumnIndexOrThrow(key);
            if(c.getType(i)==Cursor.FIELD_TYPE_INTEGER)out.put(key,c.getLong(i));else out.put(key,c.getString(i));
        }
        return out;
    }
    JSONArray list()throws JSONException{
        JSONArray result=new JSONArray();
        try(Cursor c=getReadableDatabase().rawQuery("SELECT "+META+" FROM versions ORDER BY created DESC,num DESC,rowid DESC",null)){
            while(c.moveToNext())result.put(row(c));
        }
        return result;
    }
    JSONObject info(String id)throws Exception{
        try(Cursor c=getReadableDatabase().rawQuery("SELECT "+META+",body FROM versions WHERE id=?",new String[]{id})){
            if(!c.moveToFirst())throw new IOException("That version is no longer in Files.");
            return row(c);
        }
    }
    void writeTo(String id,OutputStream out)throws Exception{
        info(id);
        try(Cursor c=getReadableDatabase().rawQuery("SELECT data FROM chunks WHERE version=? ORDER BY seq",new String[]{id})){
            while(c.moveToNext())out.write(c.getBlob(0));
        }
    }
    private File temp()throws IOException{return File.createTempFile("nota-file-",".tmp",cache);}
    private File materialize(String id)throws Exception{
        File f=temp();
        try(OutputStream out=new FileOutputStream(f)){writeTo(id,out);return f;}
        catch(Exception e){f.delete();throw e;}
    }
    JSONObject add(InputStream input,String name,String mime,String origin,String parent)throws Exception{
        File f=temp();
        try{
            try(OutputStream out=new FileOutputStream(f)){FileVersions.copy(input,out,FileVersions.MAX_FILE);}
            return save(f,name,mime,origin,parent);
        }finally{f.delete();}
    }
    private JSONObject save(File f,String filename,String mime,String origin,String parent)throws Exception{
        return save(f,filename,mime,origin,parent,UUID.randomUUID().toString());
    }
    private JSONObject save(File f,String filename,String mime,String origin,String parent,String id)throws Exception{
        return save(f,filename,mime,origin,parent,id,"");
    }
    private JSONObject save(File f,String filename,String mime,String origin,String parent,String id,String exportKey)throws Exception{
        if(f.length()>FileVersions.MAX_FILE)throw new IOException("Saved files support up to 16 MB per version.");
        String name=AttachedFile.label(filename).replace('/','_').replace('\\','_');
        String kind="image/jpeg".equals(mime)?"photo":name.toLowerCase(Locale.ROOT).endsWith(".zip")||mime.contains("zip")?"zip":"text";
        String body="",detail="Photo";
        if(!kind.equals("photo")){
            if(kind.equals("text")&&f.length()==0){body="[Empty file]";detail="Text file";}
            else try(InputStream in=new FileInputStream(f)){
                AttachedFile preview=AttachedFile.read(in,name,mime,cache);
                body=preview.body;detail=preview.detail;
            }
        }
        String family=id;
        SQLiteDatabase db=getWritableDatabase();
        db.beginTransaction();
        try{
            long num=1;
            try(Cursor existing=db.rawQuery("SELECT id FROM versions WHERE id=?",new String[]{id})){
                if(existing.moveToFirst()){db.setTransactionSuccessful();return info(id);}
            }
            if(!parent.isEmpty()){
                JSONObject base=info(parent);
                family=base.getString("family");
                try(Cursor c=db.rawQuery("SELECT MAX(num)+1 FROM versions WHERE family=?",new String[]{family})){c.moveToFirst();num=c.getLong(0);}
            }
            ContentValues meta=new ContentValues();
            meta.put("export_key",exportKey);meta.put("id",id);meta.put("family",family);meta.put("num",num);meta.put("parent",parent);
            meta.put("name",name);meta.put("kind",kind);meta.put("created",System.currentTimeMillis());
            meta.put("origin",origin);meta.put("detail",detail);meta.put("body",body);meta.put("size",f.length());
            db.insertOrThrow("versions",null,meta);
            try(InputStream stream=new FileInputStream(f)){
                byte[] block=new byte[64*1024];int seq=0;
                for(int n;(n=stream.read(block))!=-1;){
                    ContentValues chunk=new ContentValues();chunk.put("version",id);chunk.put("seq",seq++);
                    chunk.put("data",n==block.length?block:Arrays.copyOf(block,n));db.insertOrThrow("chunks",null,chunk);
                }
            }
            db.setTransactionSuccessful();
        }finally{db.endTransaction();}
        return info(id);
    }
    JSONObject oldPhoto(String key,byte[] bytes,String origin)throws Exception{
        String id=UUID.nameUUIDFromBytes(("photo:"+key).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();
        try{return info(id);}catch(IOException missing){/* Import this existing photo once. */}
        File f=temp();
        try{
            java.nio.file.Files.write(f.toPath(),bytes);
            return save(f,"Photo-"+key.substring(0,8)+".jpg","image/jpeg",origin,"",id);
        }finally{f.delete();}
    }
    private JSONObject exportText(JSONObject args)throws Exception{
        String origin=args.getString("origin"),name=args.getString("name"),parent="";
        byte[] bytes=args.getString("text").getBytes(java.nio.charset.StandardCharsets.UTF_8);
        SQLiteDatabase db=getWritableDatabase();
        db.beginTransaction();
        try{
            try(Cursor c=db.rawQuery("SELECT id,size,name FROM versions WHERE export_key=? ORDER BY num DESC LIMIT 1",new String[]{origin})){
                if(c.moveToFirst()){
                    parent=c.getString(0);
                    if(c.getLong(1)==bytes.length && c.getString(2).equals(name)){
                        ByteArrayOutputStream previous=new ByteArrayOutputStream();writeTo(parent,previous);
                        if(Arrays.equals(bytes,previous.toByteArray())){db.setTransactionSuccessful();return info(parent);}
                    }
                }
            }
            File f=temp();
            try{
                java.nio.file.Files.write(f.toPath(),bytes);
                JSONObject result=save(f,name,"text/markdown",origin,parent,UUID.randomUUID().toString(),origin);
                db.setTransactionSuccessful();return result;
            }finally{f.delete();}
        }finally{db.endTransaction();}
    }
    JSONObject text(String name,String value,String origin,String parent)throws Exception{
        if(!name.toLowerCase(Locale.ROOT).endsWith(".md")&&parent.isEmpty())name+=".md";
        return add(new ByteArrayInputStream(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)),name,"text/plain",origin,parent);
    }
    JSONObject operate(String action,JSONObject args)throws Exception{
        String id=args.optString("id"),origin=args.optString("origin");
        if(action.equals("legacy")||action.equals("artifact")){
            String stable=UUID.nameUUIDFromBytes((action+":"+args.getString("key")).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();
            try{return info(stable);}catch(IOException missing){/* First save. */}
            File f=temp();
            try{
                java.nio.file.Files.write(f.toPath(),args.getString("text").getBytes(java.nio.charset.StandardCharsets.UTF_8));
                return save(f,args.getString("name"),"text/plain",origin,"",stable);
            }finally{f.delete();}
        }
        if(action.equals("export"))return exportText(args);
        if(action.equals("save"))return text(args.getString("name"),args.getString("text"),origin,"");
        JSONObject meta=info(id);
        boolean zip=meta.getString("kind").equals("zip");
        if(action.equals("info"))return meta;
        if(action.equals("delete")){
            getWritableDatabase().delete("versions","family=?",new String[]{meta.getString("family")});return new JSONObject();
        }
        if(meta.getString("kind").equals("photo"))throw new IOException("Use the photo in image chat.");
        File source=materialize(id);
        try{
            if(action.equals("members"))return new JSONObject().put("members",new JSONArray(zip?FileVersions.members(source):Collections.singletonList("")));
            String path=args.optString("path");
            if(action.equals("compare")){
                JSONObject other=info(args.getString("other"));
                if(other.getString("kind").equals("photo"))throw new IOException("Choose two text files or archives.");
                File b=materialize(other.getString("id"));
                try{return new JSONObject().put("body",FileVersions.compare(source,zip,meta.getString("body"),b,other.getString("kind").equals("zip"),other.getString("body")));}
                finally{b.delete();}
            }
            if(zip==path.isEmpty())throw new IOException("Choose the text file to edit.");
            if(action.equals("read")){
                String text;
                if(zip)text=FileVersions.member(source,path);
                else try(InputStream in=new FileInputStream(source)){text=FileVersions.readText(in);}
                return new JSONObject().put("text",text);
            }
            if(action.equals("revise")){
                File dest=temp();
                try{
                    FileVersions.revise(source,path,args.getString("text"),dest);
                    return save(dest,meta.getString("name"),zip?"application/zip":"text/plain",origin,id);
                }finally{dest.delete();}
            }
            throw new IOException("Unknown file action.");
        }finally{source.delete();}
    }
}
