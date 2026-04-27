// ============================================================
// utils/backHandler.ts — 뒤로가기 핸들러 전역 등록소
// ============================================================
// App.tsx에서 import하면 순환 참조가 생길 수 있으므로 별도 파일로 분리

type BackHandlerFn = () => boolean; // true 반환 시 앱 종료 방지

const handlers: BackHandlerFn[] = [];

/** 모달이 열릴 때 호출 — 반환값(cleanup)을 useEffect return에 연결 */
export function registerBackHandler(fn: BackHandlerFn): () => void {
  handlers.push(fn);
  return () => {
    const i = handlers.lastIndexOf(fn);
    if (i > -1) handlers.splice(i, 1);
  };
}

/** Android에서 app-back-press 이벤트 수신 시 호출 */
export function handleBackPress(): void {
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i]()) return; // 모달이 닫혔으면 종료 방지
  }
}

/** 열린 모달이 있는지 여부 */
export function hasOpenModal(): boolean {
  return handlers.length > 0;
}
