// ============================================================
// hooks/useNotify.ts — 브라우저/웹뷰 Notification API 기반 알림
// ============================================================
// 브라우저에서는 Notification API, Android 앱 빌드 후에는
// Capacitor LocalNotifications로 교체 예정.
// ============================================================
import { useEffect, useCallback, useRef } from 'react';
import { TodayItem } from '../utils/storage';

export function useNotify(todayList: TodayItem[], getTitle: (item: TodayItem) => string) {
  const permRef    = useRef<NotificationPermission>('default');
  const timerRef   = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 권한 요청
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;
    const result = await Notification.requestPermission();
    permRef.current = result;
    return result === 'granted';
  }, []);

  // 기존 타이머 전부 제거
  const clearTimers = useCallback(() => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
  }, []);

  // 알림 스케줄링 (오늘 남은 시간 기준)
  const scheduleAll = useCallback(() => {
    clearTimers();
    if (permRef.current !== 'granted') return;

    const now  = new Date();
    const dow  = now.getDay();

    todayList.forEach((item) => {
      // 요일 필터
      if (item.days.length > 0 && !item.days.includes(dow)) return;

      const [hStr, mStr] = item.time.split(':');
      const target = new Date();
      target.setHours(Number(hStr), Number(mStr), 0, 0);

      const msUntil = target.getTime() - now.getTime();
      if (msUntil <= 0) return; // 이미 지난 시간

      const title = getTitle(item);
      const id = setTimeout(() => {
        new Notification('🙏 기도 시간입니다', {
          body: title,
          icon: '/favicon.ico',
          tag:  item.id,
        });
      }, msUntil);

      timerRef.current.push(id);
    });
  }, [todayList, getTitle, clearTimers]);

  // todayList 변경 시 재스케줄
  useEffect(() => {
    if ('Notification' in window) {
      permRef.current = Notification.permission;
    }
    scheduleAll();
    return clearTimers;
  }, [scheduleAll, clearTimers]);

  return { requestPermission, scheduleAll };
}
