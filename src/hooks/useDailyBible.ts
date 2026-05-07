import { useState, useEffect } from 'react';

// ── 타입 ──────────────────────────────────────────────────────────────────
export interface BibleSection {
  title:   string; // "제1독서", "복음"
  book:    string; // "사도행전의 말씀입니다"
  content: string; // 본문
}

export interface DailyBibleData {
  date:      string;
  readings:  BibleSection[]; // 제1~9독서
  gospel:    BibleSection | null;
  fetchedAt: string;
}

// ── 상수 ──────────────────────────────────────────────────────────────────
const CACHE_KEY = 'mgido_daily_bible';
const BASE_URL  = 'https://maria.catholic.or.kr/mi_pr/missa/missa.asp?menu=missa&gomonth=';

// ── 유틸 ──────────────────────────────────────────────────────────────────
export function todayKSTString(): string {
  // KST(UTC+9) 기준 오늘 날짜
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildBibleUrl(date: string): string {
  return `${BASE_URL}${date}`;
}

// ── 캐시 ──────────────────────────────────────────────────────────────────
function getCache(date: string): DailyBibleData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: DailyBibleData = JSON.parse(raw);
    return cached.date === date ? cached : null;
  } catch { return null; }
}

function setCache(data: DailyBibleData): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
}

// ── HTML 파서 ─────────────────────────────────────────────────────────────
function stripTags(html: string): string {
  // <br> → 줄바꿈, 나머지 태그 제거
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
}

function cleanLines(text: string): string[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);
}

/*
 * 가톨릭 굿뉴스 미사 페이지 파싱
 * - DOMParser로 <td> 블록을 순회하며 섹션 헤더를 찾음
 * - 실패 시 텍스트 기반 파싱으로 폴백
 */
function parseHtml(html: string): { readings: BibleSection[]; gospel: BibleSection | null } {
  // 1차: DOM 파싱
  try {
    const result = parseDom(html);
    if (result.readings.length > 0 || result.gospel) return result;
  } catch {}

  // 2차: 텍스트 파싱 폴백
  return parseText(stripTags(html));
}

// ── DOM 기반 파싱 ─────────────────────────────────────────────────────────
function parseDom(html: string): { readings: BibleSection[]; gospel: BibleSection | null } {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const readings: BibleSection[] = [];
  let gospel: BibleSection | null = null;

  // 텍스트 노드에서 섹션 헤더 탐색
  const READING_RE = /^제\d+독서$/;
  const GOSPEL_RE  = /^복음$/;

  // 모든 <td>, <div>, <p> 탐색
  const blocks = Array.from(doc.querySelectorAll('td, div, p, font'));

  for (let i = 0; i < blocks.length; i++) {
    const text = (blocks[i].textContent || '').trim();

    if (READING_RE.test(text) || GOSPEL_RE.test(text)) {
      const title = text;
      // 이후 최대 5개 블록에서 book + content 수집
      const contentParts: string[] = [];
      let book = '';

      for (let j = i + 1; j < Math.min(i + 10, blocks.length); j++) {
        const t = (blocks[j].textContent || '').trim();
        if (!t) continue;
        // 다음 섹션 헤더가 나오면 중단
        if (READING_RE.test(t) || GOSPEL_RE.test(t) || /^화답송$|^복음 환호송$|^강론$|^본기도$/.test(t)) break;

        if (!book && (t.includes('말씀입니다') || t.includes('복음입니다') || t.includes('시편'))) {
          book = t;
        } else {
          contentParts.push(t);
        }
      }

      const section: BibleSection = {
        title,
        book,
        content: contentParts.join('\n').trim(),
      };

      if (GOSPEL_RE.test(title)) gospel = section;
      else readings.push(section);
    }
  }

  return { readings, gospel };
}

