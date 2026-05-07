import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../hooks/useAppData';
import { StoredPrayer, TodayItem, BIBLE_PRAYER_IDS } from '../../utils/storage';
import { registerBackHandler } from '../../utils/backHandler';
import { useDailyBible, buildBibleUrl, todayKSTString, BibleSection } from '../../hooks/useDailyBible';
import './LibraryPage.css';

const CATEGORY_COLORS: Record<string, string> = {
  '주요기도': '#4A9B6F', '묵주기도': '#E86B5E', '고해성사': '#A0522D',
  '성체성사': '#3A9BE8', '호칭기도': '#7B68EE', '여러가지기도': '#E8963A',
  '레지오마리애': '#9B4A9B',
};
function catColor(cat: string) { return CATEGORY_COLORS[cat] ?? '#8A8A8E'; }

type TabType = '전체' | '즐겨찾기' | '매일성경';

// ── 매일 성경 탭 ─────────────────────────────────────────────────────────
interface BibleCardProps {
  section: BibleSection;
  onAddToList: (id: 'bible-reading' | 'bible-gospel') => void;
  bibleId: 'bible-reading' | 'bible-gospel';
  alreadyAdded: boolean;
}

const BibleCard: React.FC<BibleCardProps> = ({ section, onAddToList, bibleId, alreadyAdded }) => {
  const [expanded, setExpanded] = useState(false);
  const preview = section.content.slice(0, 80) + (section.content.length > 80 ? '…' : '');

  return (
    <div className="bible-card">
      <div className="bible-card__header" onClick={() => setExpanded(e => !e)}>
        <div className="bible-card__title-row">
          <span className="bible-card__icon">{bibleId === 'bible-gospel' ? '✝' : '📖'}</span>
          <span className="bible-card__title">{section.title}</span>
          {section.book && <span className="bible-card__book">{section.book}</span>}
        </div>
        <span className="bible-card__arrow">{expanded ? '▲' : '▼'}</span>
      </div>

      {!expanded && (
        <div className="bible-card__preview">{preview}</div>
      )}

      {expanded && (
        <div className="bible-card__content">{section.content}</div>
      )}

      <div className="bible-card__footer">
        <button
          className={`bible-card__add-btn ${alreadyAdded ? 'bible-card__add-btn--added' : ''}`}
          onClick={() => !alreadyAdded && onAddToList(bibleId)}
          disabled={alreadyAdded}
        >
          {alreadyAdded ? '✓ 오늘 목록에 있음' : '+ 오늘 목록에 추가'}
        </button>
        <a
          className="bible-card__link"
          href={buildBibleUrl(todayKSTString())}
          target="_blank"
          rel="noopener noreferrer"
        >
          원문 보기 ↗
        </a>
      </div>
    </div>
  );
};

const BibleTab: React.FC<{ todayList: TodayItem[]; onAddToList: (id: 'bible-reading'|'bible-gospel') => void }> = ({ todayList, onAddToList }) => {
  const { data, loading, error, retry } = useDailyBible();

  const readingAdded = todayList.some(i => i.id === 'bible-reading');
  const gospelAdded  = todayList.some(i => i.id === 'bible-gospel');

  if (loading) return (
    <div className="bible-status">
      <div className="bible-spinner" />
      <div className="bible-status__text">오늘의 성경 읽기를 불러오는 중…</div>
    </div>
  );

  if (error || !data) return (
    <div className="bible-status">
      <div className="bible-status__icon">📵</div>
      <div className="bible-status__text">성경 읽기를 불러오지 못했습니다.</div>
      <button className="bible-retry-btn" onClick={retry}>다시 시도</button>
    </div>
  );

  const hasReadings = data.readings.length > 0;
  const hasGospel   = !!data.gospel;

  if (!hasReadings && !hasGospel) return (
    <div className="bible-status">
      <div className="bible-status__icon">📖</div>
      <div className="bible-status__text">오늘의 독서 정보를 파싱하지 못했습니다.<br />원문에서 직접 확인해주세요.</div>
      <a className="bible-retry-btn" href={buildBibleUrl(data.date)} target="_blank" rel="noopener noreferrer">
        가톨릭 굿뉴스에서 보기 ↗
      </a>
    </div>
  );

  return (
    <div className="bible-tab">
      <div className="bible-date">📅 {data.date.replace(/-/g, '. ')}</div>

      {/* 독서 카드 (제1독서, 제2독서 등 합쳐서 1개 카드) */}
      {hasReadings && (() => {
        const merged: BibleSection = {
          title:   data.readings.length === 1 ? data.readings[0].title : `독서 (${data.readings.map(r => r.title).join(', ')})`,
          book:    data.readings[0].book,
          content: data.readings.map((r, i) =>
            data.readings.length > 1 ? `【${r.title}】\n${r.content}` : r.content
          ).join('\n\n'),
        };
        return (
          <BibleCard
            section={merged}
            bibleId="bible-reading"
            alreadyAdded={readingAdded}
            onAddToList={onAddToList}
          />
        );
      })()}

      {/* 복음 카드 */}
      {hasGospel && (
        <BibleCard
          section={data.gospel!}
          bibleId="bible-gospel"
          alreadyAdded={gospelAdded}
          onAddToList={onAddToList}
        />
      )}
    </div>
  );
};

