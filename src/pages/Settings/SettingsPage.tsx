import React, { useState } from 'react';
import { useAppContext } from '../../hooks/useAppData';
import { syncPrayersFromServer } from '../../utils/prayerSync';
import { savePrayers, saveGroups, saveCompletions, saveTodayList } from '../../utils/storage';
import './SettingsPage.css';

const SettingsPage: React.FC = () => {
  const { prayers, groups, completions, todayList, setTodayList } = useAppContext();

  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifSound,   setNotifSound]   = useState(true);
  const [notifVibrate, setNotifVibrate] = useState(true);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  };

  // ── 데이터 내보내기 ────────────────────────────────────────
  const handleExport = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      prayers,
      groups,
      completions,
      todayList,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `maeum-gido-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('백업 파일이 다운로드되었습니다.');
  };

  // ── JSON 가져오기 ──────────────────────────────────────────
  const handleImport = () => {
    const input = document.createElement('input');
    input.type  = 'file';
    input.accept= '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          // prayers.json 형식 (배열) 또는 백업 형식 (객체) 모두 지원
          if (Array.isArray(data)) {
            // 기도문만 있는 JSON
            savePrayers(data);
            showToast(`기도문 ${data.length}개를 가져왔습니다. 새로고침하면 반영됩니다.`);
          } else if (data.prayers) {
            // 전체 백업 JSON
            if (data.prayers)    savePrayers(data.prayers);
            if (data.groups)     saveGroups(data.groups);
            if (data.completions)saveCompletions(data.completions);
            if (data.todayList)  { saveTodayList(data.todayList); setTodayList(data.todayList); }
            showToast('백업 데이터를 복원했습니다. 새로고침하면 반영됩니다.');
          } else {
            showToast('지원하지 않는 파일 형식입니다.');
          }
        } catch {
          showToast('파일을 읽는 중 오류가 발생했습니다.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // ── 알림 권한 요청 ────────────────────────────────────────
  const handleNotifPermission = async () => {
    if (!('Notification' in window)) {
      showToast('이 브라우저는 알림을 지원하지 않습니다.');
      return;
    }
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      showToast('알림 권한이 허용되었습니다.');
    } else {
      showToast('알림 권한이 거부되었습니다. 브라우저 설정에서 변경해주세요.');
    }
  };

  // ── 전체 초기화 ───────────────────────────────────────────
  const handleClearData = () => {
    if (!window.confirm(
      '모든 데이터(완료 기록, 사용자 추가 기도문, 그룹, 오늘 목록)를 초기화할까요?\n이 작업은 되돌릴 수 없습니다.'
    )) return;
    localStorage.clear();
    showToast('초기화 완료. 잠시 후 새로고침됩니다.');
    setTimeout(() => window.location.reload(), 1500);
  };

  // ── 통계 계산 ─────────────────────────────────────────────
  const totalPrayers    = prayers.length;
  const userPrayers     = prayers.filter(p => p.source === 'user').length;
  const totalGroups     = groups.length;
  const completionDays  = Object.keys(completions).length;
  const totalCompletions= Object.values(completions).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="set-page">
      <div className="set-header">
        <div className="set-header__title">설정</div>
        <div className="set-header__sub">앱 환경 설정</div>
      </div>

      {/* 기도 통계 */}
      <div className="set-section-label">기도 통계</div>
      <div className="set-stats">
        <div className="set-stat">
          <div className="set-stat__num">{totalPrayers}</div>
          <div className="set-stat__label">전체 기도문</div>
        </div>
        <div className="set-stat">
          <div className="set-stat__num">{userPrayers}</div>
          <div className="set-stat__label">내가 추가한</div>
        </div>
        <div className="set-stat">
          <div className="set-stat__num">{totalGroups}</div>
          <div className="set-stat__label">기도 그룹</div>
        </div>
        <div className="set-stat">
          <div className="set-stat__num">{completionDays}</div>
          <div className="set-stat__label">기도한 날</div>
        </div>
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
              onChange={e => { setNotifEnabled(e.target.checked); if(e.target.checked) handleNotifPermission(); }} />
            <span className="set-toggle__track"><span className="set-toggle__thumb"/></span>
          </label>
        </div>
        {notifEnabled && <>
          <div className="set-row set-row--sub">
            <div className="set-row__icon" style={{ background: '#F3E5F5' }}>🔊</div>
            <div className="set-row__text"><div className="set-row__title">알림음</div></div>
            <label className="set-toggle">
              <input type="checkbox" checked={notifSound} onChange={e => setNotifSound(e.target.checked)} />
              <span className="set-toggle__track"><span className="set-toggle__thumb"/></span>
            </label>
          </div>
          <div className="set-row set-row--sub">
            <div className="set-row__icon" style={{ background: '#E8F5E9' }}>📳</div>
            <div className="set-row__text"><div className="set-row__title">진동</div></div>
            <label className="set-toggle">
              <input type="checkbox" checked={notifVibrate} onChange={e => setNotifVibrate(e.target.checked)} />
              <span className="set-toggle__track"><span className="set-toggle__thumb"/></span>
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
            <div className="set-row__desc">기도문·그룹·기록을 JSON으로 백업</div>
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
          <div className="set-row__text">
            <div className="set-row__title">마음의 기도</div>
            <div className="set-row__desc">버전 1.0.0</div>
          </div>
        </div>
        <div className="set-row">
          <div className="set-row__icon" style={{ background: '#E8F5E9' }}>📖</div>
          <div className="set-row__text">
            <div className="set-row__title">기도문 출처</div>
            <div className="set-row__desc">한국 천주교 주교회의 공인 기도문</div>
          </div>
        </div>
        <div className="set-row">
          <div className="set-row__icon" style={{ background: '#E3F2FD' }}>💾</div>
          <div className="set-row__text">
            <div className="set-row__title">누적 기도 완료</div>
            <div className="set-row__desc">총 {totalCompletions}회 기도 완료 기록</div>
          </div>
        </div>
      </div>

      {toast && <div className="set-toast">{toast}</div>}
    </div>
  );
};

export default SettingsPage;