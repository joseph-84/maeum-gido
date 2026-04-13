import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppData';
import './GroupsPage.css';

const GROUP_COLORS = ['#4A9B6F','#E8963A','#7B68EE','#E86B5E','#3A9BE8','#C4A24A','#9B4A9B','#2D5016'];

const CAT_COLORS: Record<string,string> = {
  '주요기도':'#4A9B6F','묵주기도':'#E86B5E','고해성사':'#A0522D',
  '성체성사':'#3A9BE8','호칭기도':'#7B68EE','여러가지기도':'#E8963A','레지오마리애':'#9B4A9B',
};
function catColor(cat:string){ return CAT_COLORS[cat]??'#8A8A8E'; }

const GroupsPage: React.FC = () => {
  const { prayers, groups, addGroup, updateGroup, deleteGroup } = useAppContext();

  const [expandedId,setExpandedId]   = useState<string|null>(null);
  const [showForm,setShowForm]       = useState(false);
  const [editId,setEditId]           = useState<string|null>(null);
  const [formName,setFormName]       = useState('');
  const [formDesc,setFormDesc]       = useState('');
  const [formColor,setFormColor]     = useState(GROUP_COLORS[0]);
  const [formPrayers,setFormPrayers] = useState<string[]>([]);
  const [search,setSearch]           = useState('');

  const getPrayer = (id:string) => prayers.find(p=>p.id===id);

  const openAdd = () => {
    setFormName('');setFormDesc('');setFormColor(GROUP_COLORS[0]);setFormPrayers([]);
    setEditId(null);setShowForm(true);
  };
  const openEdit = (id:string) => {
    const g=groups.find(x=>x.id===id);
    if(!g) return;
    setFormName(g.name);setFormDesc(g.description);setFormColor(g.color);setFormPrayers([...g.prayerIds]);
    setEditId(id);setShowForm(true);setExpandedId(null);
  };

  const saveForm = () => {
    if(!formName.trim()){ alert('그룹 이름을 입력해주세요.'); return; }
    if(formPrayers.length===0){ alert('기도문을 하나 이상 선택해주세요.'); return; }
    if(editId){
      updateGroup(editId,{name:formName.trim(),description:formDesc.trim(),color:formColor,prayerIds:formPrayers});
    } else {
      addGroup({name:formName.trim(),description:formDesc.trim(),color:formColor,prayerIds:formPrayers,isDeleted:false});
    }
    setShowForm(false);setEditId(null);
  };

  const handleDelete = (id:string) => {
    if(!window.confirm('이 그룹을 삭제할까요?')) return;
    deleteGroup(id);setExpandedId(null);
  };

  const togglePicker = (id:string) => {
    setFormPrayers(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  };
  const moveUp=(idx:number)=>setFormPrayers(prev=>{const a=[...prev];if(idx===0)return a;[a[idx-1],a[idx]]=[a[idx],a[idx-1]];return a;});
  const moveDown=(idx:number)=>setFormPrayers(prev=>{const a=[...prev];if(idx===a.length-1)return a;[a[idx],a[idx+1]]=[a[idx+1],a[idx]];return a;});

  const moveGroupUp=(id:string)=>{ /* 그룹 순서는 추후 */ };

  const filteredPrayers=useMemo(()=>
    prayers.filter(p=>p.title.includes(search)||p.category.includes(search))
  ,[prayers,search]);

  return (
    <div className="grp-page">
      <div className="grp-header">
        <div className="grp-header__title">기도 그룹</div>
        <div className="grp-header__sub">나만의 기도 순서 묶음</div>
      </div>

      <div className="grp-list">
        {groups.length===0&&(
          <div className="grp-empty">
            <div className="grp-empty__icon">🗂️</div>
            <div>아직 그룹이 없어요</div>
            <div style={{fontSize:12,color:'#bbb',marginTop:4}}>+ 버튼으로 그룹을 만들어보세요</div>
          </div>
        )}
        {groups.map(g=>{
          const isExp=expandedId===g.id;
          return(
            <div key={g.id} className="grp-card">
              <div className="grp-card__header" onClick={()=>setExpandedId(isExp?null:g.id)}>
                <div className="grp-card__color-dot" style={{background:g.color}}/>
                <div className="grp-card__info">
                  <div className="grp-card__name">{g.name}</div>
                  {g.description&&<div className="grp-card__desc">{g.description}</div>}
                </div>
                <div className="grp-card__count">{g.prayerIds.length}개</div>
                <div className="grp-card__arrow">{isExp?'⌄':'›'}</div>
              </div>
              {isExp&&(
                <div className="grp-card__body">
                  <div className="grp-card__prayers">
                    {g.prayerIds.map((pid,idx)=>{
                      const p=getPrayer(pid);
                      if(!p) return null;
                      return(
                        <div key={pid} className="grp-prayer-row">
                          <div className="grp-prayer-row__num">{idx+1}</div>
                          <div className="grp-prayer-row__dot" style={{background:catColor(p.category)}}/>
                          <div className="grp-prayer-row__title">{p.title}</div>
                          <div className="grp-prayer-row__moves">
                            <button className="grp-prayer-row__move-btn"
                              onClick={()=>updateGroup(g.id,{prayerIds:g.prayerIds.map((_,i)=>i===idx-1?g.prayerIds[idx]:i===idx?g.prayerIds[idx-1]:g.prayerIds[i]).filter((_,i)=>i<g.prayerIds.length)})}
                              disabled={idx===0}>↑</button>
                            <button className="grp-prayer-row__move-btn"
                              onClick={()=>updateGroup(g.id,{prayerIds:g.prayerIds.map((_,i)=>i===idx?g.prayerIds[idx+1]:i===idx+1?g.prayerIds[idx]:g.prayerIds[i]).filter((_,i)=>i<g.prayerIds.length)})}
                              disabled={idx===g.prayerIds.length-1}>↓</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grp-card__actions">
                    <button className="grp-card__btn grp-card__btn--edit"   onClick={()=>openEdit(g.id)}>수정</button>
                    <button className="grp-card__btn grp-card__btn--delete" onClick={()=>handleDelete(g.id)}>삭제</button>
                    <button className="grp-card__btn grp-card__btn--start"  onClick={()=>alert(`"${g.name}" 기도를 시작합니다.`)}>기도 시작</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="grp-fab" onClick={openAdd}>+</button>

      {/* 그룹 추가/수정 모달 */}
      {showForm&&(
        <div className="grp-modal-bg" onClick={()=>setShowForm(false)}>
          <div className="grp-modal" onClick={e=>e.stopPropagation()}>
            <div className="grp-modal__handle"/>
            <div className="grp-modal__header">
              <div className="grp-modal__title">{editId?'그룹 수정':'새 그룹'}</div>
              <button className="grp-modal__close" onClick={()=>setShowForm(false)}>✕</button>
            </div>

            <div className="grp-form">
              <label className="grp-form__label">그룹 이름 *</label>
              <input className="grp-form__input" placeholder="예) 아침기도 루틴" value={formName} onChange={e=>setFormName(e.target.value)} maxLength={30}/>

              <label className="grp-form__label">설명</label>
              <input className="grp-form__input" placeholder="그룹 설명 (선택)" value={formDesc} onChange={e=>setFormDesc(e.target.value)} maxLength={50}/>

              <label className="grp-form__label">그룹 색상</label>
              <div className="grp-form__colors">
                {GROUP_COLORS.map(c=>(
                  <button key={c} className={`grp-form__color-btn ${formColor===c?'grp-form__color-btn--active':''}`} style={{background:c}} onClick={()=>setFormColor(c)}/>
                ))}
              </div>

              <label className="grp-form__label">기도문 선택 * ({formPrayers.length}개)</label>

              {/* 검색 */}
              <div className="grp-form__search">
                <span>🔍</span>
                <input className="grp-form__search-input" placeholder="기도문 검색..." value={search} onChange={e=>setSearch(e.target.value)}/>
                {search&&<button className="grp-form__search-clear" onClick={()=>setSearch('')}>✕</button>}
              </div>

              <div className="grp-form__prayer-list">
                {filteredPrayers.length===0
                  ?<div style={{textAlign:'center',padding:'16px',color:'#bbb',fontSize:13}}>검색 결과 없음</div>
                  :filteredPrayers.map(p=>{
                    const sel=formPrayers.includes(p.id);
                    const order=formPrayers.indexOf(p.id)+1;
                    return(
                      <button key={p.id} className={`grp-form__prayer-item ${sel?'grp-form__prayer-item--selected':''}`} onClick={()=>togglePicker(p.id)}>
                        <div className="grp-form__prayer-dot" style={{background:catColor(p.category)}}/>
                        <div className="grp-form__prayer-info">
                          <span className="grp-form__prayer-title">{p.title}</span>
                          <span className="grp-form__prayer-cat">{p.category}</span>
                        </div>
                        {sel&&<span className="grp-form__prayer-order">{order}</span>}
                      </button>
                    );
                  })
                }
              </div>

              {formPrayers.length>0&&(
                <div className="grp-form__preview">
                  <div className="grp-form__preview-label">순서 미리보기</div>
                  {formPrayers.map((pid,idx)=>{
                    const p=getPrayer(pid);
                    if(!p) return null;
                    return(
                      <div key={pid} className="grp-form__preview-row">
                        <span className="grp-form__preview-num">{idx+1}</span>
                        <span className="grp-form__preview-title">{p.title}</span>
                        <div className="grp-form__preview-moves">
                          <button className="grp-form__order-btn" disabled={idx===0} onClick={()=>moveUp(idx)}>↑</button>
                          <button className="grp-form__order-btn" disabled={idx===formPrayers.length-1} onClick={()=>moveDown(idx)}>↓</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grp-modal__footer">
              <button className="grp-modal__btn grp-modal__btn--cancel" onClick={()=>setShowForm(false)}>취소</button>
              <button className="grp-modal__btn grp-modal__btn--save" onClick={saveForm}>{editId?'수정 완료':'그룹 만들기'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupsPage;