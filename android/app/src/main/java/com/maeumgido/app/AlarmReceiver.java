package com.maeumgido.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

public class AlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "MaeumGido.AlarmReceiver";
    private static final String CHANNEL_ID = "prayer-alarm";

    @Override
    public void onReceive(Context context, Intent intent) {
        int id        = intent.getIntExtra("id", 0);
        String title  = intent.getStringExtra("title");
        String body   = intent.getStringExtra("body");
        int weekday   = intent.getIntExtra("weekday", 1);
        int hour      = intent.getIntExtra("hour", 0);
        int minute    = intent.getIntExtra("minute", 0);

        if (title == null) title = "기도 시간입니다";
        if (body  == null) body  = "";

        Log.d(TAG, "onReceive: id=" + id + " title=" + title);

        postNotification(context, id, title, body);

        // 한 번만 실행되는 exact alarm이므로 다음 주를 위해 재등록
        AlarmScheduler.scheduleAlarm(context, id, title, body, weekday, hour, minute);
    }

    private void postNotification(Context context, int id, String title, String body) {
        NotificationManager nm =
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        ensureChannel(nm);

        // 알림 탭 시 앱 열기
        Intent openIntent = context.getPackageManager()
            .getLaunchIntentForPackage(context.getPackageName());
        if (openIntent != null) {
            openIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        }
        PendingIntent openPi = PendingIntent.getActivity(
            context, id, openIntent != null ? openIntent : new Intent(),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        int iconRes = context.getResources().getIdentifier(
            "ic_launcher_foreground", "drawable", context.getPackageName()
        );
        if (iconRes == 0) {
            iconRes = android.R.drawable.ic_popup_reminder;
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(iconRes)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(openPi)
            .setVibrate(new long[]{0, 500, 100, 500});

        nm.notify(id, builder.build());
        Log.d(TAG, "postNotification: id=" + id);
    }

    private void ensureChannel(NotificationManager nm) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "기도 알림", NotificationManager.IMPORTANCE_HIGH
                );
                ch.setDescription("기도 시간을 알려주는 알림");
                ch.enableVibration(true);
                nm.createNotificationChannel(ch);
            }
        }
    }
}
