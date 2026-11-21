package com.nth.notaai;

import android.Manifest;
import android.app.Activity;
import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.*;
import android.content.pm.*;
import android.location.*;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import java.util.*;
import java.io.IOException;
import java.util.concurrent.*;
import org.json.JSONArray;
import org.json.JSONObject;

final class PhoneHelp {
    static final int LOCATION=430, MIC=431;
    private final Activity activity;
    private final SharedPreferences prefs;
    private final LocalWeather forecasts=new LocalWeather();
    private final PackageManager pm;
    private final LocationManager locations;
    private static final Map<String,String> pages=new LinkedHashMap<>();
    static {
        pages.put("phone",Settings.ACTION_SETTINGS); pages.put("wifi",Settings.ACTION_WIFI_SETTINGS);
        pages.put("bluetooth",Settings.ACTION_BLUETOOTH_SETTINGS);pages.put("location",Settings.ACTION_LOCATION_SOURCE_SETTINGS);
        pages.put("display",Settings.ACTION_DISPLAY_SETTINGS);pages.put("battery",Settings.ACTION_BATTERY_SAVER_SETTINGS);
        pages.put("sound",Settings.ACTION_SOUND_SETTINGS);pages.put("notifications","android.settings.NOTIFICATION_SETTINGS");
    }

