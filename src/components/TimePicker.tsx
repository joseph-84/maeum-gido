// ============================================================
// components/TimePicker.tsx — 모바일 친화적 커스텀 시간 선택기
// ============================================================
import React, { useState } from 'react';
import './TimePicker.css';

interface TimePickerProps {
  value: string;       // "HH:MM" 24시간 형식
  onChange: (time: string) => void;
  onClose: () => void;
}

const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, onClose }) => {
  const [h, m] = value.split(':').map(Number);

  const initPeriod = h >= 12 ? 'PM' : 'AM';
  const initHour   = h === 0 ? 12 : h > 12 ? h - 12 : h;

  const [period, setPeriod] = useState<'AM' | 'PM'>(initPeriod);
  const [hour,   setHour]   = useState(initHour);
  const [minute, setMinute] = useState(m);

  const to24h = (h: number, p: 'AM' | 'PM') => {
    if (p === 'AM') return h === 12 ? 0 : h;
    return h === 12 ? 12 : h + 12;
  };

  const handleConfirm = () => {
    const h24 = to24h(hour, period);
    onChange(`${String(h24).padStart(2,'0')}:${String(minute).padStart(2,'0')}`);
    onClose();
  };

  const HOURS   = [12,1,2,3,4,5,6,7,8,9,10,11];
  const MINUTES = [0,5,10,15,20,25,30,35,40,45,50,55];

  return (
    <div className="tp-bg" onClick={onClose}>
      <div className="tp-sheet" onClick={e => e.stopPropagation()}>
        <div className="tp-handle"/>
        <div className="tp-title">기도 시간 설정</div>

        {/* 미리보기 */}
        <div className="tp-preview">
          <span className="tp-preview__time">
            {String(hour).padStart(2,'0')}:{String(minute).padStart(2,'0')}
          </span>
          <span className="tp-preview__period">{period === 'AM' ? '오전' : '오후'}</span>
        </div>

        {/* AM / PM */}
        <div className="tp-period">
          <button
            className={`tp-period__btn ${period === 'AM' ? 'tp-period__btn--active' : ''}`}
            onClick={() => setPeriod('AM')}
          >오전</button>
          <button
            className={`tp-period__btn ${period === 'PM' ? 'tp-period__btn--active' : ''}`}
            onClick={() => setPeriod('PM')}
          >오후</button>
        </div>

        {/* 시간 선택 */}
        <div className="tp-section-label">시</div>
        <div className="tp-grid tp-grid--hours">
          {HOURS.map(h => (
            <button
              key={h}
              className={`tp-cell ${hour === h ? 'tp-cell--active' : ''}`}
              onClick={() => setHour(h)}
            >{h}</button>
          ))}
        </div>

        {/* 분 선택 */}
        <div className="tp-section-label">분</div>
        <div className="tp-grid tp-grid--minutes">
          {MINUTES.map(m => (
            <button
              key={m}
              className={`tp-cell ${minute === m ? 'tp-cell--active' : ''}`}
              onClick={() => setMinute(m)}
            >{String(m).padStart(2,'0')}</button>
          ))}
        </div>

        {/* 버튼 */}
        <div className="tp-footer">
          <button className="tp-footer__cancel" onClick={onClose}>취소</button>
          <button className="tp-footer__confirm" onClick={handleConfirm}>확인</button>
        </div>
      </div>
    </div>
  );
};

export default TimePicker;
