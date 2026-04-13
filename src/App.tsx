import React, { useState } from 'react';
import { AppContext, useAppData } from './hooks/useAppData';
import { useNotify } from './hooks/useNotify';
import HomePage     from './pages/Home/HomePage';
import LibraryPage  from './pages/Library/LibraryPage';
import GroupsPage   from './pages/Groups/GroupsPage';
import SettingsPage from './pages/Settings/SettingsPage';
import './App.css';

type Tab = 'home' | 'library' | 'groups' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home',     label: '홈',    icon: '🏠' },
  { id: 'library',  label: '기도문', icon: '📖' },
  { id: 'groups',   label: '그룹',   icon: '🗂️' },
  { id: 'settings', label: '설정',   icon: '⚙️' },
];

const App: React.FC = () => {
  const appData = useAppData();
  const [tab, setTab] = useState<Tab>('home');

  // 알림: todayList 항목의 제목을 가져오는 함수
  const getTitle = (item: { id: string; type: 'prayer' | 'group' }) => {
    if (item.type === 'prayer') {
      return appData.prayers.find(p => p.id === item.id)?.title ?? '기도';
    }
    return appData.groups.find(g => g.id === item.id)?.name ?? '기도 그룹';
  };
  useNotify(appData.todayList, getTitle);

  if (appData.isLoading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:16 }}>
        <div style={{ fontSize:48 }}>🙏</div>
        <div style={{ fontSize:18, color:'#2D5016' }}>마음의 기도</div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={appData}>
      <div style={{ maxWidth:480, margin:'0 auto', position:'relative', minHeight:'100vh' }}>
        {tab === 'home'     && <HomePage />}
        {tab === 'library'  && <LibraryPage />}
        {tab === 'groups'   && <GroupsPage />}
        {tab === 'settings' && <SettingsPage />}

        <nav style={{
          position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
          width:'100%', maxWidth:480,
          background:'#fff', borderTop:'0.5px solid rgba(0,0,0,0.1)',
          display:'flex', height:60, zIndex:50,
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex:1, border:'none', background:'none', cursor:'pointer',
              display:'flex', flexDirection:'column', alignItems:'center',
              justifyContent:'center', gap:2,
              color: tab === t.id ? '#2D5016' : '#aaa',
              fontSize:10, fontFamily:'Noto Sans KR, sans-serif',
            }}>
              <span style={{ fontSize:20 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </AppContext.Provider>
  );
};

export default App;