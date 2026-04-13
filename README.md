# 마음의 기도 — 프로젝트 폴더 구조

```
maeum-gido/
├── android/                     # Capacitor Android 네이티브
│   └── app/src/main/...
│
├── public/
│   └── index.html
│
├── src/
│   ├── assets/
│   │   └── prayers.json         ★ 기본 기도문 데이터 (static)
│   │
│   ├── types/
│   │   └── index.ts             ★ Prayer, PrayerGroup, Schedule 등 타입
│   │
│   ├── utils/
│   │   └── dataManager.ts       ★ 병합 로직 순수 함수 모음
│   │
│   ├── hooks/
│   │   ├── usePrayers.ts        ★ 핵심 데이터 훅 (CRUD + 병합)
│   │   └── useNotifications.ts  # Capacitor LocalNotifications 래퍼
│   │
│   ├── pages/
│   │   ├── Home/
│   │   │   ├── HomePage.tsx     # 오늘의 기도 스케줄 + 완료 체크
│   │   │   └── HomePage.css
│   │   ├── Library/
│   │   │   ├── LibraryPage.tsx  # 전체 기도문 + 카테고리 필터 + 즐겨찾기
│   │   │   └── LibraryPage.css
│   │   ├── Groups/
│   │   │   ├── GroupsPage.tsx   # 기도 그룹 목록 + 편집
│   │   │   └── GroupsPage.css
│   │   └── Settings/
│   │       ├── SettingsPage.tsx # JSON 가져오기, 알림 설정
│   │       └── SettingsPage.css
│   │
│   ├── components/
│   │   ├── PrayerCard.tsx       # 기도문 카드 (즐겨찾기 토글, 완료 버튼)
│   │   ├── GroupCard.tsx        # 그룹 카드
│   │   ├── PrayerDetail.tsx     # 기도문 상세 모달
│   │   ├── AddPrayerModal.tsx   # 기도문 추가/수정 폼
│   │   ├── AddGroupModal.tsx    # 그룹 생성 폼
│   │   └── CalendarView.tsx     # 완료 기록 달력
│   │
│   ├── App.tsx                  # IonApp + IonTabBar 라우팅
│   ├── App.css
│   └── main.tsx
│
├── capacitor.config.ts          # appId, webDir, plugins 설정
├── ionic.config.json
├── package.json
└── README.md
```

## 데이터 흐름 요약

```
앱 시작
  ↓
[usePrayers] useEffect
  ↓
loadPrayers(staticPrayers)
  ├─ staticPrayers  ← import('../assets/prayers.json')
  └─ localPrayers   ← Capacitor Preferences.get('maeum_prayers')
  ↓
mergePrayers(static, local)
  ├─ ID 충돌 → updatedAt 최신 우선
  ├─ local 전용 → 유지 (사용자 추가)
  └─ isDeleted:true → merged에는 포함, UI 노출 제외
  ↓
setState(mergedPrayers)  → 화면 렌더링
```

## 핵심 패키지

| 패키지 | 용도 |
|---|---|
| `@ionic/react` | UI 컴포넌트 (IonList, IonCard, IonFab 등) |
| `@capacitor/core` | 네이티브 브릿지 |
| `@capacitor/preferences` | 로컬 key-value 저장소 |
| `@capacitor/local-notifications` | 기도 알림 |
| `react-beautiful-dnd` | 그룹 내 기도 순서 드래그 |

## 시작 명령어

```bash
npm install
npm run build
npx cap sync android
npx cap open android
```
