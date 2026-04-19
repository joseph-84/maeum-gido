// ============================================================
// hooks/useNotify.ts — Capacitor LocalNotifications 기반 알림
// ============================================================
import { useEffect, useCallback, useRef } from 'react';
import { TodayItem } from '../utils/storage';

// ── Capacitor 환경 감지 ──────────────────────────────────────
// window.Capacitor.isNativePlatform() 이 가장 확실한 방법
function isNative(): boolean {
  try {
    const cap = (window as any).Capacitor;
    return !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  } catch {
    return false;
  }
}

// ── 알림 시각 계산 ───────────────────────────────────────────
function nextTriggerDate(dow: number, hour: number, minute: number): Date {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  let daysUntil = (dow - now.getDay() + 7) % 7;
  if (daysUntil === 0 && now >= target) daysUntil = 7;
  target.setDate(target.getDate() + daysUntil);
  return target;
}

// 아이템 ID → 정수 알림 ID 변환
function toNotifId(itemId: string, index: number): number {
  let hash = 0;
  for (let i = 0; i < itemId.length; i++) {
    hash = (hash * 31 + itemId.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 2_000_000) + index;
}

// ── Capacitor 채널 초기화 ────────────────────────────────────
async function setupChannel(): Promise<void> {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.createChannel({
    id: 'prayer-alarm',
    name: '기도 알림',
    description: '기도 시간을 알려주는 알림',
    importance: 5,       // IMPORTANCE_HIGH
    vibration: true,
    sound: 'default',
    lights: true,
    lightColor: '#2D5016',
    visibility: 1,       // VISIBILITY_PUBLIC
  });
}

// ── Capacitor 권한 요청 ──────────────────────────────────────
async function requestNativePermission(): Promise<boolean> {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const { display } = await LocalNotifications.requestPermissions();
  return display === 'granted';
}

// ── Capacitor 알림 전체 재스케줄 ────────────────────────────
async function scheduleNativeAll(
  todayList: TodayItem[],
  getTitle: (item: TodayItem) => string
): Promise<void> {
  const { LocalNotifications } = await import('@capacitor/local-notifications');

  // 기존 알림 모두 취소
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
    const body = getTitle(item);

    const targetDays = item.days.length === 0
      ? [0, 1, 2, 3, 4, 5, 6]
      : item.days;

    targetDays.forEach((dow, i) => {
      notifications.push({
        id: toNotifId(item.id, i),
        title: '🙏 기도 시간입니다',
        body,
        channelId: 'prayer-alarm',
        schedule: {
          at: nextTriggerDate(dow, hour, minute),
          every: 'week',
          allowWhileIdle: true,
        },
        sound: 'default',
        extra: { itemId: item.id },
      });
    });
  }

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
    console.info(`[useNotify] ${notifications.length}개 알림 등록 완료`);
  }
}

// ── 웹 브라우저 알림 (개발/미리보기용) ──────────────────────
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
      new Notification('🙏 기도 시간입니다', { body, icon: '/favicon.ico' });
    }, msUntil));
  }
  return timers;
}

// ── 훅 본체 ─────────────────────────────────────────────────
export function useNotify(
  todayList: TodayItem[],
  getTitle: (item: TodayItem) => string
) {
  const ready = useRef(false);
  const webTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 권한 요청 (설정 화면에서 호출)
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (isNative()) {
      return requestNativePermission();
    }
    if (!('Notification' in window)) return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }, []);

  // 알림 전체 재스케줄
  const scheduleAll = useCallback(async () => {
    if (isNative()) {
      await scheduleNativeAll(todayList, getTitle);
    } else {
      webTimers.current.forEach(clearTimeout);
      webTimers.current = scheduleWebAll(todayList, getTitle);
    }
  }, [todayList, getTitle]);

  // 앱 최초 실행: 채널 생성 + 권한 요청 + 알림 등록
  useEffect(() => {
    if (ready.current) return;
    ready.current = true;

    (async () => {
      if (isNative()) {
        try {
          await setupChannel();
          const granted = await requestNativePermission();
          if (granted) await scheduleNativeAll(todayList, getTitle);
        } catch (e) {
          console.warn('[useNotify] Native init error:', e);
        }
      } else {
        // 브라우저: 이미 권한 있으면 바로 등록
        if ('Notification' in window && Notification.permission === 'granted') {
          webTimers.current = scheduleWebAll(todayList, getTitle);
        }
      }
    })();

    return () => { webTimers.current.forEach(clearTimeout); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // todayList 변경 시 재스케줄
  useEffect(() => {
    if (!ready.current) return;
    scheduleAll();
  }, [scheduleAll]);

  return { requestPermission, scheduleAll };
}