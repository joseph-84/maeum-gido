import React, { useState, useRef, useCallback } from 'react';
import { useAppContext } from '../../hooks/useAppData';
import { savePrayers, saveGroups, saveCompletions, saveTodayList } from '../../utils/storage';
import './SettingsPage.css';

// ── 서버 주소 ──────────────────────────────────────────────────────
const BACKUP_SERVER = 'https://n8n.joseph84.freeddns.org';

// ── 유틸 ─────────────────────────────────────────────────────────
function isNativePlatform() {
  try {
    const cap = (window as any).Capacitor;
    return !!(cap && cap.isNativePlatform?.());
  } catch { return false; }
}

// 네이티브 공유 시트 (카카오, 문자, 메일 등)
async function shareText(title: string, text: string) {
  if (isNativePlatform()) {
    // Capacitor Share 플러그인 사용 → 앱 공유 시트 표시
    const { Share } = await import('@capacitor/share');
    await Share.share({ title, text, dialogTitle: '공유하기' });
  } else if (navigator.share) {
    await navigator.share({ title, text });
  } else {
    await navigator.clipboard.writeText(text);
  }
}

// 파일 공유 (로컬 내보내기)
async function shareFile(json: string, filename: string) {
  if (isNativePlatform()) {
    // Capacitor Filesystem에 임시 저장 후 Share
    const { Share } = await import('@capacitor/share');
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: '마음의 기도 백업', files: [uri], dialogTitle: '파일 공유' });
    return true;
  }
  // 웹: 기존 Web Share API
  const blob = new Blob([json], { type: 'application/json' });
  const file = new File([blob], filename, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: '마음의 기도 백업' });
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────
const SettingsPage: React.FC = () => {
  const { prayers, groups, completions, todayList, setTodayList } = useAppContext();

  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifSound,   setNotifSound]   = useState(true);
  const [notifVibrate, setNotifVibrate] = useState(true);
  const [toast, setToast] = useState('');

  // 서버 내보내기 모달
  const [exportModal, setExportModal]   = useState(false);
  const [exportCode,  setExportCode]    = useState('');
  const [exportExpiry,setExportExpiry]  = useState('');
  const [exportLoading,setExportLoading]= useState(false);

  // 서버 가져오기 모달
  const [importModal, setImportModal]   = useState(false);
  const [importCode,  setImportCode]    = useState('');
  const [importLoading,setImportLoading]= useState(false);

  const importInputRef  = useRef<HTMLInputElement>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // ── 로컬 내보내기 (공유 시트) ───────────────────────────────────
  const handleExport = async () => {
    const data = {
      exportedAt: new Date().toISOString(),
      prayers, groups, completions, todayList,
    };
    const json     = JSON.stringify(data, null, 2);
    const filename = `maeum-gido-backup-${new Date().toISOString().slice(0, 10)}.json`;

    try {
      const shared = await shareFile(json, filename);
      if (!shared) {
        // 파일 공유 미지원 → 일반 다운로드 fallback
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('백업 파일이 다운로드되었습니다.');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') showToast('내보내기 중 오류가 발생했습니다.');
    }
  };

  // ── 로컬 가져오기 (파일 선택) ───────────────────────────────────
  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (Array.isArray(data)) {
          savePrayers(data);
          showToast(`기도문 ${data.length}개를 가져왔습니다. 잠시 후 새로고침됩니다.`);
          setTimeout(() => window.location.reload(), 1500);
        } else if (data.prayers) {
          savePrayers(data.prayers);
          if (data.groups)      saveGroups(data.groups);
          if (data.completions) saveCompletions(data.completions);
          if (data.todayList)   { saveTodayList(data.todayList); setTodayList(data.todayList); }
          showToast('백업을 복원했습니다. 잠시 후 새로고침됩니다.');
          setTimeout(() => window.location.reload(), 1500);
        } else {
          showToast('지원하지 않는 파일 형식입니다.');
        }
      } catch {
        showToast('파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
  }, []);

  // ── 서버로 내보내기 ─────────────────────────────────────────────
  const handleServerExport = async () => {
    setExportLoading(true);
    try {
      const res = await fetch(`${BACKUP_SERVER}/webhook/mgido-export`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prayers, groups, completions, todayList }),
      });
      if (!res.ok) throw new Error(`서버 오류 ${res.status}`);
      const { code, expiresAt } = await res.json();
      setExportCode(code);
      setExportExpiry(new Date(expiresAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }));
      setExportModal(true);
    } catch (e: any) {
      showToast('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setExportLoading(false);
    }
  };

  // 비밀번호 공유 (카카오, 문자 등)
  const handleShareCode = async () => {
    try {
      await shareText(
        '마음의 기도 백업 비밀번호',
        `마음의 기도 백업 비밀번호: ${exportCode}\n유효기간: ${exportExpiry}까지\n\n앱 설정 → 서버에서 가져오기에서 입력하세요.`,
      );
    } catch (e: any) {
      if (e?.name !== 'AbortError') showToast('공유 중 오류가 발생했습니다.');
    }
  };

  // ── 서버에서 가져오기 ────────────────────────────────────────────
  const handleServerImport = async () => {
    const code = importCode.trim().toUpperCase();
    if (code.length < 6) {
      showToast('비밀번호를 입력해주세요.');
      return;
    }
    setImportLoading(true);
    try {
      const res = await fetch(`${BACKUP_SERVER}/webhook/mgido-import?code=${code}`);
      if (res.status === 404) throw new Error('not_found');
      if (!res.ok)            throw new Error(`server_${res.status}`);
      const raw  = await res.json();
      // n8n 응답 구조 정규화
      // 실제 응답: { "0": { "data": "{JSON문자열}" } }
      let parsed: any = raw;
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      // { "0": { data } } 또는 { "0": { "data": "string" } } 형태
      if (!parsed.prayers && !parsed.groups) {
        const firstItem = parsed[0] ?? parsed['0'];
        if (firstItem != null) {
          const inner = firstItem.data ?? firstItem;
          parsed = typeof inner === 'string' ? JSON.parse(inner) : inner;
        } else if (parsed.data != null) {
          parsed = typeof parsed.data === 'string' ? JSON.parse(parsed.data) : parsed.data;
        }
      }
      const data = parsed;
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('empty_data');
      if (data.prayers)      savePrayers(data.prayers);
      if (data.groups)       saveGroups(data.groups);
      if (data.completions)  saveCompletions(data.completions);
      if (data.todayList)    { saveTodayList(data.todayList); setTodayList(data.todayList); }
      setImportModal(false);
      setImportCode('');
      showToast('서버에서 데이터를 복원했습니다. 잠시 후 새로고침됩니다.');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      if (e?.message === 'not_found') {
        showToast('비밀번호가 올바르지 않거나 만료되었습니다.');
      } else if (e?.message === 'empty_data') {
        showToast('서버에서 데이터를 받았지만 내용이 비어 있습니다.');
      } else {
        showToast('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setImportLoading(false);
    }
  };

  // ── 알림 권한 ───────────────────────────────────────────────────
  const handleNotifPermission = async () => {
    if (isNativePlatform()) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const { display } = await LocalNotifications.requestPermissions();
        if (display !== 'granted') {
          showToast('알림 권한이 거부되었습니다. 설정 → 앱 → 마음의 기도 → 알림에서 허용해주세요.');
          return;
        }
        const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting();
        if (exact_alarm !== 'granted') {
          const result = await LocalNotifications.changeExactNotificationSetting();
          showToast(result.exact_alarm === 'granted'
            ? '알림 권한이 허용되었습니다.'
            : '알람 및 리마인더 권한이 꺼져 있어 알림이 늦거나 누락될 수 있습니다.');
        } else {
          showToast('알림 권한이 허용되었습니다.');
        }
      } catch { showToast('알림 설정 중 오류가 발생했습니다.'); }
    } else {
      if (!('Notification' in window)) { showToast('앱을 설치하면 알림을 받을 수 있습니다.'); return; }
      const r = await Notification.requestPermission();
      showToast(r === 'granted' ? '알림 권한이 허용되었습니다.' : '알림 권한이 거부되었습니다.');
    }
  };

  // ── 전체 초기화 ─────────────────────────────────────────────────
  const handleClearData = () => {
    if (!window.confirm(
      '모든 데이터(완료 기록, 사용자 추가 기도문, 그룹, 오늘 목록)를 초기화할까요?\n이 작업은 되돌릴 수 없습니다.'
    )) return;
    localStorage.clear();
    showToast('초기화 완료. 잠시 후 새로고침됩니다.');
    setTimeout(() => window.location.reload(), 1500);
  };

  // ── 통계 ────────────────────────────────────────────────────────
  const totalPrayers    = prayers.length;
  const userPrayers     = prayers.filter(p => p.source === 'user').length;
  const totalGroups     = groups.length;
  const completionDays  = Object.keys(completions).length;
  const totalCompletions= Object.values(completions).reduce((s, arr) => s + arr.length, 0);

  // ────────────────────────────────────────────────────────────────
  return (
    <div className="set-page">
      <div className="set-header">
        <div className="set-header__title">설정</div>
        <div className="set-header__sub">앱 환경 설정</div>
      </div>

      {/* 기도 통계 */}
      <div className="set-section-label">기도 통계</div>
      <div className="set-stats">
        <div className="set-stat"><div className="set-stat__num">{totalPrayers}</div><div className="set-stat__label">전체 기도문</div></div>
        <div className="set-stat"><div className="set-stat__num">{userPrayers}</div><div className="set-stat__label">내가 추가한</div></div>
        <div className="set-stat"><div className="set-stat__num">{totalGroups}</div><div className="set-stat__label">기도 그룹</div></div>
        <div className="set-stat"><div className="set-stat__num">{completionDays}</div><div className="set-stat__label">기도한 날</div></div>
      </div>

      {/* 알림 */}
      <div className="set-section-label">알림</div>
      <div className="set-group">
        <div className="set-row">
          <div className="set-row__icon" style={{ background: '#FFF3E0' }}>🔔</div>
          <div className="set-row__text">
            <div className="set-row__title">기도 알림</div>
            <div className="set-row__desc">스케줄된 기도 시간에 알림</div>
          </div>
          <label className="set-toggle">
            <input type="checkbox" checked={notifEnabled}
              onChange={e => { setNotifEnabled(e.target.checked); if (e.target.checked) handleNotifPermission(); }} />
            <span className="set-toggle__track"><span className="set-toggle__thumb" /></span>
          </label>
        </div>
        {notifEnabled && <>
          <div className="set-row set-row--sub">
            <div className="set-row__icon" style={{ background: '#F3E5F5' }}>🔊</div>
            <div className="set-row__text"><div className="set-row__title">알림음</div></div>
            <label className="set-toggle">
              <input type="checkbox" checked={notifSound} onChange={e => setNotifSound(e.target.checked)} />
              <span className="set-toggle__track"><span className="set-toggle__thumb" /></span>
            </label>
          </div>
          <div className="set-row set-row--sub">
            <div className="set-row__icon" style={{ background: '#E8F5E9' }}>📳</div>
            <div className="set-row__text"><div className="set-row__title">진동</div></div>
            <label className="set-toggle">
              <input type="checkbox" checked={notifVibrate} onChange={e => setNotifVibrate(e.target.checked)} />
              <span className="set-toggle__track"><span className="set-toggle__thumb" /></span>
            </label>
          </div>
        </>}
        <button className="set-row set-row--btn" onClick={handleNotifPermission}>
          <div className="set-row__icon" style={{ background: '#E8F5E9' }}>✅</div>
          <div className="set-row__text">
            <div className="set-row__title">알림 권한 확인</div>
            <div className="set-row__desc">브라우저 알림 권한을 요청합니다</div>
          </div>
          <div className="set-row__arrow">›</div>
        </button>
      </div>

      {/* 데이터 */}
      <div className="set-section-label">데이터</div>
      <div className="set-group">
        <button className="set-row set-row--btn" onClick={handleExport}>
          <div className="set-row__icon" style={{ background: '#FFF8E1' }}>📤</div>
          <div className="set-row__text">
            <div className="set-row__title">데이터 내보내기</div>
            <div className="set-row__desc">기도문·그룹·기록을 JSON 파일로 공유</div>
          </div>
          <div className="set-row__arrow">›</div>
        </button>
        <button className="set-row set-row--btn" onClick={handleImport}>
          <div className="set-row__icon" style={{ background: '#E3F2FD' }}>📂</div>
          <div className="set-row__text">
            <div className="set-row__title">데이터 가져오기</div>
            <div className="set-row__desc">백업 JSON 또는 기도문 JSON 불러오기</div>
          </div>
          <div className="set-row__arrow">›</div>
        </button>
      </div>

      {/* 서버 백업 */}
      <div className="set-section-label">서버 백업 (7일 보관)</div>
      <div className="set-group">
        <button className="set-row set-row--btn" onClick={handleServerExport} disabled={exportLoading}>
          <div className="set-row__icon" style={{ background: '#E8F5E9' }}>☁️</div>
          <div className="set-row__text">
            <div className="set-row__title">서버로 내보내기</div>
            <div className="set-row__desc">비밀번호를 받아 다른 기기에서 복원</div>
          </div>
          {exportLoading
            ? <div className="set-row__spinner" />
            : <div className="set-row__arrow">›</div>}
        </button>
        <button className="set-row set-row--btn" onClick={() => { setImportModal(true); setImportCode(''); }}>
          <div className="set-row__icon" style={{ background: '#EDE7F6' }}>☁️</div>
          <div className="set-row__text">
            <div className="set-row__title">서버에서 가져오기</div>
            <div className="set-row__desc">비밀번호를 입력해 데이터 복원</div>
          </div>
          <div className="set-row__arrow">›</div>
        </button>
      </div>

      {/* 관리 */}
      <div className="set-section-label">관리</div>
      <div className="set-group">
        <button className="set-row set-row--btn set-row--danger" onClick={handleClearData}>
          <div className="set-row__icon" style={{ background: '#FFEBEE' }}>🗑️</div>
          <div className="set-row__text">
            <div className="set-row__title set-row__title--danger">전체 데이터 초기화</div>
            <div className="set-row__desc">모든 기록 및 설정이 삭제됩니다</div>
          </div>
          <div className="set-row__arrow">›</div>
        </button>
      </div>

      {/* 앱 정보 */}
      <div className="set-section-label">정보</div>
      <div className="set-group">
        <div className="set-row">
          <div className="set-row__icon" style={{ background: '#F3E5F5' }}>🙏</div>
          <div className="set-row__text"><div className="set-row__title">마음의 기도</div><div className="set-row__desc">버전 1.0.0</div></div>
        </div>
        <div className="set-row">
          <div className="set-row__icon" style={{ background: '#E8F5E9' }}>📖</div>
          <div className="set-row__text"><div className="set-row__title">기도문 출처</div><div className="set-row__desc">한국 천주교 주교회의 공인 기도문</div></div>
        </div>
        <div className="set-row">
          <div className="set-row__icon" style={{ background: '#E3F2FD' }}>💾</div>
          <div className="set-row__text"><div className="set-row__title">누적 기도 완료</div><div className="set-row__desc">총 {totalCompletions}회 기도 완료 기록</div></div>
        </div>
      </div>

      {toast && <div className="set-toast">{toast}</div>}

      {/* 로컬 가져오기용 hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      {/* ── 서버 내보내기 결과 모달 ──────────────────────────────── */}
      {exportModal && (
        <div className="set-modal-bg" onClick={() => setExportModal(false)}>
          <div className="set-modal" onClick={e => e.stopPropagation()}>
            <div className="set-modal__title">📤 서버 내보내기 완료</div>
            <div className="set-modal__desc">아래 비밀번호로 7일 안에 복원할 수 있습니다.</div>
            <div className="set-modal__code">{exportCode}</div>
            <div className="set-modal__expiry">유효기간: {exportExpiry}까지</div>
            <button className="set-modal__share-btn" onClick={handleShareCode}>
              공유하기 (카카오·문자 등)
            </button>
            <button className="set-modal__close-btn" onClick={() => setExportModal(false)}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* ── 서버 가져오기 모달 ───────────────────────────────────── */}
      {importModal && (
        <div className="set-modal-bg" onClick={() => { if (!importLoading) setImportModal(false); }}>
          <div className="set-modal" onClick={e => e.stopPropagation()}>
            <div className="set-modal__title">☁️ 서버에서 가져오기</div>
            <div className="set-modal__desc">서버 내보내기 시 받은 비밀번호를 입력하세요.</div>
            <input
              ref={importInputRef}
              className="set-modal__input"
              placeholder="비밀번호 (예: A3BKPX7M)"
              value={importCode}
              onChange={e => setImportCode(e.target.value.toUpperCase())}
              maxLength={12}
              autoCapitalize="characters"
              onKeyDown={e => { if (e.key === 'Enter') handleServerImport(); }}
              disabled={importLoading}
            />
            <button
              className="set-modal__share-btn"
              onClick={handleServerImport}
              disabled={importLoading || importCode.trim().length < 6}
            >
              {importLoading ? '복원 중…' : '가져오기'}
            </button>
            <button
              className="set-modal__close-btn"
              onClick={() => setImportModal(false)}
              disabled={importLoading}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
