package com.maeumgido.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;

public class AlarmScheduler {
    private static final String TAG = "MaeumGido.AlarmScheduler";
    private static final String PREFS_NAME = "mgido_native_alarms";
    private static final String KEY_ALARMS = "alarms";

    public static void saveAlarms(Context context, String alarmsJson) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_ALARMS, alarmsJson).apply();
    }

    public static JSONArray loadAlarms(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String json = prefs.getString(KEY_ALARMS, "[]");
        try {
            return new JSONArray(json);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    public static void scheduleAll(Context context, JSONArray alarms) {
        cancelAll(context);
        for (int i = 0; i < alarms.length(); i++) {
            try {
                JSONObject alarm = alarms.getJSONObject(i);
                scheduleAlarm(
                    context,
                    alarm.getInt("id"),
                    alarm.getString("title"),
                    alarm.getString("body"),
                    alarm.getInt("weekday"),
                    alarm.getInt("hour"),
                    alarm.getInt("minute")
                );
            } catch (JSONException e) {
                Log.w(TAG, "Skipping malformed alarm: " + e.getMessage());
            }
        }
        Log.d(TAG, "scheduleAll: registered " + alarms.length() + " alarm(s)");
    }

    public static void rescheduleAll(Context context) {
        JSONArray alarms = loadAlarms(context);
        if (alarms.length() == 0) {
            Log.d(TAG, "rescheduleAll: no saved alarms");
            return;
        }
        scheduleAll(context, alarms);
        Log.d(TAG, "rescheduleAll: restored " + alarms.length() + " alarm(s)");
    }

    public static void cancelAll(Context context) {
        JSONArray alarms = loadAlarms(context);
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        for (int i = 0; i < alarms.length(); i++) {
            try {
                int id = alarms.getJSONObject(i).getInt("id");
                Intent intent = new Intent(context, AlarmReceiver.class);
                PendingIntent pi = PendingIntent.getBroadcast(
                    context, id, intent,
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
                );
                if (pi != null) {
                    am.cancel(pi);
                    pi.cancel();
                }
            } catch (JSONException e) {
                Log.w(TAG, "cancelAll: " + e.getMessage());
            }
        }
        Log.d(TAG, "cancelAll: cancelled " + alarms.length() + " alarm(s)");
    }

    public static void scheduleAlarm(Context context, int id, String title, String body,
                                     int weekday, int hour, int minute) {
        // 이번 주 해당 요일/시간 계산
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.DAY_OF_WEEK, weekday); // 1=일, 2=월, ..., 7=토
        cal.set(Calendar.HOUR_OF_DAY, hour);
        cal.set(Calendar.MINUTE, minute);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);

        // 이미 지났으면 다음 주로
        if (cal.getTimeInMillis() <= System.currentTimeMillis()) {
            cal.add(Calendar.DAY_OF_YEAR, 7);
        }

        Intent intent = new Intent(context, AlarmReceiver.class);
        intent.putExtra("id", id);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        intent.putExtra("weekday", weekday);
        intent.putExtra("hour", hour);
        intent.putExtra("minute", minute);

        PendingIntent pi = PendingIntent.getBroadcast(
            context, id, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
        } else {
            am.setExact(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
        }

        Log.d(TAG, String.format("scheduleAlarm: id=%d at weekday=%d %02d:%02d → %s",
            id, weekday, hour, minute, cal.getTime().toString()));
    }
}
