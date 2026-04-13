// ============================================================
// utils/dataManager.ts — 정적 JSON + 로컬 DB 병합 매니저
// ============================================================
//
// 병합 전략 (우선순위 흐름):
//   1. static assets (prayers.json) — 앱 기본 데이터
//   2. local storage (Capacitor Preferences) — 사용자 추가/수정
//   3. 충돌 시 updatedAt 기준 최신 데이터 채택
//   4. isDeleted: true 항목은 UI 노출에서 제외 (데이터는 보존)
// ============================================================

import { Preferences } from '@capacitor/preferences';
import { Prayer, PrayerGroup, Schedule, CompletionRecord, MergeResult } from '../types';

// ─── Storage Keys ──────────────────────────────────────────
const STORAGE_KEYS = {
  PRAYERS: 'maeum_prayers',
  GROUPS: 'maeum_groups',
  SCHEDULES: 'maeum_schedules',
  COMPLETIONS: 'maeum_completions',
} as const;

// ─── 저장소 헬퍼 ────────────────────────────────────────────
async function storageGet<T>(key: string): Promise<T | null> {
  const { value } = await Preferences.get({ key });
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    console.warn(`[dataManager] JSON parse failed for key: ${key}`);
    return null;
  }
}

async function storageSet<T>(key: string, data: T): Promise<void> {
  await Preferences.set({ key, value: JSON.stringify(data) });
}

// ─── ID 생성 ────────────────────────────────────────────────
export function generateId(prefix = 'u'): string {
  // 사용자 생성 데이터는 'u' 접두어로 구분
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── 핵심: 기도문 병합 로직 ─────────────────────────────────
/**
 * staticPrayers (JSON 파일) + localPrayers (저장소)를 병합.
 *
 * 규칙:
 * - ID가 양쪽에 모두 있으면 → updatedAt이 더 최신인 쪽을 채택
 * - local에만 있으면 → 사용자 추가 항목이므로 그대로 유지
 * - static에만 있으면 → 신규 기본 기도문이므로 추가
 * - isDeleted: true 항목은 병합 결과에 포함하되, 반환 시 필터링
 */
export function mergePrayers(
  staticPrayers: Prayer[],
  localPrayers: Prayer[]
): MergeResult {
  const localMap = new Map<string, Prayer>(localPrayers.map((p) => [p.id, p]));
  const merged: Prayer[] = [];
  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  // static 기도문 순회
  for (const staticPrayer of staticPrayers) {
    const localPrayer = localMap.get(staticPrayer.id);

    if (!localPrayer) {
      // local에 없음 → 신규 static 항목 추가
      merged.push({ ...staticPrayer });
      addedCount++;
    } else {
      // 양쪽에 존재 → updatedAt 비교
      const staticTime = new Date(staticPrayer.updatedAt).getTime();
      const localTime = new Date(localPrayer.updatedAt).getTime();

      if (localTime >= staticTime) {
        // 로컬이 더 최신 (혹은 동일) → 로컬 우선
        merged.push({ ...localPrayer });
        skippedCount++;
      } else {
        // static이 더 최신 (원격 업데이트) → static 채택, source는 유지
        merged.push({ ...staticPrayer, source: localPrayer.source });
        updatedCount++;
      }
      // 처리된 항목을 localMap에서 제거
      localMap.delete(staticPrayer.id);
    }
  }

  // local에만 남은 항목 (사용자 추가 기도문)
  for (const localOnly of localMap.values()) {
    merged.push({ ...localOnly });
  }

  return { merged, addedCount, updatedCount, skippedCount };
}

// ─── 기도문 로드 ────────────────────────────────────────────
export async function loadPrayers(staticPrayers: Prayer[]): Promise<Prayer[]> {
  const localPrayers = (await storageGet<Prayer[]>(STORAGE_KEYS.PRAYERS)) ?? [];
  const { merged } = mergePrayers(staticPrayers, localPrayers);
  return merged;
}

export async function savePrayers(prayers: Prayer[]): Promise<void> {
  await storageSet(STORAGE_KEYS.PRAYERS, prayers);
}

// ─── 그룹 로드/저장 ─────────────────────────────────────────
export async function loadGroups(): Promise<PrayerGroup[]> {
  return (await storageGet<PrayerGroup[]>(STORAGE_KEYS.GROUPS)) ?? [];
}

export async function saveGroups(groups: PrayerGroup[]): Promise<void> {
  await storageSet(STORAGE_KEYS.GROUPS, groups);
}

// ─── 스케줄 로드/저장 ───────────────────────────────────────
export async function loadSchedules(): Promise<Schedule[]> {
  return (await storageGet<Schedule[]>(STORAGE_KEYS.SCHEDULES)) ?? [];
}

export async function saveSchedules(schedules: Schedule[]): Promise<void> {
  await storageSet(STORAGE_KEYS.SCHEDULES, schedules);
}

// ─── 완료 기록 로드/저장 ────────────────────────────────────
export async function loadCompletions(): Promise<CompletionRecord[]> {
  return (await storageGet<CompletionRecord[]>(STORAGE_KEYS.COMPLETIONS)) ?? [];
}

export async function saveCompletions(completions: CompletionRecord[]): Promise<void> {
  await storageSet(STORAGE_KEYS.COMPLETIONS, completions);
}

// ─── 외부 JSON 동기화 (설정 화면에서 호출) ──────────────────
/**
 * 사용자가 설정 > 데이터 업데이트에서 새로운 JSON을 가져올 때 실행.
 * 현재 저장된 로컬 데이터와 신규 JSON을 병합하고 저장소를 갱신한다.
 */
export async function syncFromExternalJson(
  newStaticPrayers: Prayer[],
  currentLocalPrayers: Prayer[]
): Promise<MergeResult> {
  const result = mergePrayers(newStaticPrayers, currentLocalPrayers);
  await savePrayers(result.merged);
  return result;
}

// ─── 날짜 유틸 ──────────────────────────────────────────────
export function toDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]; // "YYYY-MM-DD"
}

export function nowISO(): string {
  return new Date().toISOString();
}
