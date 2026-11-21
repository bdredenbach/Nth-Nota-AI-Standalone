package com.nth.notaai;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.location.*;
import android.os.SystemClock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import org.robolectric.shadows.ShadowLocationManager;
import org.robolectric.util.ReflectionHelpers;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,manifest=Config.NONE,shadows=PhoneLocationTest.TestGeocoder.class)
public class PhoneLocationTest {
    @Implements(Geocoder.class)
    public static class TestGeocoder {
        static List<Address> addresses;
        static double lat,lon;
        @Implementation protected static boolean isPresent(){return true;}
        @Implementation protected void getFromLocation(double latitude,double longitude,int max,Geocoder.GeocodeListener callback){
            lat=latitude;lon=longitude;callback.onGeocode(addresses);
        }
        @Implementation protected List<Address> getFromLocationName(String name,int max){return addresses;}
    }
    private SharedPreferences prefs;
    private PhoneHelp phone;
    private ShadowLocationManager locations;
    private Address area;
    @Before public void setup(){
        Activity a=Robolectric.buildActivity(Activity.class).setup().get();
        prefs=a.getSharedPreferences("phone-help",Context.MODE_PRIVATE);
        prefs.edit().clear().putBoolean("follow",true).putBoolean("weather",true).putString("city","14105").commit();
        shadowOf(a.getApplication()).grantPermissions(Manifest.permission.ACCESS_COARSE_LOCATION);
        LocationManager manager=a.getSystemService(LocationManager.class);
        locations=shadowOf(manager);
        locations.setLocationEnabled(true);
        locations.setProviderEnabled(LocationManager.NETWORK_PROVIDER,true);
        Location fix=new Location(LocationManager.NETWORK_PROVIDER);
        fix.setLatitude(42.8911);fix.setLongitude(-78.8777);fix.setElapsedRealtimeNanos(SystemClock.elapsedRealtimeNanos());
        locations.setLastKnownLocation(LocationManager.NETWORK_PROVIDER,fix);
        area=new Address(Locale.US);area.setLocality("Buffalo");area.setAdminArea("New York");area.setCountryCode("US");
        area.setAddressLine(0,"Private street address");area.setLatitude(42.8911);area.setLongitude(-78.8777);
        TestGeocoder.addresses=Collections.singletonList(area);
        TestGeocoder.lat=Double.NaN;
        phone=new PhoneHelp(a);
    }
    private JSONObject ask(String type,String place)throws Exception{
        return phone.answer(new JSONObject().put("type",type).put("value",place));
    }
    private void cacheForecast()throws Exception{
        LocalWeather weather=ReflectionHelpers.getField(phone,"forecasts");
        String time=Instant.now().truncatedTo(ChronoUnit.HOURS).toString();
        JSONObject hour=new JSONObject("{\"data\":{\"instant\":{\"details\":{\"air_temperature\":10}}}}").put("time",time);
        ReflectionHelpers.setField(weather,"grid","lat=42.89&lon=-78.88");
        ReflectionHelpers.setField(weather,"cached",new JSONObject().put("timeseries",new JSONArray().put(hour)));
        ReflectionHelpers.setField(weather,"expires",System.currentTimeMillis()+60000);
    }
    @Test public void directAreaUsesOnlyCoarseLabelWithWeatherDisabled()throws Exception{
        prefs.edit().putBoolean("weather",false).commit();
        String reply=ask("location","").getString("text");
        assertTrue(reply,reply.contains("Buffalo, New York, US"));
        assertFalse(reply.contains("Private street"));assertFalse(reply.contains("14105"));
        assertEquals(42.89,TestGeocoder.lat,0.00001);assertEquals(-78.88,TestGeocoder.lon,0.00001);
    }
    @Test public void disabledLocationSeparatesSavedZipFromCurrentArea()throws Exception{
        prefs.edit().putBoolean("follow",false).commit();
        JSONObject result=ask("location","");
        assertTrue(result.getString("text").contains("saved weather ZIP is 14105"));
        assertTrue(result.has("actions"));assertTrue(Double.isNaN(TestGeocoder.lat));
        prefs.edit().putBoolean("follow",true).commit();locations.setLocationEnabled(false);
        assertTrue(ask("location","").getString("text").contains("Phone location is off"));
    }
    @Test public void unavailableFixDoesNotUseSavedZipAsCurrentLocation()throws Exception{
        locations.removeProvider(LocationManager.NETWORK_PROVIDER);locations.removeProvider("fused");
        JSONObject result=ask("location","");
        assertEquals("I couldn’t get your current location. Your saved weather ZIP is 14105.",result.getString("text"));
        assertTrue(Double.isNaN(TestGeocoder.lat));
    }
    @Test public void unnamedPositionNeverSubstitutesSavedCityAndWeatherStillWorks()throws Exception{
        TestGeocoder.addresses=Collections.emptyList();
        assertTrue(ask("location","").getString("text").contains("couldn’t name the area"));
        cacheForecast();JSONObject forecast=ask("weather","");
        assertTrue(forecast.getBoolean("weatherData"));
        assertTrue(forecast.getString("forecastArea").contains("approximate position"));
        assertFalse(forecast.toString().contains("14105"));
    }
    @Test public void forecastsRetainDistinctDeviceSavedAndNamedOrigins()throws Exception{
        cacheForecast();JSONObject device=ask("weather","");
        assertTrue(device.getString("forecastArea").contains("phone’s approximate location near Buffalo"));
        prefs.edit().putBoolean("follow",false).commit();
        JSONObject saved=ask("weather",""),named=ask("weather","Example City");
        assertTrue(saved.getString("forecastArea").contains("saved weather place, 14105"));
        assertTrue(named.getString("forecastArea").contains("place you asked for, Example City"));
        assertFalse(device.toString().contains("Private street"));
        assertFalse(named.toString().contains("14105"));
    }
}
