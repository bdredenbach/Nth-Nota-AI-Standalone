package com.nth.notaai;

import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.zip.*;

/** Edits one text member without unpacking archive paths into the filesystem. */
final class FileVersions {
    static final int MAX_FILE = 16 * 1024 * 1024;
    static final int EDIT_CHARS = 12000;
    private static final int MAX_ENTRIES = 1500;
    private static final int REPACK_LIMIT = 64 * 1024 * 1024;

    static int copy(InputStream in, OutputStream out, int limit) throws IOException {
        byte[] buf = new byte[32768];
        int size = 0;
        for (int n; (n = in.read(buf)) != -1;) {
            size += n;
            if (size > limit) throw new IOException("This file exceeds the size limit for this operation.");
            out.write(buf, 0, n);
        }
        return size;
    }
    static boolean readable(String name) {
        return name.toLowerCase(Locale.ROOT).matches(".*\\.(md|markdown|txt|csv|log|json)");
    }
    static byte[] encoded(String text) throws IOException {
        if (text.length() > EDIT_CHARS) throw new IOException("Edits support up to 12,000 characters.");
        return text.getBytes(StandardCharsets.UTF_8);
    }
    static String readText(InputStream in) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        copy(in, bytes, EDIT_CHARS * 4);
        String result = StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes.toByteArray())).toString();
        if (result.length() > EDIT_CHARS || result.indexOf('\0') >= 0)
            throw new IOException("Choose a UTF-8 text file of up to 12,000 characters to edit.");
        return result;
    }
    static List<String> members(File file) throws IOException {
        List<String> names = new ArrayList<>();
        try (ZipFile zip = new ZipFile(file)) {
            if (zip.size()>MAX_ENTRIES) throw new IOException("This ZIP has too many entries to edit.");
            Enumeration<? extends ZipEntry> entries = zip.entries();
            while (entries.hasMoreElements()) {
                ZipEntry e = entries.nextElement();
                if (!e.isDirectory() && readable(e.getName()) && e.getSize() <= EDIT_CHARS*4) names.add(e.getName());
            }
        }
        return names;
    }
    static String member(File file, String path) throws IOException {
        try (ZipFile zip = new ZipFile(file)) {
            ZipEntry entry = zip.getEntry(path);
            if(entry==null || entry.isDirectory() || !readable(path)) throw new IOException("Choose a readable text file in this ZIP.");
            try(InputStream in=zip.getInputStream(entry)){return readText(in);}
        }
    }
    static void revise(File original, String path, String text, File output) throws IOException {
        byte[] replacement = encoded(text);
        if(path.isEmpty()){Files.write(output.toPath(),replacement);return;}
        member(original,path); // Only complete, editable text can be replaced.
        try(ZipFile zip=new ZipFile(original); ZipOutputStream out=new ZipOutputStream(new BufferedOutputStream(new FileOutputStream(output)))) {
            if(zip.size()>MAX_ENTRIES)throw new IOException("This ZIP has too many entries to edit.");
            int left=REPACK_LIMIT;
            Enumeration<? extends ZipEntry> entries=zip.entries();
            while(entries.hasMoreElements()){
                ZipEntry old=entries.nextElement();
                ZipEntry next=new ZipEntry(old.getName());
                if(old.getTime()>=0)next.setTime(old.getTime());
                next.setComment(old.getComment());
                out.putNextEntry(next);
                if(path.equals(old.getName()))out.write(replacement);
                else if(!old.isDirectory())try(InputStream in=zip.getInputStream(old)){left-=copy(in,out,left);}
                out.closeEntry();
            }
            if(zip.getComment()!=null)out.setComment(zip.getComment());
        }
    }
    private static String excerpt(String text,int length){
        return text.length()<=length?text:text.substring(0,length/2)+"\n[…]\n"+text.substring(text.length()-length/2);
    }
    private static String difference(String before,String after){
        if(before.equals(after))return "The text is identical.";
        int start=0,end=0,shorter=Math.min(before.length(),after.length());
        while(start<shorter && before.charAt(start)==after.charAt(start))start++;
        while(end<shorter-start && before.charAt(before.length()-1-end)==after.charAt(after.length()-1-end))end++;
        int left=Math.max(0,start-120);
        return "A — before:\n"+excerpt(before.substring(left,Math.min(before.length(),before.length()-end+120)),2700)
            +"\nB — after:\n"+excerpt(after.substring(left,Math.min(after.length(),after.length()-end+120)),2700);
    }
    static String compare(File a, boolean zipA, String previewA, File b, boolean zipB, String previewB) throws IOException {
        if(!zipA && !zipB){
            try(InputStream x=new FileInputStream(a);InputStream y=new FileInputStream(b)){return difference(readText(x),readText(y));}
            catch(IOException longer){/* Use the truthful bounded previews below. */}
        }
        if(zipA&&zipB)try(ZipFile x=new ZipFile(a);ZipFile y=new ZipFile(b)){
            if(x.size()<=MAX_ENTRIES && y.size()<=MAX_ENTRIES){
                Set<String> paths=new LinkedHashSet<>();
                x.stream().forEach(e->paths.add(e.getName()));
                y.stream().forEach(e->paths.add(e.getName()));
                StringBuilder listing=new StringBuilder(),details=new StringBuilder();
                int changes=0,shown=0;
                for(String path:paths){
                    ZipEntry first=x.getEntry(path),second=y.getEntry(path);
                    if(first!=null&&second!=null&&first.getCrc()==second.getCrc()&&first.getSize()==second.getSize())continue;
                    changes++;
                    if(listing.length()>2500)continue;
                    listing.append(first==null?"Added: ":second==null?"Removed: ":"Changed: ").append(AttachedFile.label(path)).append('\n');
                    shown++;
                    if(readable(path)&&details.length()<6000){
                        try{
                            String old=first==null?"":member(a,path),updated=second==null?"":member(b,path);
                            details.append('\n').append(AttachedFile.label(path)).append('\n').append(excerpt(difference(old,updated),Math.min(5500,6500-details.length()))).append('\n');
                        }catch(IOException large){details.append("\nText unavailable for ").append(AttachedFile.label(path)).append('\n');}
                    }
                }
                return changes==0?"Archive entry names and content checksums match.":changes+" changed entries. "+shown+" listed.\n"+listing+details;
            }
        }
        return "Comparison uses the saved previews.\nA:\n"+excerpt(previewA,5200)+"\nB:\n"+excerpt(previewB,5200);
    }
}
