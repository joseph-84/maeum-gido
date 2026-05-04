import { useCallback, useEffect, useRef } from 'react';
import type { TodayItem } from '../utils/storage';

const CHANNEL_ID = 'prayer-alarm';
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function isNative(): boolean {
  try {
    const cap = (window as any).Capacitor;
    return !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  } catch {
    return false;
  }
}

function nextTriggerDate(dow: number, hour: number, minute: number): Date {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  let daysUntil = (dow - now.getDay() + 7) % 7;
  if (daysUntil === 0 && now >= target) daysUntil = 7;
  target.setDate(target.getDate() + daysUntil);
  return target;
}

function toNotifId(item: TodayItem, index: number): number {
  const key = item.instanceId || item.id;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 2_000_000) + index;
}

function toCapacitorWeekday(dow: number): number {
  return dow + 1;
}

async function setupChannel(): Promise<void> {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: '기도 알림',
    description: '기도 시간을 알려주는 알림',
    importance: 5,
    vibration: true,
    sound: 'default',
    lights: true,
    lightColor: '#2D5016',
    visibility: 1,
  });
}

async function checkExactAlarmPermission(): Promise<boolean> {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  try {
    const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting();
    return exact_alarm === 'granted';
  } catch {
    return true;
  }
}

async function requestNativePermission(): Promise<boolean> {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const { display } = await LocalNotifications.requestPermissions();
  if (display !== 'granted') return false;

  try {
    const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting();
    if (exact_alarm !== 'granted') {
      const result = await LocalNotifications.changeExactNotificationSetting();
      return result.exact_alarm === 'granted';
    }
  } catch (e) {
    console.warn('[useNotify] Exact alarm permission check error:', e);
  }

  return true;
}

async function scheduleNativeAll(
  todayList: TodayItem[],
  getTitle: (item: TodayItem) => string
): Promise<void> {
  const { LocalNotifications } = await import('@capacitor/local-notifications');

  const exactAlarmGranted = await checkExactAlarmPermission();
  if (!exactAlarmGranted) {
    console.warn('[useNotify] Exact alarm permission is not granted. Android may delay notifications.');
  }

  const { notifications: pending } = await LocalNotifications.getPending();
  if (pending.length > 0) {
    await LocalNotifications.cancel({ notifications: pending });
  }

  const notifications: any[] = [];

  for (const item of todayList) {
    if (!item.time) continue;
    const [hStr, mStr] = item.time.split(':');
    const hour = Number(hStr);
    const minute = Number(mStr);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) continue;

    const body = getTitle(item);
    const targetDays = item.days.length === 0 ? ALL_DAYS : item.days;

    targetDays.forEach((dow, index) => {
      notifications.push({
        id: toNotifId(item, index),
        title: '기도 시간입니다',
        body,
        channelId: CHANNEL_ID,
        schedule: {
          on: {
            weekday: toCapacitorWeekday(dow),
            hour,
            minute,
          },
          allowWhileIdle: true,
        },
        sound: 'default',
        extra: {
          itemId: item.id,
          instanceId: item.instanceId,
          type: item.type,
        },
      });
    });
  }

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
    console.info(`[useNotify] Scheduled ${notifications.length} notification(s)`);
  }
}

function scheduleWebAll(
  todayList: TodayItem[],
  getTitle: (item: TodayItem) => string
): ReturnType<typeof setTimeout>[] {
  const timers: ReturnType<typeof setTimeout>[] = [];
  if (!('Notification' in window) || Notification.permission !== 'granted') return timers;

  const now = new Date();
  for (const item of todayList) {
    if (!item.time) continue;
    const [hStr, mStr] = item.time.split(':');
    const target = new Date();
    target.setHours(Number(hStr), Number(mStr), 0, 0);
    const msUntil = target.getTime() - now.getTime();
    if (msUntil <= 0) continue;

    const body = getTitle(item);
    timers.push(setTimeout(() => {
      new Notification('기도 시간입니다', { body, icon: '/favicon.ico' });
    }, msUntil));
  }
  return timers;
}

export function useNotify(
  todayList: TodayItem[],
  getTitle: (item: TodayItem) => string
) {
  const ready = useRef(false);
  const webTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (isNative()) {
      return requestNativePermission();
    }
    if (!('Notification' in window)) return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }, []);

  const scheduleAll = useCallback(async () => {
    if (isNative()) {
      await scheduleNativeAll(todayList, getTitle);
    } else {
      webTimers.current.forEach(clearTimeout);
      webTimers.current = scheduleWebAll(todayList, getTitle);
    }
  }, [todayList, getTitle]);

  useEffect(() => {
    if (ready.current) return;
    ready.current = true;

    (async () => {
      if (isNative()) {
        try {
          await setupChannel();
          await scheduleNativeAll(todayList, getTitle);
        } catch (e) {
          console.warn('[useNotify] Native init error:', e);
        }
      } else if ('Notification' in window && Notification.permission === 'granted') {
        webTimers.current = scheduleWebAll(todayList, getTitle);
      }
    })();

    return () => {
      webTimers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready.current) return;
    scheduleAll();
  }, [scheduleAll]);

  return { requestPermission, scheduleAll };
}
