// ============================================================
// types/index.ts — 마음의 기도 앱 공통 타입 정의
// ============================================================

/** 기도문 단건 */
export interface Prayer {
  id: string;                   // 고유 ID (예: "p001", UUID 등)
  title: string;                // 기도문 제목
  content: string;              // 기도문 본문
  category: string;             // 카테고리 (예: "기본기도", "아침기도")
  isFavorite: boolean;          // 즐겨찾기 여부
  isDeleted: boolean;           // 소프트 삭제 플래그
  source: 'static' | 'user';   // 데이터 출처 (기본 JSON vs 사용자 추가)
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601 — 병합 시 최신 우선순위 기준
}

/** 기도 그룹 */
export interface PrayerGroup {
  id: string;
  name: string;                 // 예: "아침기도 루틴", "레지오 순서"
  description?: string;
  prayerIds: string[];          // 순서 반영 — 배열 인덱스 = 기도 순서
  color?: string;               // 그룹 대표 색상 (UI 표시용)
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 기도 스케줄 */
export interface Schedule {
  id: string;
  targetId: string;             // Prayer.id 또는 PrayerGroup.id
  targetType: 'prayer' | 'group';
  daysOfWeek: number[];         // 0=일, 1=월 ... 6=토
  timeHour: number;             // 0–23
  timeMinute: number;           // 0–59
  notificationEnabled: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 당일 기도 완료 기록 */
export interface CompletionRecord {
  id: string;
  prayerId: string;
  completedAt: string;          // ISO 8601 (날짜+시각 모두 보존)
  date: string;                 // "YYYY-MM-DD" — 달력 집계용
}

/** 병합 결과 상태 */
export interface MergeResult {
  merged: Prayer[];
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
}

/** usePrayers 훅 반환 타입 */
export interface UsePrayersReturn {
  // 상태
  prayers: Prayer[];
  groups: PrayerGroup[];
  schedules: Schedule[];
  completions: CompletionRecord[];
  isLoading: boolean;
  error: string | null;

  // 기도문 CRUD
  addPrayer: (prayer: Omit<Prayer, 'id' | 'source' | 'createdAt' | 'updatedAt'>) => Promise<Prayer>;
  updatePrayer: (id: string, updates: Partial<Prayer>) => Promise<void>;
  deletePrayer: (id: string) => Promise<void>;       // 소프트 삭제
  toggleFavorite: (id: string) => Promise<void>;

  // 그룹 CRUD
  addGroup: (group: Omit<PrayerGroup, 'id' | 'createdAt' | 'updatedAt'>) => Promise<PrayerGroup>;
  updateGroup: (id: string, updates: Partial<PrayerGroup>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  reorderPrayersInGroup: (groupId: string, newPrayerIds: string[]) => Promise<void>;

  // 완료 기록
  markComplete: (prayerId: string) => Promise<void>;
  getCompletionsForDate: (date: string) => CompletionRecord[];

  // 유틸
  getPrayersByCategory: (category: string) => Prayer[];
  searchPrayers: (keyword: string) => Prayer[];
  syncFromJson: (jsonData: Prayer[]) => Promise<MergeResult>;
}
