import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import {
  StoredPrayer, StoredGroup, TodayItem,
  getPrayers, savePrayers, getGroups, saveGroups,
  getCompletions, saveCompletions, getTodayList, saveTodayList,
  mergeStaticPrayers,
} from '../utils/storage';
import staticJson from '../assets/prayers.json';
import { syncPrayersFromServer } from '../utils/prayerSync';

const staticPrayers = staticJson as StoredPrayer[];

export function nowISO() { return new Date().toISOString(); }
export function genId(prefix = 'u') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export interface AppData {
  prayers:    StoredPrayer[];
  groups:     StoredGroup[];
  todayList:  TodayItem[];
  completions: Record<string, string[]>;
  isLoading:  boolean;

  addPrayer:    (p: Omit<StoredPrayer, 'id'|'source'|'createdAt'|'updatedAt'>) => void;
  updatePrayer: (id: string, patch: Partial<StoredPrayer>) => void;
  deletePrayer: (id: string) => void;
  toggleFavorite: (id: string) => void;

  addGroup:    (g: Omit<StoredGroup, 'id'|'createdAt'|'updatedAt'>) => void;
  updateGroup: (id: string, patch: Partial<StoredGroup>) => void;
  deleteGroup: (id: string) => void;

  setTodayList: (list: TodayItem[]) => void;

  toggleCompletion: (date: string, prayerId: string) => void;
  getCompletionsForDate: (date: string) => string[];
}

export const AppContext = createContext<AppData | null>(null);

export function useAppContext(): AppData {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext가 없습니다.');
  return ctx;
}

// 디폴트 오늘 목록 (그룹 포함)
const DEFAULT_TODAY: TodayItem[] = [
  { id: 'p013', type: 'prayer', time: '06:00', days: [] },
  { id: 'p013', type: 'prayer', time: '12:00', days: [] },
  { id: 'p013', type: 'prayer', time: '18:00', days: [] },
  { id: 'g001', type: 'group', time: '07:00', days: [] }
];

// 디폴트 그룹
const DEFAULT_GROUPS: StoredGroup[] = [
  {
    id: 'g001', name: '아침기도', description: '매일 아침 바치는 기도 순서',
    color: '#E8963A', prayerIds: ['p020','p054'],
    isDeleted: false, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z',
  }
];

export function useAppData(): AppData {
  const [prayers,     setPrayers]     = useState<StoredPrayer[]>([]);
  const [groups,      setGroups]      = useState<StoredGroup[]>([]);
  const [todayList,   setTodayListSt] = useState<TodayItem[]>([]);
  const [completions, setCompletions] = useState<Record<string, string[]>>({});
  const [isLoading,   setIsLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      // 1. 로컬 데이터 먼저 로드
      const merged = mergeStaticPrayers(staticPrayers);
      setPrayers(merged.filter(p => !p.isDeleted));

      const savedGroups = getGroups();
      if (savedGroups.length === 0) {
        saveGroups(DEFAULT_GROUPS);
        setGroups(DEFAULT_GROUPS);
      } else {
        setGroups(savedGroups.filter(g => !g.isDeleted));
      }

      const savedToday = getTodayList();
      if (savedToday.length === 0) {
        saveTodayList(DEFAULT_TODAY);
        setTodayListSt(DEFAULT_TODAY);
      } else {
        setTodayListSt(savedToday);
      }

      setCompletions(getCompletions());
      setIsLoading(false);

      // 2. 백그라운드에서 서버 동기화 (실패해도 앱 동작에 영향 없음)
      try {
        const result = await syncPrayersFromServer();
        if (result.synced) {
          const updated = getPrayers().filter(p => !p.isDeleted);
          setPrayers(updated);
          console.info(`[useAppData] 기도문 업데이트: v${result.version} (+${result.addedCount} 추가, ~${result.updatedCount} 수정)`);
        }
      } catch {
        // 네트워크 없어도 조용히 무시
      }
    })();
  }, []);

  const addPrayer = useCallback((input: Omit<StoredPrayer,'id'|'source'|'createdAt'|'updatedAt'>) => {
    const np: StoredPrayer = { ...input, id: genId('u'), source: 'user', createdAt: nowISO(), updatedAt: nowISO() };
    setPrayers(prev => {
      const next = [...prev, np];
      const all  = getPrayers();
      savePrayers([...all.filter(p => p.isDeleted), ...next]);
      return next;
    });
  }, []);

  const updatePrayer = useCallback((id: string, patch: Partial<StoredPrayer>) => {
    setPrayers(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...patch, updatedAt: nowISO() } : p);
      const all  = getPrayers();
      savePrayers([...all.filter(p => p.isDeleted), ...next]);
      return next;
    });
  }, []);

  const deletePrayer = useCallback((id: string) => {
    setPrayers(prev => {
      const next = prev.filter(p => p.id !== id);
      const all  = getPrayers();
      savePrayers(all.map(p => p.id === id ? { ...p, isDeleted: true, updatedAt: nowISO() } : p));
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setPrayers(prev => {
      const target = prev.find(p => p.id === id);
      if (!target) return prev;
      const next = prev.map(p => p.id === id ? { ...p, isFavorite: !p.isFavorite, updatedAt: nowISO() } : p);
      const all  = getPrayers();
      savePrayers([...all.filter(p => p.isDeleted), ...next]);
      return next;
    });
  }, []);

  const addGroup = useCallback((input: Omit<StoredGroup,'id'|'createdAt'|'updatedAt'>) => {
    const ng: StoredGroup = { ...input, id: genId('g'), createdAt: nowISO(), updatedAt: nowISO() };
    setGroups(prev => { const next = [...prev, ng]; saveGroups(next); return next; });
  }, []);

  const updateGroup = useCallback((id: string, patch: Partial<StoredGroup>) => {
    setGroups(prev => { const next = prev.map(g => g.id === id ? { ...g, ...patch, updatedAt: nowISO() } : g); saveGroups(next); return next; });
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setGroups(prev => { const next = prev.filter(g => g.id !== id); saveGroups(next); return next; });
  }, []);

  const setTodayList = useCallback((list: TodayItem[]) => {
    setTodayListSt(list); saveTodayList(list);
  }, []);

  const toggleCompletion = useCallback((date: string, prayerId: string) => {
    setCompletions(prev => {
      const cur  = prev[date] ?? [];
      const next = cur.includes(prayerId) ? cur.filter(x => x !== prayerId) : [...cur, prayerId];
      const updated = { ...prev, [date]: next };
      saveCompletions(updated);
      return updated;
    });
  }, []);

  const getCompletionsForDate = useCallback((date: string) => completions[date] ?? [], [completions]);

  return {
    prayers, groups, todayList, completions, isLoading,
    addPrayer, updatePrayer, deletePrayer, toggleFavorite,
    addGroup, updateGroup, deleteGroup,
    setTodayList,
    toggleCompletion, getCompletionsForDate,
  };
}