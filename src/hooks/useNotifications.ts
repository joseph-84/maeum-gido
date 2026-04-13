// ============================================================
// hooks/useNotifications.ts — Capacitor LocalNotifications 래퍼
// ============================================================
//
// 역할:
//   - 기도 스케줄 알림 등록 / 취소 / 권한 요청
//   - Schedule 타입과 1:1 매핑하여 알림 ID 관리
//   - 앱이 재시작되어도 알림이 유지되도록 재등록 처리
//
// Capacitor 플러그인:
//   npm install @capacitor/local-notifications
//   npx cap sync android
//
// AndroidManifest.xml 에 아래 권한 추가 필요:
//   <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
//   <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import {
  LocalNotifications,
  ScheduleEvery,
  LocalNotificationSchema,
} from '@capacitor/local-notifications';
import { Schedule } from '../types';

// ─── 상수 ───────────────────────────────────────────────────
// 알림 채널 ID (Android 8.0+ 필수)
const CHANNEL_ID = 'maeum-gido-prayers';
const CHANNEL_NAME = '기도 알림';

// Schedule.id → 알림 고유 정수 ID 변환
// Capacitor LocalNotifications는 숫자 ID를 요구함
function scheduleIdToNotifId(scheduleId: string): number {
  // 간단한 해시: 앞 8자리 hex를 10진수로 변환 후 양의 정수 범위로 제한
  let hash = 0;
  for (let i = 0; i < scheduleId.length; i++) {
    hash = (hash * 31 + scheduleId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2_147_483_647 || 1;
}

// 요일 배열(0=일~6=토) → Capacitor ScheduleEvery 문자열 변환
// 단일 요일은 'week' 단위로 반복, 매일이면 'day'
function toScheduleEvery(daysOfWeek: number[]): ScheduleEvery {
  if (daysOfWeek.length === 7) return 'day';
  // 단일 요일이거나 복수 요일의 경우 개별 알림으로 분리해 'week' 사용
  return 'week';
}

// 다음 알림 실행 시각 계산 (오늘 또는 가장 가까운 지정 요일)
function nextTriggerDate(dayOfWeek: number, hour: number, minute: number): Date {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);

  const todayDow = now.getDay(); // 0=일
  let daysUntil = (dayOfWeek - todayDow + 7) % 7;

  // 오늘이 같은 요일이지만 시각이 이미 지났으면 7일 후
  if (daysUntil === 0 && now >= target) daysUntil = 7;

  target.setDate(target.getDate() + daysUntil);
  return target;
}

// ─── 훅 ────────────────────────────────────────────────────
export interface UseNotificationsReturn {
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
  scheduleNotifications: (schedule: Schedule, title: string) => Promise<void>;
  cancelNotifications: (scheduleId: string, daysOfWeek: number[]) => Promise<void>;
  cancelAllNotifications: () => Promise<void>;
  rescheduleAll: (schedules: Schedule[], getTitleFn: (targetId: string) => string) => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const [hasPermission, setHasPermission] = useState(false);

  // ── 앱 시작 시 권한 상태 확인 + 채널 생성 ────────────────
  useEffect(() => {
    (async () => {
      try {
        // Android 알림 채널 생성 (중복 호출해도 안전)
        await LocalNotifications.createChannel({
          id: CHANNEL_ID,
          name: CHANNEL_NAME,
          description: '기도 시간을 알려주는 알림입니다.',
          importance: 4,       // IMPORTANCE_HIGH
          visibility: 1,       // VISIBILITY_PUBLIC
          vibration: true,
          sound: 'default',
        });

        const { display } = await LocalNotifications.checkPermissions();
        setHasPermission(display === 'granted');
      } catch (e) {
        console.warn('[useNotifications] init error:', e);
      }
    })();
  }, []);

  // ── 권한 요청 ───────────────────────────────────────────
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { display } = await LocalNotifications.requestPermissions();
      const granted = display === 'granted';
      setHasPermission(granted);
      return granted;
    } catch (e) {
      console.error('[useNotifications] requestPermission error:', e);
      return false;
    }
  }, []);

  // ── 알림 등록 ────────────────────────────────────────────
  // Schedule 1개 = 요일 N개 × 알림 N개 (각 요일별 별도 등록)
  const scheduleNotifications = useCallback(
    async (schedule: Schedule, title: string): Promise<void> => {
      if (!schedule.notificationEnabled || !schedule.isActive) return;

      const notifications: LocalNotificationSchema[] = schedule.daysOfWeek.map(
        (dow, index) => {
          // 동일 스케줄의 각 요일 알림은 고유 ID를 가져야 함
          const notifId = scheduleIdToNotifId(schedule.id) + index;
          const at = nextTriggerDate(dow, schedule.timeHour, schedule.timeMinute);

          return {
            id: notifId,
            channelId: CHANNEL_ID,
            title: '🙏 기도 시간입니다',
            body: title,
            schedule: {
              at,
              every: toScheduleEvery(schedule.daysOfWeek),
              allowWhileIdle: true,
            },
            smallIcon: 'ic_notification', // android/app/src/main/res/drawable/ic_notification.png 필요
            actionTypeId: 'OPEN_PRAYER',
            extra: {
              scheduleId: schedule.id,
              targetId: schedule.targetId,
              targetType: schedule.targetType,
            },
          };
        }
      );

      try {
        await LocalNotifications.schedule({ notifications });
        console.info(
          `[useNotifications] Scheduled ${notifications.length} notification(s) for "${title}"`
        );
      } catch (e) {
        console.error('[useNotifications] scheduleNotifications error:', e);
        throw e;
      }
    },
    []
  );

  // ── 알림 취소 ────────────────────────────────────────────
  const cancelNotifications = useCallback(
    async (scheduleId: string, daysOfWeek: number[]): Promise<void> => {
      const notifications = daysOfWeek.map((_, index) => ({
        id: scheduleIdToNotifId(scheduleId) + index,
      }));
      try {
        await LocalNotifications.cancel({ notifications });
      } catch (e) {
        console.error('[useNotifications] cancelNotifications error:', e);
      }
    },
    []
  );

  // ── 전체 알림 취소 ───────────────────────────────────────
  const cancelAllNotifications = useCallback(async (): Promise<void> => {
    try {
      const { notifications } = await LocalNotifications.getPending();
      if (notifications.length > 0) {
        await LocalNotifications.cancel({ notifications });
      }
    } catch (e) {
      console.error('[useNotifications] cancelAllNotifications error:', e);
    }
  }, []);

  // ── 전체 재등록 (앱 재시작 / 데이터 변경 시 호출) ────────
  // getTitleFn: targetId를 받아 알림 본문 문자열을 반환하는 함수
  const rescheduleAll = useCallback(
    async (
      schedules: Schedule[],
      getTitleFn: (targetId: string) => string
    ): Promise<void> => {
      await cancelAllNotifications();
      const activeSchedules = schedules.filter((s) => s.isActive && s.notificationEnabled);
      for (const s of activeSchedules) {
        const title = getTitleFn(s.targetId);
        await scheduleNotifications(s, title);
      }
      console.info(`[useNotifications] Rescheduled ${activeSchedules.length} schedule(s)`);
    },
    [cancelAllNotifications, scheduleNotifications]
  );

  return {
    hasPermission,
    requestPermission,
    scheduleNotifications,
    cancelNotifications,
    cancelAllNotifications,
    rescheduleAll,
  };
}