// ── 메인 페이지 ───────────────────────────────────────────────────────────
// Bible 상세 내용 표시 컴포넌트
const BibleDetailContent: React.FC<{ prayerId: string }> = ({ prayerId }) => {
  const { data, loading, error, retry } = useDailyBible();
  if (loading) return <div style={{textAlign:'center',padding:'30px',color:'#999'}}>불러오는 중…</div>;
  if (error || !data) return (
    <div style={{textAlign:'center',padding:'30px'}}>
      <div style={{color:'#999',marginBottom:10}}>불러오지 못했습니다</div>
      <button onClick={retry} style={{background:'#2D5016',color:'#fff',border:'none',borderRadius:20,padding:'8px 20px',fontFamily:'Noto Sans KR',cursor:'pointer',fontSize:13}}>다시 시도</button>
    </div>
  );
  const isGospel = prayerId === 'bible-gospel';
  const section = isGospel ? data.gospel : (data.readings.length > 0 ? {
    title: '독서',
    book: data.readings[0].book,
    content: data.readings.map((r) =>
      data.readings.length > 1 ? `【${r.title}】\n${r.content}` : r.content
    ).join('\n\n'),
  } : null);
  if (!section?.content) return (
    <div style={{textAlign:'center',padding:'30px',color:'#999'}}>
      오늘의 내용을 파싱하지 못했습니다.<br />
      <a href={buildBibleUrl(todayKSTString())} target="_blank" rel="noopener noreferrer"
        style={{color:'#2D5016',fontSize:13}}>원문에서 확인하기 ↗</a>
    </div>
  );
  return (
    <>
      {section.book && <div style={{fontSize:13,color:'#888',marginBottom:12}}>{section.book}</div>}
      <div style={{fontSize:15,lineHeight:1.9,color:'#333',whiteSpace:'pre-wrap'}}>{section.content}</div>
      <div style={{marginTop:16,textAlign:'center'}}>
        <a href={buildBibleUrl(todayKSTString())} target="_blank" rel="noopener noreferrer"
          style={{fontSize:12,color:'#aaa',textDecoration:'none'}}>가톨릭 굿뉴스 원문 보기 ↗</a>
      </div>
    </>
  );
};

