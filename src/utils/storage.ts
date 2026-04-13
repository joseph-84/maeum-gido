const KEYS = {
  PRAYERS:     'mgido_prayers',
  GROUPS:      'mgido_groups',
  SCHEDULES:   'mgido_schedules',
  COMPLETIONS: 'mgido_completions',
  TODAY_LIST:  'mgido_today_list',
} as const;

function get<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
function set<T>(key: string, value: T): void {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.error('[storage] set error:', e); }
}
function remove(key: string): void { localStorage.removeItem(key); }

export interface StoredPrayer {
  id: string; title: string; content: string; category: string;
  isFavorite: boolean; isDeleted: boolean; source: 'static'|'user';
  createdAt: string; updatedAt: string;
}
export function getPrayers(): StoredPrayer[] { return get<StoredPrayer[]>(KEYS.PRAYERS) ?? []; }
export function savePrayers(prayers: StoredPrayer[]): void { set(KEYS.PRAYERS, prayers); }

export interface StoredGroup {
  id: string; name: string; description: string; color: string;
  prayerIds: string[]; isDeleted: boolean; createdAt: string; updatedAt: string;
}
export function getGroups(): StoredGroup[] { return get<StoredGroup[]>(KEYS.GROUPS) ?? []; }
export function saveGroups(groups: StoredGroup[]): void { set(KEYS.GROUPS, groups); }

export interface CompletionRecord { date: string; prayerIds: string[]; }
export function getCompletions(): Record<string, string[]> { return get<Record<string, string[]>>(KEYS.COMPLETIONS) ?? {}; }
export function saveCompletions(log: Record<string, string[]>): void { set(KEYS.COMPLETIONS, log); }

export interface TodayItem {
  id: string; type: 'prayer'|'group'; time: string; days: number[];
}
export function getTodayList(): TodayItem[] { return get<TodayItem[]>(KEYS.TODAY_LIST) ?? []; }
export function saveTodayList(list: TodayItem[]): void { set(KEYS.TODAY_LIST, list); }

// JSON에서 \\n 리터럴을 실제 줄바꿈으로 변환
function normalizeContent(p: StoredPrayer): StoredPrayer {
  return { ...p, content: p.content.replace(/\\n/g, '\n') };
}

export function mergeStaticPrayers(staticList: StoredPrayer[]): StoredPrayer[] {
  const local = getPrayers();
  const localMap = new Map(local.map((p) => [p.id, p]));

  for (const rawSp of staticList) {
    const sp = normalizeContent(rawSp);
    const lp = localMap.get(sp.id);
    if (!lp) {
      localMap.set(sp.id, sp);
    } else {
      const staticTime = new Date(sp.updatedAt).getTime();
      const localTime  = new Date(lp.updatedAt).getTime();
      if (staticTime > localTime) {
        localMap.set(sp.id, { ...sp, source: lp.source });
      }
    }
  }

  const merged = Array.from(localMap.values());
  savePrayers(merged);
  return merged;
}

export { remove };