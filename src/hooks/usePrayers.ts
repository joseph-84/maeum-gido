// ============================================================
// hooks/usePrayers.ts — 마음의 기도 핵심 커스텀 훅
// ============================================================
//
// 역할:
//   - 앱 구동 시 prayers.json + 로컬 저장소 데이터 로드 및 병합
//   - 기도문/그룹/완료기록 CRUD 상태 관리
//   - 검색/필터/즐겨찾기 유틸 제공
//
// 의존성:
//   - @capacitor/preferences  → 로컬 키-값 저장소
//   - ../utils/dataManager    → 병합 로직 순수 함수들
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Prayer,
  PrayerGroup,
  Schedule,
  CompletionRecord,
  MergeResult,
  UsePrayersReturn,
} from '../types';
import {
  loadPrayers,
  savePrayers,
  loadGroups,
  saveGroups,
  loadSchedules,
  saveSchedules,
  loadCompletions,
  saveCompletions,
  syncFromExternalJson,
  generateId,
  toDateString,
  nowISO,
} from '../utils/dataManager';

// prayers.json을 정적으로 import (Vite/CRA 모두 지원)
import staticPrayersJson from '../assets/prayers.json';

const staticPrayers = staticPrayersJson as Prayer[];

// ─── 훅 본체 ────────────────────────────────────────────────
export function usePrayers(): UsePrayersReturn {
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [groups, setGroups] = useState<PrayerGroup[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [completions, setCompletions] = useState<CompletionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── 초기 로드 ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const [mergedPrayers, savedGroups, savedSchedules, savedCompletions] =
          await Promise.all([
            loadPrayers(staticPrayers),
            loadGroups(),
            loadSchedules(),
            loadCompletions(),
          ]);
        setPrayers(mergedPrayers);
        setGroups(savedGroups);
        setSchedules(savedSchedules);
        setCompletions(savedCompletions);
      } catch (e) {
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
        console.error('[usePrayers] init error:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ── 기도문 헬퍼: 상태 업데이트 + 저장소 동기화 ────────────
  const updateAndSavePrayers = useCallback(
    async (updater: (prev: Prayer[]) => Prayer[]) => {
      setPrayers((prev) => {
        const next = updater(prev);
        savePrayers(next).catch(console.error);
        return next;
      });
    },
    []
  );

  // ── 기도문 CRUD ────────────────────────────────────────────
  const addPrayer = useCallback(
    async (
      input: Omit<Prayer, 'id' | 'source' | 'createdAt' | 'updatedAt'>
    ): Promise<Prayer> => {
      const newPrayer: Prayer = {
        ...input,
        id: generateId('u'),
        source: 'user',
        isDeleted: false,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      await updateAndSavePrayers((prev) => [...prev, newPrayer]);
      return newPrayer;
    },
    [updateAndSavePrayers]
  );

  const updatePrayer = useCallback(
    async (id: string, updates: Partial<Prayer>): Promise<void> => {
      await updateAndSavePrayers((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: nowISO() } : p
        )
      );
    },
    [updateAndSavePrayers]
  );

  /** 소프트 삭제: isDeleted 플래그만 true로 변경 */
  const deletePrayer = useCallback(
    async (id: string): Promise<void> => {
      await updatePrayer(id, { isDeleted: true });
    },
    [updatePrayer]
  );

  const toggleFavorite = useCallback(
    async (id: string): Promise<void> => {
      const prayer = prayers.find((p) => p.id === id);
      if (!prayer) return;
      await updatePrayer(id, { isFavorite: !prayer.isFavorite });
    },
    [prayers, updatePrayer]
  );

  // ── 그룹 헬퍼 ──────────────────────────────────────────────
  const updateAndSaveGroups = useCallback(
    async (updater: (prev: PrayerGroup[]) => PrayerGroup[]) => {
      setGroups((prev) => {
        const next = updater(prev);
        saveGroups(next).catch(console.error);
        return next;
      });
    },
    []
  );

  // ── 그룹 CRUD ──────────────────────────────────────────────
  const addGroup = useCallback(
    async (
      input: Omit<PrayerGroup, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<PrayerGroup> => {
      const newGroup: PrayerGroup = {
        ...input,
        id: generateId('g'),
        isDeleted: false,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      await updateAndSaveGroups((prev) => [...prev, newGroup]);
      return newGroup;
    },
    [updateAndSaveGroups]
  );

  const updateGroup = useCallback(
    async (id: string, updates: Partial<PrayerGroup>): Promise<void> => {
      await updateAndSaveGroups((prev) =>
        prev.map((g) =>
          g.id === id ? { ...g, ...updates, updatedAt: nowISO() } : g
        )
      );
    },
    [updateAndSaveGroups]
  );

  const deleteGroup = useCallback(
    async (id: string): Promise<void> => {
      await updateGroup(id, { isDeleted: true });
    },
    [updateGroup]
  );

  const reorderPrayersInGroup = useCallback(
    async (groupId: string, newPrayerIds: string[]): Promise<void> => {
      await updateGroup(groupId, { prayerIds: newPrayerIds });
    },
    [updateGroup]
  );

  // ── 완료 기록 ──────────────────────────────────────────────
  const markComplete = useCallback(
    async (prayerId: string): Promise<void> => {
      const record: CompletionRecord = {
        id: generateId('c'),
        prayerId,
        completedAt: nowISO(),
        date: toDateString(),
      };
      setCompletions((prev) => {
        const next = [...prev, record];
        saveCompletions(next).catch(console.error);
        return next;
      });
    },
    []
  );

  const getCompletionsForDate = useCallback(
    (date: string): CompletionRecord[] => {
      return completions.filter((c) => c.date === date);
    },
    [completions]
  );

  // ── 검색 / 필터 유틸 ───────────────────────────────────────
  /** isDeleted 항목은 항상 제외 */
  const activePrayers = prayers.filter((p) => !p.isDeleted);

  const getPrayersByCategory = useCallback(
    (category: string): Prayer[] => {
      return activePrayers.filter((p) => p.category === category);
    },
    [activePrayers]
  );

  const searchPrayers = useCallback(
    (keyword: string): Prayer[] => {
      if (!keyword.trim()) return activePrayers;
      const lower = keyword.toLowerCase();
      return activePrayers.filter(
        (p) =>
          p.title.toLowerCase().includes(lower) ||
          p.content.toLowerCase().includes(lower)
      );
    },
    [activePrayers]
  );

  // ── 외부 JSON 동기화 ───────────────────────────────────────
  const syncFromJson = useCallback(
    async (jsonData: Prayer[]): Promise<MergeResult> => {
      const result = await syncFromExternalJson(jsonData, prayers);
      setPrayers(result.merged);
      return result;
    },
    [prayers]
  );

  // ── 반환 ───────────────────────────────────────────────────
  return {
    prayers: activePrayers,
    groups: groups.filter((g) => !g.isDeleted),
    schedules,
    completions,
    isLoading,
    error,

    addPrayer,
    updatePrayer,
    deletePrayer,
    toggleFavorite,

    addGroup,
    updateGroup,
    deleteGroup,
    reorderPrayersInGroup,

    markComplete,
    getCompletionsForDate,

    getPrayersByCategory,
    searchPrayers,
    syncFromJson,
  };
}
