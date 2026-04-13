import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppData';
import { StoredPrayer } from '../../utils/storage';
import './LibraryPage.css';

const CATEGORY_COLORS: Record<string, string> = {
  '주요기도': '#4A9B6F', '묵주기도': '#E86B5E', '고해성사': '#A0522D',
  '성체성사': '#3A9BE8', '호칭기도': '#7B68EE', '여러가지기도': '#E8963A',
  '레지오마리애': '#9B4A9B',
};
function catColor(cat: string) { return CATEGORY_COLORS[cat] ?? '#8A8A8E'; }

type TabType = '전체' | '즐겨찾기';

const LibraryPage: React.FC = () => {
  const { prayers, addPrayer, updatePrayer, deletePrayer, toggleFavorite } = useAppContext();

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

  return (
    <div className="lib-page" onClick={() => swipedId && setSwipedId(null)}>
      {/* 헤더 */}
      <div className="lib-header">
        <div className="lib-header__title">기도문</div>
        <div className="lib-header__tabs">
          {(['전체', '즐겨찾기'] as TabType[]).map(t => (
            <button key={t}
              className={`lib-header__tab ${activeTab === t ? 'lib-header__tab--active' : ''}`}
              onClick={() => { setActiveTab(t); setActiveCat('전체'); }}
            >{t}</button>
          ))}
        </div>
      </div>

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
                <div className="lib-item__preview">{p.content.replace(/\n/g, ' ').slice(0, 35)}…</div>
                <span className="lib-item__badge"
                  style={{ background: catColor(p.category) + '22', color: catColor(p.category) }}>
                  {p.category}
                </span>
              </div>
              <button className={`lib-item__star ${p.isFavorite ? 'lib-item__star--on' : ''}`}
                onClick={e => { e.stopPropagation(); toggleFavorite(p.id); }}>★</button>
              <button className="lib-item__more"
                onClick={e => { e.stopPropagation(); setSwipedId(swipedId === p.id ? null : p.id); }}>⋮</button>
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

      <button className="lib-fab" onClick={openAdd}>+</button>

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
            <div className="lib-modal__content" style={{ whiteSpace: 'pre-wrap' }}>
              {detailPrayer.content}
            </div>
            <div className="lib-modal__footer">
              <button className="lib-modal__btn lib-modal__btn--edit" onClick={() => openEdit(detailPrayer)}>수정</button>
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