const LibraryPage: React.FC = () => {
  const { prayers, addPrayer, updatePrayer, deletePrayer, toggleFavorite, todayList, setTodayList } = useAppContext();

  const [search,      setSearch]      = useState('');
  const [activeTab,   setActiveTab]   = useState<TabType>('전체');
  const [activeCat,   setActiveCat]   = useState('전체');
  const [detailPrayer,setDetailPrayer]= useState<StoredPrayer | null>(null);
  const [editPrayer,  setEditPrayer]  = useState<StoredPrayer | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [swipedId,    setSwipedId]    = useState<string | null>(null);

  const [formTitle,    setFormTitle]    = useState('');
  const [formContent,  setFormContent]  = useState('');
  const [formCategory, setFormCategory] = useState('주요기도');
  const [formCustomCat,setFormCustomCat]= useState('');

  const categories = useMemo(() =>
    ['전체', ...Array.from(new Set(prayers.map(p => p.category)))]
  , [prayers]);

  const filtered = useMemo(() => prayers.filter(p => {
    if (activeTab === '즐겨찾기' && !p.isFavorite) return false;
    if (activeCat !== '전체' && p.category !== activeCat) return false;
    if (search && !p.title.includes(search) && !p.content.includes(search)) return false;
    return true;
  }), [prayers, activeTab, activeCat, search]);

  // 모달 열림 시 배경 스크롤 잠금 + 뒤로가기 핸들러
  useEffect(() => {
    const isOpen = !!(detailPrayer || showAddForm);
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [detailPrayer, showAddForm]);

  useEffect(() => {
    if (!detailPrayer) return;
    return registerBackHandler(() => { setDetailPrayer(null); return true; });
  }, [detailPrayer]);

  useEffect(() => {
    if (!showAddForm) return;
    return registerBackHandler(() => { setShowAddForm(false); return true; });
  }, [showAddForm]);

  const openAdd = () => {
    setFormTitle(''); setFormContent(''); setFormCategory('주요기도'); setFormCustomCat('');
    setEditPrayer(null); setShowAddForm(true);
  };
  const openEdit = (p: StoredPrayer) => {
    const isCustom = !Object.keys(CATEGORY_COLORS).includes(p.category);
    setFormTitle(p.title); setFormContent(p.content);
    setFormCategory(isCustom ? '__custom__' : p.category);
    setFormCustomCat(isCustom ? p.category : '');
    setEditPrayer(p); setShowAddForm(true); setDetailPrayer(null); setSwipedId(null);
  };

  const saveForm = () => {
    if (!formTitle.trim() || !formContent.trim()) { alert('제목과 내용을 모두 입력해주세요.'); return; }
    const finalCat = formCategory === '__custom__' ? formCustomCat.trim() || '기타' : formCategory;
    if (editPrayer) {
      updatePrayer(editPrayer.id, { title: formTitle.trim(), content: formContent.trim(), category: finalCat });
    } else {
      addPrayer({ title: formTitle.trim(), content: formContent.trim(), category: finalCat, isFavorite: false, isDeleted: false });
    }
    setShowAddForm(false); setEditPrayer(null);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('이 기도문을 삭제할까요?')) return;
    deletePrayer(id); setSwipedId(null);
  };

  // ── 매일 성경 → 오늘 목록 추가 ──────────────────────────────────────
  const handleAddBibleToList = (bibleId: 'bible-reading' | 'bible-gospel') => {
    const alreadyExists = todayList.some(i => i.id === bibleId);
    if (alreadyExists) return;
    const newItem: TodayItem = {
      id:         bibleId,
      instanceId: `${bibleId}-${Date.now()}`,
      type:       'prayer',
      time:       '',
      days:       [],
    };
    setTodayList([...todayList, newItem]);
  };

  return (
    <div className="lib-page" onClick={() => swipedId && setSwipedId(null)}>
      {/* 헤더 */}
      <div className="lib-header">
        <div className="lib-header__title">기도문</div>
        <div className="lib-header__tabs">
          {(['전체', '즐겨찾기', '매일성경'] as TabType[]).map(t => (
            <button key={t}
              className={`lib-header__tab ${activeTab === t ? 'lib-header__tab--active' : ''}`}
              onClick={() => { setActiveTab(t); setActiveCat('전체'); }}
            >{t === '매일성경' ? '📖 매일성경' : t}</button>
          ))}
        </div>
      </div>

      {/* 매일 성경 탭 */}
      {activeTab === '매일성경' && (
        <BibleTab todayList={todayList} onAddToList={handleAddBibleToList} />
      )}

      {/* 기도문 탭 (전체 / 즐겨찾기) */}
      {activeTab !== '매일성경' && <>
      {/* 검색 */}
      <div className="lib-search">
        <span className="lib-search__icon">🔍</span>
        <input className="lib-search__input" placeholder="기도문 검색..." value={search}
          onChange={e => setSearch(e.target.value)} />
        {search && <button className="lib-search__clear" onClick={() => setSearch('')}>✕</button>}
      </div>

      {/* 카테고리 칩 */}
      <div className="lib-chips">
        {categories.map(c => (
          <button key={c}
            className={`lib-chip ${activeCat === c ? 'lib-chip--active' : ''}`}
            onClick={() => setActiveCat(c)}
          >{c}</button>
        ))}
      </div>

      {/* 목록 */}
      <div className="lib-list">
        {filtered.length === 0 ? (
          <div className="lib-empty">
            {search ? `"${search}" 검색 결과가 없습니다` : '기도문이 없습니다'}
          </div>
        ) : filtered.map(p => (
          <div key={p.id} className="lib-item-wrap">
            <div
              className={`lib-item ${swipedId === p.id ? 'lib-item--swiped' : ''}`}
              onClick={() => { if (swipedId === p.id) { setSwipedId(null); return; } setDetailPrayer(p); }}
            >
              <div className="lib-item__dot" style={{ background: catColor(p.category) }} />
              <div className="lib-item__text">
                <div className="lib-item__title">{p.title}</div>
                <div className="lib-item__preview">
                  {p.source === 'bible' ? '오늘 날짜의 가톨릭 독서를 불러옵니다' : p.content.replace(/\n/g, ' ').slice(0, 35) + '…'}
                </div>
                <span className="lib-item__badge"
                  style={{ background: catColor(p.category) + '22', color: catColor(p.category) }}>
                  {p.category}
                </span>
              </div>
              {p.source !== 'bible' && (
                <button className={`lib-item__star ${p.isFavorite ? 'lib-item__star--on' : ''}`}
                  onClick={e => { e.stopPropagation(); toggleFavorite(p.id); }}>★</button>
              )}
              {p.source !== 'bible' && (
                <button className="lib-item__more"
                  onClick={e => { e.stopPropagation(); setSwipedId(swipedId === p.id ? null : p.id); }}>⋮</button>
              )}
            </div>
            {swipedId === p.id && (
              <div className="lib-item__actions">
                <button className="lib-item__action-btn lib-item__action-btn--edit" onClick={() => openEdit(p)}>수정</button>
                <button className="lib-item__action-btn lib-item__action-btn--del"  onClick={() => handleDelete(p.id)}>삭제</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {activeTab !== '매일성경' && <button className="lib-fab" onClick={openAdd}>+</button>}
      </>}

      {/* 상세 보기 모달 */}
      {detailPrayer && (
        <div className="lib-modal-bg" onClick={() => setDetailPrayer(null)}>
          <div className="lib-modal" onClick={e => e.stopPropagation()}>
            <div className="lib-modal__header">
              <div>
                <div className="lib-modal__title">{detailPrayer.title}</div>
                <span className="lib-modal__badge"
                  style={{ background: catColor(detailPrayer.category) + '22', color: catColor(detailPrayer.category) }}>
                  {detailPrayer.category}
                </span>
              </div>
              <button className="lib-modal__close" onClick={() => setDetailPrayer(null)}>✕</button>
            </div>
            <div className="lib-modal__content">
              {detailPrayer.source === 'bible'
                ? <BibleDetailContent prayerId={detailPrayer.id} />
                : detailPrayer.content}
            </div>
            <div className="lib-modal__footer">
              {detailPrayer.source !== 'bible' && (
                <button className="lib-modal__btn lib-modal__btn--edit" onClick={() => openEdit(detailPrayer)}>수정</button>
              )}
              <button className="lib-modal__btn lib-modal__btn--close" onClick={() => setDetailPrayer(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 추가/수정 폼 모달 */}
      {showAddForm && (
        <div className="lib-modal-bg" onClick={() => setShowAddForm(false)}>
          <div className="lib-modal lib-modal--form" onClick={e => e.stopPropagation()}>
            <div className="lib-modal__header">
              <div className="lib-modal__title">{editPrayer ? '기도문 수정' : '새 기도문'}</div>
              <button className="lib-modal__close" onClick={() => setShowAddForm(false)}>✕</button>
            </div>
            <div className="lib-form">
              <label className="lib-form__label">제목 *</label>
              <input className="lib-form__input" placeholder="기도문 제목" value={formTitle}
                onChange={e => setFormTitle(e.target.value)} maxLength={50} />

              <label className="lib-form__label">카테고리 *</label>
              <select className="lib-form__select" value={formCategory}
                onChange={e => setFormCategory(e.target.value)}>
                {Object.keys(CATEGORY_COLORS).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="__custom__">+ 직접 입력</option>
              </select>
              {formCategory === '__custom__' && (
                <input className="lib-form__input" placeholder="새 카테고리 이름"
                  value={formCustomCat} onChange={e => setFormCustomCat(e.target.value)} maxLength={20} />
              )}

              <label className="lib-form__label">기도문 내용 *</label>
              <textarea className="lib-form__textarea" placeholder="기도문 내용을 입력하세요..." value={formContent}
                onChange={e => setFormContent(e.target.value)} rows={8} />
            </div>
            <div className="lib-modal__footer">
              <button className="lib-modal__btn lib-modal__btn--close" onClick={() => setShowAddForm(false)}>취소</button>
              <button className="lib-modal__btn lib-modal__btn--edit" onClick={saveForm}>
                {editPrayer ? '수정 완료' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryPage;