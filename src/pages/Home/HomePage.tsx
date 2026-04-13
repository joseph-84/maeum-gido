import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppData';
import { TodayItem, StoredPrayer } from '../../utils/storage';
import './HomePage.css';

const DAYS_LABEL = ['일','월','화','수','목','금','토'];

function toKey(y:number,m:number,d:number){
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function getDaysInMonth(y:number,m:number){ return new Date(y,m,0).getDate(); }
function getFirstDow(y:number,m:number){ return new Date(y,m-1,1).getDay(); }

const CAT_COLORS: Record<string,string> = {
  '주요기도':'#4A9B6F','묵주기도':'#E86B5E','고해성사':'#A0522D',
  '성체성사':'#3A9BE8','호칭기도':'#7B68EE','여러가지기도':'#E8963A',
  '레지오마리애':'#9B4A9B',
};
function catColor(cat:string){ return CAT_COLORS[cat] ?? '#8A8A8E'; }

// ── 기도문 모달 ──────────────────────────────────────────────
interface PrayerModalProps {
  prayer: StoredPrayer;
  onClose: () => void;
}
const PrayerModal: React.FC<PrayerModalProps> = ({ prayer, onClose }) => (
  <div className="hm-bg" onClick={onClose}>
    <div className="hm-sheet" onClick={e=>e.stopPropagation()} style={{maxHeight:'80vh'}}>
      <div className="hm-handle"/>
      <div className="hm-head">
        <div>
          <div className="hm-head__title">{prayer.title}</div>
          <span className="hm-prayer-cat" style={{color:catColor(prayer.category)}}>{prayer.category}</span>
        </div>
        <button className="hm-head__close" onClick={onClose}>✕</button>
      </div>
      <div className="hm-prayer-content">{prayer.content.replace(/\\n/g, '\n')}</div>
    </div>
  </div>
);

// ── 그룹 기도 목록 모달 ──────────────────────────────────────
interface GroupPrayerListProps {
  groupName: string;
  prayers: StoredPrayer[];
  onSelectPrayer: (p: StoredPrayer) => void;
  onClose: () => void;
}
const GroupPrayerList: React.FC<GroupPrayerListProps> = ({ groupName, prayers, onSelectPrayer, onClose }) => (
  <div className="hm-bg" onClick={onClose}>
    <div className="hm-sheet" onClick={e=>e.stopPropagation()}>
      <div className="hm-handle"/>
      <div className="hm-head">
        <div className="hm-head__title">{groupName}</div>
        <button className="hm-head__close" onClick={onClose}>✕</button>
      </div>
      <p className="hm-group-hint">기도문을 눌러 내용을 확인하세요</p>
      <div className="hm-group-list">
        {prayers.map((p,idx) => (
          <button key={p.id} className="hm-group-prayer-btn" onClick={()=>onSelectPrayer(p)}>
            <div className="hm-group-prayer-btn__num">{idx+1}</div>
            <div className="hm-group-prayer-btn__dot" style={{background:catColor(p.category)}}/>
            <div className="hm-group-prayer-btn__info">
              <div className="hm-group-prayer-btn__title">{p.title}</div>
              <div className="hm-group-prayer-btn__cat">{p.category}</div>
            </div>
            <span className="hm-group-prayer-btn__arrow">›</span>
          </button>
        ))}
      </div>
    </div>
  </div>
);

const HomePage: React.FC = () => {
  const { prayers, groups, todayList, setTodayList, toggleCompletion, getCompletionsForDate } = useAppContext();

  const now = new Date();
  const todayYear=now.getFullYear(), todayMonth=now.getMonth()+1, todayDate=now.getDate(), todayDow=now.getDay();

  const [calYear,setCalYear]           = useState(todayYear);
  const [calMonth,setCalMonth]         = useState(todayMonth);
  const [selectedDate,setSelectedDate] = useState(todayDate);
  const [showEditor,setShowEditor]     = useState(false);
  const [showPicker,setShowPicker]     = useState(false);
  const [editList,setEditList]         = useState<TodayItem[]>([]);
  const [pickerSearch,setPickerSearch] = useState('');
  const [pickerTab,setPickerTab]       = useState<'prayer'|'group'>('prayer');

  // 기도문 모달
  const [viewPrayer,setViewPrayer]         = useState<StoredPrayer|null>(null);
  // 그룹 -> 기도문 목록 모달
  const [viewGroup,setViewGroup]           = useState<{name:string;prayers:StoredPrayer[]}|null>(null);

  const isViewingToday = calYear===todayYear && calMonth===todayMonth && selectedDate===todayDate;
  const selectedKey = toKey(calYear,calMonth,selectedDate);

  const displayItems = useMemo(()=>
    todayList.filter(item=>item.days.length===0||item.days.includes(todayDow))
  ,[todayList,todayDow]);

  const resolveItem = (item:TodayItem) => {
    if(item.type==='prayer'){
      const p=prayers.find(x=>x.id===item.id);
      return {title:p?.title??'(삭제됨)',color:catColor(p?.category??''),ids:[item.id],prayer:p,group:null};
    }
    const g=groups.find(x=>x.id===item.id);
    const gPrayers=(g?.prayerIds??[]).map(id=>prayers.find(p=>p.id===id)).filter(Boolean) as StoredPrayer[];
    return {title:g?.name??'(삭제됨)',color:g?.color??'#9B4A9B',ids:g?.prayerIds??[],prayer:null,group:g?{name:g.name,prayers:gPrayers}:null};
  };

  const total=displayItems.length;
  const doneCount=displayItems.filter(item=>{
    const {ids}=resolveItem(item);
    return ids.length>0 && ids.every(id=>getCompletionsForDate(selectedKey).includes(id));
  }).length;
  const pct=total>0?Math.round(doneCount/total*100):0;

  const handleToggle=(item:TodayItem)=>{
    const {ids}=resolveItem(item);
    if(ids.length===0) return;
    const log=getCompletionsForDate(selectedKey);
    const allDone=ids.every(id=>log.includes(id));
    ids.forEach(id=>{
      const isDone=log.includes(id);
      if(allDone&&isDone) toggleCompletion(selectedKey,id);
      if(!allDone&&!isDone) toggleCompletion(selectedKey,id);
    });
  };

  // 항목 클릭: 기도문이면 바로 모달, 그룹이면 기도 목록 모달
  const handleItemClick=(item:TodayItem)=>{
    const {prayer,group}=resolveItem(item);
    if(prayer) setViewPrayer(prayer);
    else if(group) setViewGroup(group);
  };

  const prevMonth=()=>{if(calMonth===1){setCalYear(y=>y-1);setCalMonth(12);}else setCalMonth(m=>m-1);setSelectedDate(1);};
  const nextMonth=()=>{if(calMonth===12){setCalYear(y=>y+1);setCalMonth(1);}else setCalMonth(m=>m+1);setSelectedDate(1);};
  const goToday=()=>{setCalYear(todayYear);setCalMonth(todayMonth);setSelectedDate(todayDate);};

  const getDotType=(date:number)=>{
    const log=getCompletionsForDate(toKey(calYear,calMonth,date));
    if(!log.length||!total) return null;
    const n=displayItems.filter(item=>resolveItem(item).ids.every(id=>log.includes(id))).length;
    if(n===0) return null;
    if(n>=total) return 'full';
    if(n>=Math.ceil(total/2)) return 'half';
    return 'some';
  };

  const openEditor=()=>{setEditList([...todayList]);setShowEditor(true);};
  const openPicker=()=>{setPickerSearch('');setPickerTab('prayer');setShowPicker(true);};
  const addToList=(id:string,type:'prayer'|'group')=>{
    if(editList.find(x=>x.id===id)) return;
    setEditList(prev=>[...prev,{id,type,time:'09:00',days:[]}]);
    setShowPicker(false);
  };
  const removeItem=(id:string)=>setEditList(prev=>prev.filter(x=>x.id!==id));
  const moveUp=(idx:number)=>setEditList(prev=>{const a=[...prev];if(idx===0)return a;[a[idx-1],a[idx]]=[a[idx],a[idx-1]];return a;});
  const moveDown=(idx:number)=>setEditList(prev=>{const a=[...prev];if(idx===a.length-1)return a;[a[idx],a[idx+1]]=[a[idx+1],a[idx]];return a;});
  const updateTime=(idx:number,time:string)=>setEditList(prev=>prev.map((x,i)=>i===idx?{...x,time}:x));
  const saveEditor=()=>{setTodayList(editList);setShowEditor(false);};

  const filteredPrayers=useMemo(()=>prayers.filter(p=>p.title.includes(pickerSearch)||p.category.includes(pickerSearch)),[prayers,pickerSearch]);
  const filteredGroups=useMemo(()=>groups.filter(g=>g.name.includes(pickerSearch)),[groups,pickerSearch]);

  return (
    <div className="home-page">
      {/* 헤더 */}
      <div className="home-header">
        <div className="home-header__row">
          <div>
            <div className="home-header__title">마음의 기도</div>
            <div className="home-header__date">
              {calYear}년 {calMonth}월 {selectedDate}일 · {DAYS_LABEL[new Date(calYear,calMonth-1,selectedDate).getDay()]}요일
              {!isViewingToday&&<button className="home-today-btn" onClick={goToday}>오늘로</button>}
            </div>
          </div>
          <button className="home-edit-btn" onClick={openEditor}>편집</button>
        </div>
      </div>

      {/* 진행률 */}
      <div className="home-progress">
        <div className="home-progress__label">{isViewingToday?'오늘의 기도 완료':`${calMonth}월 ${selectedDate}일 기도 기록`}</div>
        <div className="home-progress__bar-bg"><div className="home-progress__bar-fill" style={{width:`${pct}%`}}/></div>
        <div className="home-progress__nums"><span>{doneCount} / {total} 완료</span><span>{pct}%</span></div>
      </div>

      {/* 기도 목록 */}
      <div className="home-section-label">
        {isViewingToday?'오늘 기도 목록':`${calMonth}월 ${selectedDate}일`}
        {!isViewingToday&&<span className="home-badge">기록 수정 중</span>}
      </div>
      <div className="home-list">
        {displayItems.length===0?(
          <div className="home-empty">
            <div className="home-empty__icon">🙏</div>
            <div className="home-empty__text">기도 목록이 없어요</div>
            <button className="home-empty__btn" onClick={openEditor}>목록 편집하기</button>
          </div>
        ):displayItems.map(item=>{
          const {title,color,ids}=resolveItem(item);
          const log=getCompletionsForDate(selectedKey);
          const isDone=ids.length>0&&ids.every(id=>log.includes(id));
          return(
            <div key={item.id} className={`home-item ${isDone?'home-item--done':''}`}>
              {/* 왼쪽: 클릭하면 기도문 모달 */}
              <button className="home-item__main" onClick={()=>handleItemClick(item)}>
                <div className="home-item__left">
                  <div className="home-item__dot" style={{background:color}}/>
                  {item.type==='group'&&<span className="home-item__group-tag">그룹</span>}
                </div>
                <div className="home-item__text">
                  <div className="home-item__title">{title}</div>
                  <div className="home-item__meta">
                    {item.time} · {item.days.length===0?'매일':item.days.map(d=>DAYS_LABEL[d]).join('·')}
                    {item.type==='group'&&<span className="home-item__meta-hint"> · 눌러서 기도문 보기</span>}
                  </div>
                </div>
                <span className="home-item__chevron">›</span>
              </button>
              {/* 오른쪽: 완료 체크 */}
              <button className={`home-item__check ${isDone?'home-item__check--done':''}`} onClick={()=>handleToggle(item)}>✓</button>
            </div>
          );
        })}
      </div>

      {/* 달력 */}
      <div className="home-section-label">기도 기록</div>
      <div className="home-calendar">
        <div className="home-cal__nav">
          <button className="home-cal__nav-btn" onClick={prevMonth}>‹</button>
          <span className="home-cal__nav-title">{calYear}년 {calMonth}월</span>
          <button className="home-cal__nav-btn" onClick={nextMonth}>›</button>
        </div>
        <div className="home-cal__header">{DAYS_LABEL.map(d=><div key={d} className="home-cal__day-label">{d}</div>)}</div>
        <div className="home-cal__cells">
          {Array.from({length:getFirstDow(calYear,calMonth)},(_,i)=><div key={`e${i}`}/>)}
          {Array.from({length:getDaysInMonth(calYear,calMonth)},(_,i)=>i+1).map(d=>{
            const dot=getDotType(d);
            const isCur=calYear===todayYear&&calMonth===todayMonth&&d===todayDate;
            const isSel=d===selectedDate;
            return(
              <button key={d} className={['home-cal__cell',isCur?'home-cal__cell--today':'',isSel?'home-cal__cell--selected':''].join(' ')} onClick={()=>setSelectedDate(d)}>
                {d}{dot&&<span className={`home-cal__dot home-cal__dot--${dot}`}/>}
              </button>
            );
          })}
        </div>
        <div className="home-cal__legend">
          <span><span className="home-cal__dot home-cal__dot--full"/>전체 완료</span>
          <span><span className="home-cal__dot home-cal__dot--half"/>절반 이상</span>
          <span><span className="home-cal__dot home-cal__dot--some"/>일부 완료</span>
        </div>
      </div>

      {/* ── 기도문 모달 ── */}
      {viewPrayer&&<PrayerModal prayer={viewPrayer} onClose={()=>setViewPrayer(null)}/>}

      {/* ── 그룹 기도 목록 모달 ── */}
      {viewGroup&&!viewPrayer&&(
        <GroupPrayerList
          groupName={viewGroup.name}
          prayers={viewGroup.prayers}
          onSelectPrayer={p=>{setViewPrayer(p);}}
          onClose={()=>setViewGroup(null)}
        />
      )}

      {/* ── 편집 모달 ── */}
      {showEditor&&(
        <div className="hm-bg" onClick={()=>setShowEditor(false)}>
          <div className="hm-sheet" onClick={e=>e.stopPropagation()}>
            <div className="hm-handle"/>
            <div className="hm-head">
              <span className="hm-head__title">기도 목록 편집</span>
              <button className="hm-head__close" onClick={()=>setShowEditor(false)}>✕</button>
            </div>
            <div className="hm-body">
              {editList.length===0?(
                <div className="hm-empty"><div className="hm-empty__icon">📋</div><div className="hm-empty__text">아직 항목이 없어요</div></div>
              ):(
                <div className="hm-items">
                  {editList.map((item,idx)=>{
                    const label=item.type==='prayer'
                      ?prayers.find(p=>p.id===item.id)?.title??'(없음)'
                      :groups.find(g=>g.id===item.id)?.name??'(없음)';
                    const color=item.type==='prayer'
                      ?catColor(prayers.find(p=>p.id===item.id)?.category??'')
                      :groups.find(g=>g.id===item.id)?.color??'#9B4A9B';
                    return(
                      <div key={item.id} className="hm-item">
                        <div className="hm-item__color-bar" style={{background:color}}/>
                        <div className="hm-item__content">
                          <div className="hm-item__top">
                            <span className={`hm-item__tag hm-item__tag--${item.type}`}>{item.type==='group'?'그룹':'기도'}</span>
                            <span className="hm-item__label">{label}</span>
                          </div>
                          <div className="hm-item__bottom">
                            <div className="hm-item__time-wrap">
                              <span className="hm-item__time-icon">⏰</span>
                              <input type="time" value={item.time} className="hm-item__time" onChange={e=>updateTime(idx,e.target.value)}/>
                            </div>
                          </div>
                        </div>
                        <div className="hm-item__controls">
                          <button className="hm-item__move" onClick={()=>moveUp(idx)} disabled={idx===0}>↑</button>
                          <button className="hm-item__move" onClick={()=>moveDown(idx)} disabled={idx===editList.length-1}>↓</button>
                          <button className="hm-item__remove" onClick={()=>removeItem(item.id)}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <button className="hm-add-btn" onClick={openPicker}>
                <span className="hm-add-btn__icon">+</span>기도문 또는 그룹 추가
              </button>
            </div>
            <div className="hm-footer">
              <button className="hm-footer__cancel" onClick={()=>setShowEditor(false)}>취소</button>
              <button className="hm-footer__save" onClick={saveEditor}>저장하기</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 픽커 모달 ── */}
      {showPicker&&(
        <div className="hm-bg" onClick={()=>setShowPicker(false)}>
          <div className="hm-sheet hm-sheet--picker" onClick={e=>e.stopPropagation()}>
            <div className="hm-handle"/>
            <div className="hm-head">
              <span className="hm-head__title">추가할 항목 선택</span>
              <button className="hm-head__close" onClick={()=>setShowPicker(false)}>✕</button>
            </div>
            <div className="hm-search">
              <span className="hm-search__icon">🔍</span>
              <input className="hm-search__input" placeholder="검색..." value={pickerSearch} onChange={e=>setPickerSearch(e.target.value)}/>
              {pickerSearch&&<button className="hm-search__clear" onClick={()=>setPickerSearch('')}>✕</button>}
            </div>
            <div className="hm-tabs">
              <button className={`hm-tab ${pickerTab==='prayer'?'hm-tab--active':''}`} onClick={()=>setPickerTab('prayer')}>기도문 ({filteredPrayers.length})</button>
              <button className={`hm-tab ${pickerTab==='group'?'hm-tab--active':''}`} onClick={()=>setPickerTab('group')}>그룹 ({filteredGroups.length})</button>
            </div>
            <div className="hm-picker-list">
              {pickerTab==='prayer'&&(
                filteredPrayers.length===0
                  ?<div className="hm-picker-empty">검색 결과가 없습니다</div>
                  :filteredPrayers.map(p=>{
                    const already=!!editList.find(x=>x.id===p.id);
                    return(
                      <button key={p.id} className={`hm-picker-item ${already?'hm-picker-item--added':''}`} onClick={()=>addToList(p.id,'prayer')} disabled={already}>
                        <div className="hm-picker-item__dot" style={{background:catColor(p.category)}}/>
                        <div className="hm-picker-item__info">
                          <div className="hm-picker-item__title">{p.title}</div>
                          <div className="hm-picker-item__cat">{p.category}</div>
                        </div>
                        <span className="hm-picker-item__action">{already?'✓':'+'}</span>
                      </button>
                    );
                  })
              )}
              {pickerTab==='group'&&(
                filteredGroups.length===0
                  ?<div className="hm-picker-empty">{groups.length===0?'그룹 탭에서 먼저 그룹을 만들어주세요':'검색 결과가 없습니다'}</div>
                  :filteredGroups.map(g=>{
                    const already=!!editList.find(x=>x.id===g.id);
                    return(
                      <button key={g.id} className={`hm-picker-item ${already?'hm-picker-item--added':''}`} onClick={()=>addToList(g.id,'group')} disabled={already}>
                        <div className="hm-picker-item__dot" style={{background:g.color}}/>
                        <div className="hm-picker-item__info">
                          <div className="hm-picker-item__title">{g.name}</div>
                          <div className="hm-picker-item__cat">{g.prayerIds.length}개 기도문</div>
                        </div>
                        <span className="hm-picker-item__action">{already?'✓':'+'}</span>
                      </button>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;