package com.nth.notaai;

import android.content.Context;
import org.json.JSONObject;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.SQLiteMode;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,manifest=Config.NONE)
@SQLiteMode(SQLiteMode.Mode.NATIVE)
public class FileShelfTest {
    private FileShelf db;
    private Context context;
    @Before public void open(){context=RuntimeEnvironment.getApplication();context.deleteDatabase("saved-files.db");db=new FileShelf(context);}
    @After public void close(){db.close();}
    private byte[] exported(String id)throws Exception{
        ByteArrayOutputStream out=new ByteArrayOutputStream();db.writeTo(id,out);return out.toByteArray();
    }
    private byte[] archive(byte[] companion,String text)throws Exception{
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();
        try(ZipOutputStream zip=new ZipOutputStream(bytes)){
            zip.putNextEntry(new ZipEntry("docs/brief.md"));zip.write(text.getBytes(StandardCharsets.UTF_8));zip.closeEntry();
            zip.putNextEntry(new ZipEntry("images/sample.bin"));zip.write(companion);zip.closeEntry();
        }
        return bytes.toByteArray();
    }
    @Test public void zipRevisionAndExportSurviveRestartAndPreserveCompanion()throws Exception{
        byte[] companion=new byte[2300000];new Random(874).nextBytes(companion);
        String before="# Campaign\n"+"Keep this guideline.\n".repeat(190)+"Meeting: Tuesday.";
        String after=before.replace("Tuesday","Friday");
        byte[] source=archive(companion,before);
        JSONObject a=db.add(new ByteArrayInputStream(source),"campaign.zip","application/zip","thread-one","");
        String id=a.getString("id");
        assertEquals("docs/brief.md",db.operate("members",new JSONObject().put("id",id)).getJSONArray("members").getString(0));
        JSONObject edit=new JSONObject().put("id",id).put("path","docs/brief.md").put("origin","thread-two");
        assertEquals(before,db.operate("read",edit).getString("text"));
        JSONObject b=db.operate("revise",edit.put("text",after));
        assertEquals(id,b.getString("parent"));assertEquals(2,b.getInt("num"));
        assertEquals(a.getString("family"),b.getString("family"));
        db.close();db=new FileShelf(context);
        assertArrayEquals(source,exported(id));
        try(ZipInputStream zip=new ZipInputStream(new ByteArrayInputStream(exported(b.getString("id"))))){
            assertEquals("docs/brief.md",zip.getNextEntry().getName());assertEquals(after,FileVersions.readText(zip));
            assertEquals("images/sample.bin",zip.getNextEntry().getName());
            ByteArrayOutputStream raw=new ByteArrayOutputStream();FileVersions.copy(zip,raw,FileVersions.MAX_FILE);assertArrayEquals(companion,raw.toByteArray());
        }
        String diff=db.operate("compare",new JSONObject().put("id",id).put("other",b.getString("id"))).getString("body");
        assertTrue(diff.contains("Tuesday")&&diff.contains("Friday")&&diff.contains("1 changed entries"));
        try{db.operate("revise",edit.put("path","absent.md"));fail();}catch(IOException expected){}
        assertEquals(2,db.list().length());
        JSONObject c=db.operate("revise",edit.put("path","docs/brief.md").put("text","Separate edit."));
        assertEquals(3,c.getInt("num"));assertEquals(id,c.getString("parent"));
        db.operate("delete",new JSONObject().put("id",b.getString("id")));assertEquals(0,db.list().length());
        try(android.database.Cursor rows=db.getReadableDatabase().rawQuery("SELECT COUNT(*) FROM chunks",null)){
            rows.moveToFirst();assertEquals(0,rows.getInt(0));
        }
    }
    @Test public void changedExportsJoinTheOriginalHistory()throws Exception{
        JSONObject args=new JSONObject().put("origin","card-plan").put("name","plan.md").put("text","Meet Tuesday.");
        JSONObject first=db.operate("export",args);
        assertEquals(first.getString("id"),db.operate("export",args).getString("id"));
        JSONObject next=db.operate("export",args.put("text","Meet Friday."));
        assertEquals(first.getString("family"),next.getString("family"));
        assertEquals(2,next.getInt("num"));assertEquals(2,db.list().length());
    }
    @Test public void repeatedArtifactSaveAndLegacyImportHaveStableIdentity()throws Exception{
        JSONObject input=new JSONObject().put("name","notes.md").put("key","output-123").put("text","original").put("origin","thread-a");
        assertEquals(db.operate("artifact",input).getString("id"),db.operate("artifact",input).getString("id"));
        JSONObject legacy=db.operate("legacy",input.put("name","notes.zip.preview.md"));
        assertEquals(legacy.getString("id"),db.operate("legacy",input).getString("id"));
        JSONObject sameName=db.operate("save",input.put("name","notes.md"));
        assertEquals(1,sameName.getInt("num"));assertEquals(3,db.list().length());
    }
}
