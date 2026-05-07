package com.maeumgido.app;

import com.getcapacitor.JSArray;
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
}
