// ============================================================
// App.tsx — 마음의 기도 앱 루트 컴포넌트
// ============================================================
//
// 구조:
//   IonApp
//   └── IonReactRouter
//       └── IonTabs
//           ├── IonRouterOutlet   (각 페이지 Route)
//           │   ├── /home         → HomePage
//           │   ├── /library      → LibraryPage
//           │   ├── /groups       → GroupsPage
//           │   └── /settings     → SettingsPage
//           └── IonTabBar         (하단 탭 바)
//
// 앱 전역:
//   - usePrayers 훅을 최상위에서 한 번만 초기화 → Context로 배포
//   - useNotifications 훅으로 앱 시작 시 알림 재등록
//   - 앱 포그라운드 복귀 시 스케줄 재확인 (App 플러그인 이용)
// ============================================================

import React, { useEffect } from 'react';
import { Redirect, Route, useLocation } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import {
  homeOutline,
  home,
  bookOutline,
  book,
  folderOutline,
  folder,
  settingsOutline,
  settings,
} from 'ionicons/icons';
import { App as CapacitorApp } from '@capacitor/app';

/* ── 페이지 컴포넌트 (lazy load로 초기 번들 최적화) ── */
import { lazy, Suspense } from 'react';
const HomePage     = lazy(() => import('./pages/Home/HomePage'));
const LibraryPage  = lazy(() => import('./pages/Library/LibraryPage'));
const GroupsPage   = lazy(() => import('./pages/Groups/GroupsPage'));
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage'));

/* ── 훅 ── */
import { useAppData, AppContext } from './hooks/useAppData';
import { useNotifications } from './hooks/useNotifications';
import { handleBackPress, hasOpenModal } from './utils/backHandler';

/* ── Ionic + Capacitor 스타일 ── */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import './theme/variables.css'; // Ionic 테마 변수 (아래 참조)
import './App.css';

setupIonicReact({ mode: 'md' }); // Android는 Material Design 모드


// ─── 로딩 스크린 ────────────────────────────────────────────
const SplashFallback: React.FC = () => (
  <div className="app-splash">
    <div className="app-splash__cross" aria-hidden="true">✝</div>
    <p className="app-splash__text">마음의 기도</p>
  </div>
);

// ─── 탭 레이아웃 (useLocation은 Router 내부에서만 사용 가능) ──
const AppTabs: React.FC = () => {
  const location = useLocation();
  const path = location.pathname;

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Suspense fallback={<SplashFallback />}>
          <Route exact path="/home"><HomePage /></Route>
          <Route exact path="/library"><LibraryPage /></Route>
          <Route exact path="/groups"><GroupsPage /></Route>
          <Route exact path="/settings"><SettingsPage /></Route>
          <Route exact path="/"><Redirect to="/home" /></Route>
        </Suspense>
      </IonRouterOutlet>

      <IonTabBar slot="bottom" className="app-tab-bar">
        <IonTabButton tab="home" href="/home" className="app-tab-btn">
          <IonIcon icon={path === '/home' ? home : homeOutline} />
          <IonLabel>홈</IonLabel>
        </IonTabButton>
        <IonTabButton tab="library" href="/library" className="app-tab-btn">
          <IonIcon icon={path === '/library' ? book : bookOutline} />
          <IonLabel>기도문</IonLabel>
        </IonTabButton>
        <IonTabButton tab="groups" href="/groups" className="app-tab-btn">
          <IonIcon icon={path === '/groups' ? folder : folderOutline} />
          <IonLabel>그룹</IonLabel>
        </IonTabButton>
        <IonTabButton tab="settings" href="/settings" className="app-tab-btn">
          <IonIcon icon={path === '/settings' ? settings : settingsOutline} />
          <IonLabel>설정</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
};

// ─── 앱 본체 ────────────────────────────────────────────────
const App: React.FC = () => {
  const appData = useAppData();
  const { rescheduleAll } = useNotifications();

  // ── 앱 시작 시 알림 재등록 ──────────────────────────────
  useEffect(() => {
    if (appData.isLoading) return;
    rescheduleAll([], () => '기도').catch(console.error);
  }, [appData.isLoading]); // 초기 로드 완료 시 1회 실행

  // ── 앱 포그라운드 복귀 시 스케줄 상태 갱신 ──────────────
  useEffect(() => {
    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        // 포그라운드 복귀: 필요 시 완료 기록 갱신 등 처리 가능
        console.info('[App] 앱 포그라운드 복귀');
      }
    });
    return () => { listener.then((l) => l.remove()); };
  }, []);

  // ── 안드로이드 백 버튼 처리 ─────────────────────────────
  useEffect(() => {
    const listener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      // 모달이 열려 있으면 모달 닫기 우선
      if (hasOpenModal()) {
        handleBackPress();
        return;
      }
      if (!canGoBack) {
        CapacitorApp.exitApp();
      }
    });
    return () => { listener.then((l) => l.remove()); };
  }, []);

  return (
    <AppContext.Provider value={appData}>
      <IonApp>
        <IonReactRouter>
          <AppTabs />
        </IonReactRouter>
      </IonApp>
    </AppContext.Provider>
  );
};

export default App;