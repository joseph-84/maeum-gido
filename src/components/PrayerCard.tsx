// ============================================================
// components/PrayerCard.tsx — 기도문 카드 컴포넌트
// ============================================================
//
// 사용처:
//   - LibraryPage: 전체 기도문 리스트
//   - HomePage: 오늘의 기도 스케줄 리스트
//
// Props:
//   - prayer: 기도문 데이터
//   - isCompleted?: 오늘 완료 여부 (홈 화면용)
//   - onComplete?: 완료 버튼 핸들러 (홈 화면용)
//   - onToggleFavorite: 즐겨찾기 토글
//   - onEdit: 수정 모달 오픈
//   - onDelete: 삭제 (슬라이드 액션)
//   - onClick: 상세 보기
// ============================================================

import React, { useRef } from 'react';
import {
  IonItem,
  IonLabel,
  IonNote,
  IonBadge,
  IonIcon,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonRippleEffect,
} from '@ionic/react';
import {
  starOutline,
  star,
  checkmarkCircle,
  checkmarkCircleOutline,
  createOutline,
  trashOutline,
} from 'ionicons/icons';
import { Prayer } from '../types';
import './PrayerCard.css';

// ─── 카테고리별 색상 매핑 ───────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  기본기도: '#4A9B6F',
  아침기도: '#E8963A',
  저녁기도: '#7B68EE',
  묵주기도: '#E86B5E',
  성체성사: '#3A9BE8',
  감사기도: '#F0C040',
  고해기도: '#A0522D',
  default:  '#8A8A8E',
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.default;
}

// ─── Props ──────────────────────────────────────────────────
interface PrayerCardProps {
  prayer: Prayer;
  isCompleted?: boolean;
  onComplete?: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onEdit: (prayer: Prayer) => void;
  onDelete: (id: string) => void;
  onClick: (prayer: Prayer) => void;
  /** 홈 화면 모드: 완료 체크 버튼을 우측에 표시 */
  homeMode?: boolean;
}

// ─── 컴포넌트 ───────────────────────────────────────────────
const PrayerCard: React.FC<PrayerCardProps> = ({
  prayer,
  isCompleted = false,
  onComplete,
  onToggleFavorite,
  onEdit,
  onDelete,
  onClick,
  homeMode = false,
}) => {
  const slidingRef = useRef<HTMLIonItemSlidingElement>(null);

  const categoryColor = getCategoryColor(prayer.category);

  // 슬라이드 액션 후 닫기
  const closeSliding = () => slidingRef.current?.close();

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeSliding();
    onEdit(prayer);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeSliding();
    onDelete(prayer.id);
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(prayer.id);
  };

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onComplete?.(prayer.id);
  };

  return (
    <IonItemSliding ref={slidingRef} className="prayer-card-sliding">
      {/* ── 좌측 슬라이드: 수정 ── */}
      <IonItemOptions side="start" onIonSwipe={handleEdit}>
        <IonItemOption color="primary" expandable onClick={handleEdit}>
          <IonIcon slot="icon-only" icon={createOutline} />
        </IonItemOption>
      </IonItemOptions>

      {/* ── 메인 아이템 ── */}
      <IonItem
        className={`prayer-card-item ${isCompleted ? 'prayer-card--completed' : ''}`}
        detail={false}
        button
        onClick={() => onClick(prayer)}
      >
        {/* 카테고리 색상 인디케이터 */}
        <div
          slot="start"
          className="prayer-card__color-dot"
          style={{ backgroundColor: categoryColor }}
          aria-hidden="true"
        />

        <IonLabel className="prayer-card__label">
          <h2 className={`prayer-card__title ${isCompleted ? 'prayer-card__title--done' : ''}`}>
            {prayer.title}
          </h2>
          <IonNote className="prayer-card__preview" color="medium">
            {prayer.content.slice(0, 40)}
            {prayer.content.length > 40 ? '…' : ''}
          </IonNote>
          <div className="prayer-card__meta">
            <IonBadge
              className="prayer-card__badge"
              style={{
                '--background': categoryColor + '22',
                '--color': categoryColor,
              } as React.CSSProperties}
            >
              {prayer.category}
            </IonBadge>
            {prayer.source === 'user' && (
              <IonBadge className="prayer-card__badge prayer-card__badge--user">
                내 기도
              </IonBadge>
            )}
          </div>
        </IonLabel>

        {/* 우측 액션 버튼 영역 */}
        <div slot="end" className="prayer-card__actions">
          {homeMode ? (
            /* 홈 모드: 완료 체크 버튼 */
            <button
              className={`prayer-card__check-btn ${isCompleted ? 'prayer-card__check-btn--done' : ''}`}
              onClick={handleComplete}
              aria-label={isCompleted ? '완료됨' : '완료 표시'}
            >
              <IonIcon
                icon={isCompleted ? checkmarkCircle : checkmarkCircleOutline}
                className="prayer-card__check-icon"
              />
              <IonRippleEffect />
            </button>
          ) : (
            /* 라이브러리 모드: 즐겨찾기 버튼 */
            <button
              className={`prayer-card__star-btn ${prayer.isFavorite ? 'prayer-card__star-btn--active' : ''}`}
              onClick={handleFavorite}
              aria-label={prayer.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            >
              <IonIcon icon={prayer.isFavorite ? star : starOutline} />
              <IonRippleEffect />
            </button>
          )}
        </div>
      </IonItem>

      {/* ── 우측 슬라이드: 삭제 ── */}
      <IonItemOptions side="end" onIonSwipe={handleDelete}>
        <IonItemOption color="danger" expandable onClick={handleDelete}>
          <IonIcon slot="icon-only" icon={trashOutline} />
        </IonItemOption>
      </IonItemOptions>
    </IonItemSliding>
  );
};

export default PrayerCard;
