package com.nth.notaai;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import javax.net.ssl.HttpsURLConnection;

/** Forecasts are fetched on demand; the cache holds one rounded grid point in memory. */
final class LocalWeather {
    private JSONObject cached;
    private String grid = "";
    private long expires;

    synchronized JSONObject forecast(double lat, double lon, String label, String period, boolean fahrenheit) throws Exception {
        String key=String.format(Locale.ROOT,"lat=%.2f&lon=%.2f",AreaName.rounded(lat),AreaName.rounded(lon));
        if (cached==null || !grid.equals(key) || System.currentTimeMillis()>=expires) {
            if (Thread.currentThread().isInterrupted()) throw new InterruptedException();
            HttpsURLConnection http=(HttpsURLConnection)new URL("https://api.met.no/weatherapi/locationforecast/2.0/compact?"+key).openConnection();
            try {
                http.setRequestProperty("User-Agent","NthNotaAI/0.12.3 (https://github.com/bdredenbach)");
                http.setRequestProperty("Accept","application/json");
                http.setConnectTimeout(9000); http.setReadTimeout(12000);
                if(http.getResponseCode()!=200)throw new IOException("Forecast service unavailable");
                try(InputStream in=http.getInputStream()){
                    JSONObject data=new JSONObject(Gateway.readUtf8(in,1024*1024)).getJSONObject("properties");
                    if(data.getJSONArray("timeseries").length()==0)throw new IOException("Empty forecast");
                    cached=data;grid=key;expires=http.getExpiration();
                }
            } finally {http.disconnect();}
        }
        String reply=describe(cached,label,period,fahrenheit,Instant.now(),ZoneId.systemDefault());
        return new JSONObject().put("text",reply).put("sources",new JSONArray().put(new JSONObject()
            .put("title","Forecast by MET Norway · CC BY 4.0").put("url","https://api.met.no/weatherapi/locationforecast/2.0/documentation")));
    }

    static String describe(JSONObject data,String label,String period,boolean f,Instant now,ZoneId zone) throws Exception {
        JSONArray rows=data.getJSONArray("timeseries");
        LocalDate date=now.atZone(zone).toLocalDate().plusDays("tomorrow".equals(period)?1:0);
        JSONObject current=null; Instant valid=null;
        double low=Double.POSITIVE_INFINITY,high=Double.NEGATIVE_INFINITY,rain=0;
        int hours=0;
        String daySummary="";int bestHour=25;
        for(int i=0;i<rows.length();i++){
            JSONObject row=rows.getJSONObject(i);
            Instant time=Instant.parse(row.getString("time"));
            JSONObject values=row.getJSONObject("data");
            if(!time.isAfter(now) && now.isBefore(time.plusSeconds(3600))){current=values;valid=time;}
            ZonedDateTime local=time.atZone(zone);
            JSONObject next=values.optJSONObject("next_1_hours");
            if(!local.toLocalDate().equals(date)||next==null||!now.isBefore(time.plusSeconds(3600)))continue;
            double t=values.getJSONObject("instant").getJSONObject("details").getDouble("air_temperature");
            low=Math.min(low,t);high=Math.max(high,t);hours++;
            rain+=next.getJSONObject("details").optDouble("precipitation_amount",0);
            int distance=Math.abs(12-local.getHour());
            if(distance<bestHour){bestHour=distance;daySummary=condition(next);}
        }
        String result;
        if("now".equals(period)){
            if(current==null)throw new IOException("No current forecast period");
            JSONObject instant=current.getJSONObject("instant").getJSONObject("details");
            JSONObject next=current.optJSONObject("next_1_hours");
            String sky=next==null?"":condition(next);
            result="The forecast for "+label+" is "+temp(instant.getDouble("air_temperature"),f)+(sky.isEmpty()?"":" with "+sky)+".";
            if(instant.has("wind_speed"))result+=" Wind is about "+Math.round(instant.getDouble("wind_speed")*(f?2.23694:3.6))+(f?" mph.":" km/h.");
            result+="\n\nForecast for "+valid.atZone(zone).format(DateTimeFormatter.ofPattern("EEE, MMM d · h a z",Locale.US))+".";
        }else{
            if(hours==0)throw new IOException("No hourly data for that day");
            result=("tomorrow".equals(period)?"Tomorrow":"Today")+" in "+label+", the available hourly forecast ranges from "+temp(low,f)+" to "+temp(high,f)+".";
            if(!daySummary.isEmpty())result+=" Expect "+daySummary+" around "+(bestHour==0?"midday":"the middle of the available period")+".";
            result+=String.format(Locale.US," About %.1f %s of precipitation is forecast across those hours.",f?rain/25.4:rain,f?"in":"mm");
            result+="\n\n"+date.format(DateTimeFormatter.ofPattern("EEE, MMM d",Locale.US))+" · "+zone.getId()+" (phone time zone).";
        }
        return result;
    }
    private static String temp(double c,boolean f){return Math.round(f?c*9/5+32:c)+(f?"°F":"°C");}
    private static String condition(JSONObject interval){
        String s=interval.optJSONObject("summary")==null?"":interval.optJSONObject("summary").optString("symbol_code").split("_")[0];
        return s.replace("partlycloudy","partly cloudy skies").replace("clearsky","clear skies").replace("fair","mostly clear skies")
            .replace("light","light ").replace("heavy","heavy ").replace("showers"," showers").replace("andthunder"," and thunder").trim();
    }
}
