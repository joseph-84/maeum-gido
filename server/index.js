/**
 * 마음의 기도 - 백업 서버
 *
 * POST /backup        데이터 업로드 → 비밀번호 반환 (7일 보관)
 * GET  /backup/:code  비밀번호로 데이터 다운로드
 *
 * 실행: npm install && npm start
 * 포트: 3456 (nginx 등으로 HTTPS 리버스 프록시 권장)
 */

const express = require('express');
const cors    = require('cors');
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');

const app      = express();
const PORT     = process.env.PORT || 3456;
const DATA_FILE = path.join(__dirname, 'backups.json');
const TTL_MS   = 7 * 24 * 60 * 60 * 1000; // 7일

// ── 저장소 (파일 기반, 재시작해도 유지) ──────────────────────────
let store = {}; // { [code]: { data, expiresAt } }

function loadStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch {
    store = {};
  }
}

function saveStore() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store), 'utf8');
}

function cleanExpired() {
  const now = Date.now();
  let changed = false;
  for (const code of Object.keys(store)) {
    if (store[code].expiresAt < now) {
      delete store[code];
      changed = true;
    }
  }
  if (changed) saveStore();
}

loadStore();
// 1시간마다 만료 항목 정리
setInterval(cleanExpired, 60 * 60 * 1000);

// ── 비밀번호 생성 (혼동 없는 8자 영숫자 대문자) ──────────────────
const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode() {
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes)
    .map(b => SAFE_CHARS[b % SAFE_CHARS.length])
    .join('');
}

// ── 미들웨어 ─────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ── POST /backup : 데이터 저장 ───────────────────────────────────
app.post('/backup', (req, res) => {
  const { prayers, groups, completions, todayList } = req.body ?? {};
  if (!prayers) {
    return res.status(400).json({ error: 'prayers 필드가 필요합니다.' });
  }

  cleanExpired();

  const code      = generateCode();
  const expiresAt = Date.now() + TTL_MS;
  store[code] = {
    data: { prayers, groups: groups ?? [], completions: completions ?? {}, todayList: todayList ?? [] },
    expiresAt,
  };
  saveStore();

  console.log(`[backup] 저장 code=${code} expires=${new Date(expiresAt).toLocaleString('ko-KR')}`);
  res.json({
    code,
    expiresAt: new Date(expiresAt).toISOString(),
    message: '7일간 보관됩니다.',
  });
});

// ── GET /backup/:code : 데이터 조회 ─────────────────────────────
app.get('/backup/:code', (req, res) => {
  cleanExpired();
  const entry = store[req.params.code.toUpperCase()];
  if (!entry || entry.expiresAt < Date.now()) {
    return res.status(404).json({ error: '비밀번호가 올바르지 않거나 만료되었습니다.' });
  }
  console.log(`[backup] 조회 code=${req.params.code}`);
  res.json(entry.data);
});

// ── 헬스체크 ─────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', backups: Object.keys(store).length }));

app.listen(PORT, () => {
  console.log(`마음의 기도 백업 서버 실행 중 → http://localhost:${PORT}`);
});
