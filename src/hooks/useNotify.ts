import { registerPlugin } from '@capacitor/core';
import { useCallback, useEffect, useRef } from 'react';
import type { TodayItem } from '../utils/storage';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// ── 네이티브 알람 플러그인 (AlarmManager 직접 제어) ──────────────────
interface NativeAlarmData {
  id: number;
  title: string;
  body: string;
  weekday: number; // 1=일, 2=월, ..., 7=토
  hour: number;
  minute: number;
}

interface NativeAlarmPlugin {
  schedule(options: { alarms: NativeAlarmData[] }): Promise<void>;
  cancel(): Promise<void>;
  getAlarmStatus(): Promise<{ canScheduleExactAlarms: boolean; isBatteryOptimized: boolean }>;
  openBatterySettings(): Promise<void>;
  openExactAlarmSettings(): Promise<void>;
}

const NativeAlarm = registerPlugin<NativeAlarmPlugin>('NativeAlarm');

// ── 유틸 ─────────────────────────────────────────────────────────────

function isNative(): boolean {
  try {
    const cap = (window as any).Capacitor;
    return !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  } catch {
    return false;
  }
}

function toNotifId(item: TodayItem, index: number): number {
  const key = item.instanceId || item.id;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 2_000_000) + index;
}

/** Capacitor weekday 규칙과 동일: 0(일)→1, 1(월)→2, ... */
function toWeekday(dow: number): number {
  return dow + 1;
}

// ── 권한 요청 ─────────────────────────────────────────────────────────

async function requestNativePermission(): Promise<boolean> {
  try {
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
  } catch (e) {
    console.warn('[useNotify] Permission request error:', e);
    return false;
  }
}

// ── 네이티브 스케줄링 ────────────────────────────────────────────────

async function scheduleNativeAll(
  todayList: TodayItem[],
  getTitle: (item: TodayItem) => string
): Promise<void> {
  const alarms: NativeAlarmData[] = [];

  for (const item of todayList) {
    if (!item.time) continue;
    const [hStr, mStr] = item.time.split(':');
    const hour   = Number(hStr);
    const minute = Number(mStr);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) continue;

    const body       = getTitle(item);
    const targetDays = item.days.length === 0 ? ALL_DAYS : item.days;

    targetDays.forEach((dow, index) => {
      alarms.push({
        id:      toNotifId(item, index),
        title:   '기도 시간입니다',
        body,
        weekday: toWeekday(dow),
        hour,
        minute,
      });
    });
  }

  // SharedPreferences 저장 + AlarmManager 등록
  await NativeAlarm.schedule({ alarms });
  console.info(`[useNotify] Scheduled ${alarms.length} native alarm(s)`);
}

// ── 웹 폴백 ──────────────────────────────────────────────────────────

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

// ── 훅 ───────────────────────────────────────────────────────────────

export function useNotify(
  todayList: TodayItem[],
  getTitle: (item: TodayItem) => string
) {
  const ready     = useRef(false);
  const webTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (isNative()) return requestNativePermission();
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

  // 최초 1회 초기화
  useEffect(() => {
    if (ready.current) return;
    ready.current = true;

    (async () => {
      if (isNative()) {
        try {
          await scheduleNativeAll(todayList, getTitle);
        } catch (e) {
          console.warn('[useNotify] Native init error:', e);
        }
      } else if ('Notification' in window && Notification.permission === 'granted') {
        webTimers.current = scheduleWebAll(todayList, getTitle);
      }
    })();

    return () => { webTimers.current.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // todayList 변경 시 재등록
  useEffect(() => {
    if (!ready.current) return;
    scheduleAll();
  }, [scheduleAll]);

  return { requestPermission, scheduleAll };
}

// ── 알람 상태 확인 + 설정 열기 (설정 페이지에서 직접 호출) ──────────

export async function checkAlarmStatus() {
  try {
    return await NativeAlarm.getAlarmStatus();
  } catch {
    return { canScheduleExactAlarms: true, isBatteryOptimized: false };
  }
}

export async function openBatterySettings() {
  try { await NativeAlarm.openBatterySettings(); } catch {}
}

export async function openExactAlarmSettings() {
  try { await NativeAlarm.openExactAlarmSettings(); } catch {}
}
