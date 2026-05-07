package com.maeumgido.app;

import android.app.AlarmManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

@CapacitorPlugin(name = "NativeAlarm")
public class NativeAlarmPlugin extends Plugin {

    /**
     * JS에서 호출: NativeAlarm.schedule({ alarms: [{id, title, body, weekday, hour, minute}] })
     * SharedPreferences에 저장하고 AlarmManager에 등록
     */
    @PluginMethod
    public void schedule(PluginCall call) {
        JSArray alarms = call.getArray("alarms");
        if (alarms == null) {
            call.reject("alarms array is required");
            return;
        }
        try {
            JSONArray json = new JSONArray(alarms.toString());
            AlarmScheduler.saveAlarms(getContext(), json.toString());
            AlarmScheduler.scheduleAll(getContext(), json);
            call.resolve();
        } catch (Exception e) {
            call.reject("schedule failed: " + e.getMessage());
        }
    }

    /**
     * JS에서 호출: NativeAlarm.cancel()
     * 모든 등록된 알람 취소 (스케줄 변경 전 호출)
     */
    @PluginMethod
    public void cancel(PluginCall call) {
        try {
            AlarmScheduler.cancelAll(getContext());
            call.resolve();
        } catch (Exception e) {
            call.reject("cancel failed: " + e.getMessage());
        }
    }

    /**
     * 알람 상태 조회:
     *   - canScheduleExactAlarms: 정확한 알람 권한 여부 (Android 12+)
     *   - isBatteryOptimized: 배터리 최적화 대상 여부 (true면 알람 차단 가능)
     */
    @PluginMethod
    public void getAlarmStatus(PluginCall call) {
        JSObject result = new JSObject();

        // 정확한 알람 권한
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) getContext().getSystemService(android.content.Context.ALARM_SERVICE);
            result.put("canScheduleExactAlarms", am.canScheduleExactAlarms());
        } else {
            result.put("canScheduleExactAlarms", true);
        }

        // 배터리 최적화 여부
        PowerManager pm = (PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
        String pkg = getContext().getPackageName();
        result.put("isBatteryOptimized", !pm.isIgnoringBatteryOptimizations(pkg));

        call.resolve(result);
    }

    /**
     * 배터리 최적화 제외 설정 화면 열기
     */
    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        try {
            String pkg = getContext().getPackageName();
            PowerManager pm = (PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);

            Intent intent;
            if (!pm.isIgnoringBatteryOptimizations(pkg)) {
                // 직접 이 앱에 대한 배터리 최적화 제외 요청
                intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + pkg));
            } else {
                // 이미 제외됨 → 배터리 최적화 목록 화면으로
                intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("openBatterySettings failed: " + e.getMessage());
        }
    }

    /**
     * 정확한 알람 권한 설정 화면 열기 (Android 12+)
     */
    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("openExactAlarmSettings failed: " + e.getMessage());
        }
    }
}