    PhoneHelp(Activity activity){
        this.activity=activity;pm=activity.getPackageManager();
        prefs=activity.getSharedPreferences("phone-help",Context.MODE_PRIVATE);
        locations=activity.getSystemService(LocationManager.class);
    }
    private boolean granted(String p){return activity.checkSelfPermission(p)==PackageManager.PERMISSION_GRANTED;}
    private boolean hasUsage(){
        AppOpsManager ops=activity.getSystemService(AppOpsManager.class);
        return ops!=null && ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,android.os.Process.myUid(),activity.getPackageName())==AppOpsManager.MODE_ALLOWED;
    }
    private boolean enabledLocation(){return prefs.getBoolean("follow",false)&&granted(Manifest.permission.ACCESS_COARSE_LOCATION);}
    private boolean locationServices(){
        if(locations==null)return false;
        if(Build.VERSION.SDK_INT>=28)return locations.isLocationEnabled();
        return locations.isProviderEnabled(LocationManager.NETWORK_PROVIDER)||locations.isProviderEnabled(LocationManager.GPS_PROVIDER);
    }
    String status(){
        try{return new JSONObject().put("weather",prefs.getBoolean("weather",false)).put("follow",enabledLocation())
            .put("city",prefs.getString("city","")).put("locationService",locationServices()).put("usage",hasUsage())
            .put("mic",granted(Manifest.permission.RECORD_AUDIO)).toString();}
        catch(Exception e){return "{}";}
    }
    void configure(String key,String value){
        switch(key){
            case "follow":
                if(enabledLocation()){prefs.edit().putBoolean("follow",false).apply();break;}
                if(granted(Manifest.permission.ACCESS_COARSE_LOCATION))enableFollow();
                else activity.requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION},LOCATION);
                break;
            case "weather":prefs.edit().putBoolean("weather",Boolean.parseBoolean(value)).apply();break;
            case "city":prefs.edit().putString("city",value.trim().substring(0,Math.min(value.trim().length(),90))).apply();
                if(!value.trim().isEmpty())prefs.edit().putBoolean("weather",true).apply();break;
            case "mic":if(!granted(Manifest.permission.RECORD_AUDIO))activity.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},MIC);break;
            case "usage":
                Intent usage=new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS,Uri.fromParts("package",activity.getPackageName(),null));
                if(!open(usage))open(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS));break;
            case "info":open(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.fromParts("package",activity.getPackageName(),null)));break;
            case "locationSettings":open(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));break;
            default:break;
        }
    }
    void permissionResult(int code){if(code==LOCATION&&granted(Manifest.permission.ACCESS_COARSE_LOCATION))enableFollow();}
    private void enableFollow(){prefs.edit().putBoolean("weather",true).putBoolean("follow",true).apply();}
    private boolean open(Intent intent){try{activity.startActivity(intent);return true;}catch(ActivityNotFoundException|SecurityException e){return false;}}
    boolean launch(String kind,String id){
        if("setting".equals(kind)&&pages.containsKey(id))return open(new Intent(pages.get(id)));
        if(!"app".equals(kind))return false;
        ComponentName c=ComponentName.unflattenFromString(id);
        if(c==null)return false;
        Intent base=new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).setPackage(c.getPackageName());
        for(ResolveInfo r:pm.queryIntentActivities(base,0)){
            ActivityInfo ai=r.activityInfo;
            if(ai!=null&&ai.exported&&ai.name.equals(c.getClassName()))return open(base.setComponent(c).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        }
        return false;
    }
    private static JSONObject reply(String text)throws Exception{return new JSONObject().put("text",text);}
    private static JSONObject action(String type,String value,String label)throws Exception{
        return new JSONObject().put("type",type).put("value",value).put("label",label);
    }
    private static JSONObject setup(String text,String page)throws Exception{
        return reply(text).put("actions",new JSONArray().put(action("setup",page,"Open phone setup")));
    }
    JSONObject answer(JSONObject call)throws Exception{
        String val=call.optString("value").trim();
        switch(call.optString("type")){
            case "weather":return weather(val,call.optString("period","now"));
            case "location":return currentArea();
            case "device":return reply("This phone is a "+Build.MANUFACTURER+" "+Build.MODEL+" running Android "+Build.VERSION.RELEASE+".");
            case "storage":{
                StatFs space=new StatFs(activity.getFilesDir().getPath());
                return reply(android.text.format.Formatter.formatFileSize(activity,space.getAvailableBytes())+" of internal storage is available.");
            }
            case "battery":{
                BatteryManager b=activity.getSystemService(BatteryManager.class);int percent=b==null?-1:b.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
                return reply(percent<0||percent>100?"Android couldn’t report the battery level.":"Your battery is at "+percent+"%"+(b.isCharging()?" and charging.":"."));
            }
            case "setting":{
                if(!pages.containsKey(val))return reply("That settings page is unavailable.");
                String label=("phone".equals(val)?"Phone":val.equals("wifi")?"Wi-Fi":val.substring(0,1).toUpperCase(Locale.ROOT)+val.substring(1))+" settings";
                return reply("Tap below to open "+label+".").put("actions",new JSONArray().put(action("setting",val,label)));
            }
            case "app":return apps(val,false);
            case "recent":return apps("",true);
            default:throw new IllegalArgumentException("Unknown phone request");
        }
    }
    private JSONObject apps(String name,boolean recent)throws Exception{
        if(recent&&!hasUsage())return setup("Turn on Usage Access to see apps you opened recently. This list stays on your phone.","usage");
        Intent list=new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> all=pm.queryIntentActivities(list,0);
        all.sort(new ResolveInfo.DisplayNameComparator(pm));
        Map<String,Long> times=new HashMap<>();
        if(recent){
            UsageStatsManager mgr=activity.getSystemService(UsageStatsManager.class);
            long now=System.currentTimeMillis();
            UsageEvents events=mgr==null?null:mgr.queryEvents(now-TimeUnit.HOURS.toMillis(24),now);
            if(events==null)return reply("Android hasn’t supplied recent app activity. Unlock the phone and try again.");
            UsageEvents.Event row=new UsageEvents.Event();
            while(events.hasNextEvent()){
                events.getNextEvent(row);
                if(row.getEventType()==UsageEvents.Event.MOVE_TO_FOREGROUND)times.put(row.getPackageName(),row.getTimeStamp());
            }
            all.sort((a,b)->Long.compare(times.getOrDefault(b.activityInfo.packageName,0L),times.getOrDefault(a.activityInfo.packageName,0L)));
        }
        JSONArray exact=new JSONArray(),possible=new JSONArray();Set<String> seen=new HashSet<>();
        String target=name.toLowerCase(Locale.ROOT);
        for(ResolveInfo r:all){
            ActivityInfo ai=r.activityInfo;if(ai==null||!ai.exported||activity.getPackageName().equals(ai.packageName))continue;
            String label=r.loadLabel(pm).toString();
            if(recent&&(!times.containsKey(ai.packageName)||!seen.add(ai.packageName)))continue;
            boolean same=label.equalsIgnoreCase(name);
            if(!recent&&!same&&(target.isEmpty()||!label.toLowerCase(Locale.ROOT).contains(target)))continue;
            JSONArray dest=same?exact:possible;
            if(dest.length()<8)dest.put(action("app",new ComponentName(ai.packageName,ai.name).flattenToString(),label));
        }
        JSONArray items=exact.length()>0?exact:possible;
        String text;
        if(recent){
            List<String> names=new ArrayList<>();for(int i=0;i<items.length();i++)names.add(items.getJSONObject(i).getString("label"));
            text=names.isEmpty()?"No recently opened apps were reported for this profile in the past 24 hours.":"Your recent apps, newest first: "+String.join(", ",names)+".";
        }else text=items.length()==0?"I couldn’t find a launchable app named "+name+" in this phone profile.":items.length()==1?"Tap below to open "+items.getJSONObject(0).getString("label")+".":"I found several matches. Choose the app you want.";
        return reply(text).put("actions",items);
    }

    private boolean canLocate(){return enabledLocation() && locationServices();}

    private JSONObject missingArea(String reason)throws Exception{
        String saved=prefs.getString("city","").trim();
        if(!saved.isEmpty())reason+=saved.matches("[0-9]{5}(?:-[0-9]{4})?")
            ?" Your saved weather ZIP is "+saved+".":" Your saved weather place is "+saved+".";
        return setup(reason,"weather");
    }

    private JSONObject currentArea()throws Exception{
        if(!enabledLocation())return missingArea("Turn on approximate location in Phone setup to find your current area.");
        if(!locationServices())return missingArea("Phone location is off. Turn it on to find your current area.");
        Location point=position(2);
        if(point==null)return missingArea("I couldn’t get your current location.");
        if(!canLocate())return missingArea("Location access changed before I could check your area.");
        String name=AreaName.lookup(activity,point);
        if(!canLocate())return missingArea("Location access changed before I could check your area.");
        if(name.isEmpty())return reply("Your phone provided an approximate position, but Android couldn’t name the area.").put("retryable",true);
        return reply("Your phone places you in or near "+name+". This is an approximate location.");
    }

    private JSONObject weather(String asked,String period)throws Exception{
        if(!prefs.getBoolean("weather",false))return setup("For a local forecast, choose approximate location or save a city or ZIP in Phone setup. You can also enable weather for places you type.","weather");
        String place=asked;String saved=prefs.getString("city",""); Location point=null;
        if(place.isEmpty() && canLocate())point=position(15);
        boolean fromPhone=point!=null;
        if(point==null && place.isEmpty())place=saved;
        if(point==null && place.isEmpty())return setup("I couldn’t get your current area. Check phone location or save a city or ZIP, then retry your question.","weather");
        String label,areaNote;
        if(fromPhone){
            if(!canLocate())return setup("Location access changed. Review Phone setup and retry.","weather");
            String name=AreaName.lookup(activity,point);
            label=name.isEmpty()?"your current area":name+" (approximate location)";
            areaNote=name.isEmpty()?"That forecast used your phone’s approximate position. Android couldn’t name the area."
                :"That forecast used your phone’s approximate location near "+name+".";
        }else{
            if(!Geocoder.isPresent())return setup("This phone has no city lookup service. Choose approximate location to get a forecast.","weather");
            List<Address> matches;
            try{matches=new Geocoder(activity,Locale.getDefault()).getFromLocationName(place,4);}
            catch(IOException e){return setup("Android couldn’t look up "+place+". Check your connection or use approximate location.","weather");}
            if(matches==null||matches.isEmpty())return setup("I couldn’t locate "+place+". Try a city with its state or country, or use your ZIP code.","weather");
            Address address=matches.get(0);
            if(!address.hasLatitude()||!address.hasLongitude())return setup("There’s no map position for that place. Try a more specific city or ZIP.","weather");
            label=placeName(address,place);
            if(matches.size()>1&&!place.matches(".*[,0-9].*")){
                Address other=matches.get(1);
                if(other.hasLatitude()&&other.hasLongitude()&&(Math.abs(address.getLatitude()-other.getLatitude())>1||Math.abs(address.getLongitude()-other.getLongitude())>1))
                    return reply("Several places match "+place+", including "+label+" and "+placeName(other,place)+". Ask again with the state or country.");
            }
            point=new Location("place");point.setLatitude(address.getLatitude());point.setLongitude(address.getLongitude());
            String resolved=label.equalsIgnoreCase(place)?place:place+" ("+label+")";
            if(asked.isEmpty()){
                areaNote="That forecast used your saved weather place, "+resolved+".";
                label+=" (saved place)";
            }else areaNote="That forecast used the place you asked for, "+resolved+".";
        }
        if(Thread.currentThread().isInterrupted())throw new InterruptedException();
        if(!prefs.getBoolean("weather",false) || (fromPhone&&!canLocate()))return setup("Location or weather access changed. Review Phone setup and try again.","weather");
        boolean f=Arrays.asList("US","BS","KY","PW").contains(Locale.getDefault().getCountry());
        try{
            JSONObject result=forecasts.forecast(point.getLatitude(),point.getLongitude(),label,period,f);
            if(!prefs.getBoolean("weather",false)||(fromPhone&&!canLocate()))return setup("Location or weather access changed. Review Phone setup and try again.","weather");
            return result.put("weatherData",true).put("forecastArea",areaNote);
        }
        catch(IOException e){return reply("I couldn’t get a fresh forecast for "+label+". Check your connection and retry.").put("retryable",true);}
    }
    private static String placeName(Address a,String fallback){
        Set<String> parts=new LinkedHashSet<>();
        for(String s:new String[]{a.getLocality(),a.getAdminArea(),a.getCountryCode()})if(s!=null&&!s.isEmpty())parts.add(s);
        return a.getLocality()==null?fallback:String.join(", ",parts);
    }

    private static boolean fresh(Location p,long maxAgeMinutes){
        if(p==null||p.getElapsedRealtimeNanos()<=0)return false;
        long age=SystemClock.elapsedRealtimeNanos()-p.getElapsedRealtimeNanos();
        return age>=0&&age<=TimeUnit.MINUTES.toNanos(maxAgeMinutes);
    }
    @android.annotation.SuppressLint("MissingPermission")
    private Location position(long maxAgeMinutes) throws InterruptedException {
        List<String> providers=new ArrayList<>();
        for(String name:Arrays.asList("fused",LocationManager.NETWORK_PROVIDER,LocationManager.PASSIVE_PROVIDER))
            if(locations.getProviders(true).contains(name))providers.add(name);
        Location best=null;
        for(String name:providers){
            try{Location p=locations.getLastKnownLocation(name);if(fresh(p,maxAgeMinutes)&&(best==null||p.getElapsedRealtimeNanos()>best.getElapsedRealtimeNanos()))best=p;}
            catch(SecurityException|IllegalArgumentException ignored){}
        }
        if(best!=null)return best;
        BlockingQueue<Location> queue=new ArrayBlockingQueue<>(1);
        LocationListener listener=new LocationListener(){
            public void onLocationChanged(Location p){if(fresh(p,maxAgeMinutes))queue.offer(p);}
            public void onStatusChanged(String p,int s,Bundle b){}
            public void onProviderEnabled(String p){}
            public void onProviderDisabled(String p){}
        };
        boolean requested=false;
        try{
            for(String name:providers)if(!LocationManager.PASSIVE_PROVIDER.equals(name)){
                try{locations.requestLocationUpdates(name,0,0,listener,Looper.getMainLooper());requested=true;}
                catch(SecurityException|IllegalArgumentException ignored){}
            }
            return requested?queue.poll(12,TimeUnit.SECONDS):null;
        }finally{if(requested)locations.removeUpdates(listener);}
    }
}