// ── 텍스트 기반 파싱 (폴백) ───────────────────────────────────────────────
function parseText(fullText: string): { readings: BibleSection[]; gospel: BibleSection | null } {
  const lines = cleanLines(fullText);

  const READING_RE = /^제\d+독서$/;
  const GOSPEL_RE  = /^복음$/;
  const SKIP_RE    = /^(화답송|복음 환호송|강론|본기도|예물기도|영성체송|신앙 고백|보편 지향|성찬 전례)$/;

  // 섹션 시작 인덱스 수집
  const markers: Array<{ idx: number; title: string; type: 'reading' | 'gospel' | 'skip' | 'end' }> = [];

  lines.forEach((line, idx) => {
    if (READING_RE.test(line))                  markers.push({ idx, title: line, type: 'reading' });
    else if (GOSPEL_RE.test(line))              markers.push({ idx, title: line, type: 'gospel'  });
    else if (SKIP_RE.test(line))                markers.push({ idx, title: line, type: 'skip'    });
    else if (/^본기도$|^예물기도$/.test(line))  markers.push({ idx, title: line, type: 'end'     });
  });

  const readings: BibleSection[] = [];
  let gospel: BibleSection | null = null;

  for (let mi = 0; mi < markers.length; mi++) {
    const m = markers[mi];
    if (m.type !== 'reading' && m.type !== 'gospel') continue;

    const endIdx = mi + 1 < markers.length ? markers[mi + 1].idx : lines.length;
    const block  = lines.slice(m.idx + 1, endIdx);

    // 첫 번째로 "말씀입니다" / "복음입니다"가 포함된 줄 = book
    let book = '';
    let contentStart = 0;
    for (let i = 0; i < Math.min(3, block.length); i++) {
      if (block[i].includes('말씀입니다') || block[i].includes('복음입니다') || block[i].includes('시편')) {
        book         = block[i];
        contentStart = i + 1;
        break;
      }
    }

    // "주님의 말씀입니다" / "주 예수님의 복음입니다" → 본문 끝 표시
    let contentEnd = block.length;
    for (let i = block.length - 1; i >= contentStart; i--) {
      if (block[i].includes('주님의 말씀') || block[i].includes('주 예수님의 복음')) {
        contentEnd = i; break;
      }
    }

    const section: BibleSection = {
      title:   m.title,
      book,
      content: block.slice(contentStart, contentEnd).join('\n').trim(),
    };

    if (m.type === 'gospel') gospel = section;
    else readings.push(section);
  }

  return { readings, gospel };
}

// ── Fetch ─────────────────────────────────────────────────────────────────
async function fetchDailyBible(date: string): Promise<DailyBibleData> {
  const url = buildBibleUrl(date);
  let html  = '';

  // CapacitorHttp: 네이티브에서 CORS 우회 + EUC-KR 자동 처리
  try {
    const { CapacitorHttp } = await import('@capacitor/core');
    const res = await CapacitorHttp.get({ url, headers: { Accept: 'text/html' } });
    html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  } catch {
    // 웹 폴백: EUC-KR 수동 디코딩
    const res    = await fetch(url);
    const buf    = await res.arrayBuffer();
    html = new TextDecoder('euc-kr').decode(buf);
  }

  const { readings, gospel } = parseHtml(html);

  const data: DailyBibleData = { date, readings, gospel, fetchedAt: new Date().toISOString() };
  setCache(data);
  return data;
}

// ── 훅 ───────────────────────────────────────────────────────────────────
export function useDailyBible() {
  const date = todayKSTString();

  const [data,    setData]    = useState<DailyBibleData | null>(() => getCache(date));
  const [loading, setLoading] = useState<boolean>(() => !getCache(date));
  const [error,   setError]   = useState<string | null>(null);

  const load = (d: string) => {
    setLoading(true); setError(null);
    fetchDailyBible(d)
      .then(r => { setData(r); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  };

  useEffect(() => {
    if (!getCache(date)) load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return {
    data, loading, error,
    retry: () => load(date),
    url:   buildBibleUrl(date),
    date,
  };
}
