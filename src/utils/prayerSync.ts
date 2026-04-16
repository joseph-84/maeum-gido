// ============================================================
// utils/prayerSync.ts — 원격 기도문 버전 체크 및 동기화
// ============================================================
//
// 흐름:
//   앱 시작 → 로컬 버전 확인 → n8n 버전 조회
//   → 버전 다르면 데이터 다운로드 → 병합 → 로컬 저장
//
// 병합 규칙:
//   - source='user' 데이터는 절대 건드리지 않음
//   - source='static' 데이터는 서버 updatedAt이 더 최신이면 업데이트
//   - 서버에 없는 로컬 static 데이터는 유지 (삭제 없음)
//   - 서버에 새로 추가된 기도문은 추가
// ============================================================

import { StoredPrayer, getPrayers, savePrayers } from './storage';

// ── n8n Webhook URL 설정 ────────────────────────────────────
// 본인 n8n 서버 주소로 변경하세요
const N8N_BASE_URL = 'https://n8n.joseph84.freeddns.org/webhook';
const VERSION_URL  = `${N8N_BASE_URL}/prayers/version`;
const DATA_URL     = `${N8N_BASE_URL}/prayers/data`;

const LOCAL_VERSION_KEY = 'mgido_prayer_version';

// ── 타입 ────────────────────────────────────────────────────
export interface VersionInfo {
  version: string;       // "1.0.3"
  updatedAt: string;     // ISO 8601
}

export interface SyncResult {
  synced: boolean;
  version: string;
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
  error?: string;
}

// ── 로컬 버전 관리 ───────────────────────────────────────────
function getLocalVersion(): string {
  return localStorage.getItem(LOCAL_VERSION_KEY) ?? '0.0.0';
}

function saveLocalVersion(version: string): void {
  localStorage.setItem(LOCAL_VERSION_KEY, version);
}

// ── 버전 비교 (semver 간단 구현) ────────────────────────────
function isNewerVersion(remote: string, local: string): boolean {
  const parse = (v: string) => v.split('.').map(Number);
  const [rMaj, rMin, rPatch] = parse(remote);
  const [lMaj, lMin, lPatch] = parse(local);
  if (rMaj !== lMaj) return rMaj > lMaj;
  if (rMin !== lMin) return rMin > lMin;
  return rPatch > lPatch;
}

// ── 핵심 병합 로직 ───────────────────────────────────────────
function mergeRemotePrayers(
  localPrayers: StoredPrayer[],
  remotePrayers: StoredPrayer[]
): { merged: StoredPrayer[]; addedCount: number; updatedCount: number; skippedCount: number } {
  const localMap = new Map(localPrayers.map(p => [p.id, p]));
  let addedCount = 0, updatedCount = 0, skippedCount = 0;

  for (const remote of remotePrayers) {
    // \n 리터럴 → 실제 줄바꿈 변환
    const normalized = { ...remote, content: remote.content.replace(/\\n/g, '\n') };
    const local = localMap.get(normalized.id);

    if (!local) {
      // 신규 기도문 → 추가
      localMap.set(normalized.id, { ...normalized, source: 'static' });
      addedCount++;
    } else if (local.source === 'user') {
      // 사용자가 직접 추가한 기도문 → 절대 건드리지 않음
      skippedCount++;
    } else {
      // static 기도문 → updatedAt 비교
      const remoteTime = new Date(normalized.updatedAt).getTime();
      const localTime  = new Date(local.updatedAt).getTime();
      if (remoteTime > localTime) {
        // 서버가 더 최신 → 업데이트 (단, 사용자가 즐겨찾기 변경했으면 유지)
        localMap.set(normalized.id, {
          ...normalized,
          source: 'static',
          isFavorite: local.isFavorite, // 즐겨찾기는 로컬 값 유지
        });
        updatedCount++;
      } else {
        skippedCount++;
      }
    }
  }

  return {
    merged: Array.from(localMap.values()),
    addedCount,
    updatedCount,
    skippedCount,
  };
}

// ── 메인 동기화 함수 ─────────────────────────────────────────
export async function syncPrayersFromServer(
  options: { forceSync?: boolean; timeoutMs?: number } = {}
): Promise<SyncResult> {
  const { forceSync = false, timeoutMs = 8000 } = options;
  const localVersion = getLocalVersion();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 1. 버전 체크
    const versionRes = await fetch(VERSION_URL, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    if (!versionRes.ok) throw new Error(`버전 조회 실패: ${versionRes.status}`);
    const versionInfo: VersionInfo = await versionRes.json();

    // 2. 버전 비교 — 같으면 스킵
    if (!forceSync && !isNewerVersion(versionInfo.version, localVersion)) {
      clearTimeout(timer);
      return { synced: false, version: localVersion, addedCount: 0, updatedCount: 0, skippedCount: 0 };
    }

    // 3. 최신 데이터 다운로드
    const dataRes = await fetch(DATA_URL, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    if (!dataRes.ok) throw new Error(`데이터 다운로드 실패: ${dataRes.status}`);
    const remotePrayers: StoredPrayer[] = await dataRes.json();

    // 4. 로컬 데이터와 병합
    const localPrayers = getPrayers();
    const { merged, addedCount, updatedCount, skippedCount } = mergeRemotePrayers(localPrayers, remotePrayers);

    // 5. 저장 및 버전 갱신
    savePrayers(merged);
    saveLocalVersion(versionInfo.version);

    clearTimeout(timer);
    console.info(
      `[prayerSync] 동기화 완료 v${versionInfo.version}: +${addedCount} 추가, ~${updatedCount} 업데이트, ${skippedCount} 스킵`
    );

    return {
      synced: true,
      version: versionInfo.version,
      addedCount,
      updatedCount,
      skippedCount,
    };

  } catch (err: any) {
    clearTimeout(timer);
    const msg = err.name === 'AbortError' ? '서버 응답 시간 초과' : err.message;
    console.warn(`[prayerSync] 동기화 실패 (오프라인이거나 서버 오류): ${msg}`);
    return {
      synced: false,
      version: localVersion,
      addedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      error: msg,
    };
  }
}
