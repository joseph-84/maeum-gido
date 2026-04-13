// ============================================================
// components/AddPrayerModal.tsx — 기도문 추가 / 수정 모달
// ============================================================
//
// 기능:
//   - 새 기도문 추가 (prayer prop 없을 때)
//   - 기존 기도문 수정 (prayer prop 있을 때)
//   - 카테고리 직접 입력 또는 기존 카테고리 선택
//   - 유효성 검사 (제목/내용 필수)
//
// 사용 예:
//   <AddPrayerModal
//     isOpen={showModal}
//     prayer={editingPrayer}        // undefined = 추가 모드
//     categories={['기본기도', ...]}
//     onSave={(data) => addPrayer(data)}
//     onDismiss={() => setShowModal(false)}
//   />
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonNote,
  IonIcon,
  IonSpinner,
  IonToast,
} from '@ionic/react';
import { closeOutline, saveOutline } from 'ionicons/icons';
import { Prayer } from '../types';
import './AddPrayerModal.css';

// ─── 기본 카테고리 목록 ─────────────────────────────────────
const DEFAULT_CATEGORIES = [
  '기본기도',
  '아침기도',
  '저녁기도',
  '묵주기도',
  '성체성사',
  '감사기도',
  '고해기도',
  '기타',
];

const NEW_CATEGORY_VALUE = '__new__';

// ─── Props ──────────────────────────────────────────────────
interface AddPrayerModalProps {
  isOpen: boolean;
  /** undefined = 추가 모드 / Prayer = 수정 모드 */
  prayer?: Prayer;
  /** 사용자가 이미 만든 카테고리 목록 (중복 제거하여 전달) */
  categories?: string[];
  onSave: (
    data: Omit<Prayer, 'id' | 'source' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onDismiss: () => void;
}

// ─── 폼 상태 타입 ───────────────────────────────────────────
interface FormState {
  title: string;
  content: string;
  category: string;
  customCategory: string;
  isFavorite: boolean;
}

const EMPTY_FORM: FormState = {
  title: '',
  content: '',
  category: '기본기도',
  customCategory: '',
  isFavorite: false,
};

// ─── 컴포넌트 ───────────────────────────────────────────────
const AddPrayerModal: React.FC<AddPrayerModalProps> = ({
  isOpen,
  prayer,
  categories = [],
  onSave,
  onDismiss,
}) => {
  const isEditMode = Boolean(prayer);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; color: string }>({
    show: false, message: '', color: 'success',
  });

  // 수정 모드: 기존 prayer 데이터로 폼 초기화
  useEffect(() => {
    if (isOpen) {
      if (prayer) {
        const isCustomCat =
          !DEFAULT_CATEGORIES.includes(prayer.category) &&
          !categories.includes(prayer.category);
        setForm({
          title: prayer.title,
          content: prayer.content,
          category: isCustomCat ? NEW_CATEGORY_VALUE : prayer.category,
          customCategory: isCustomCat ? prayer.category : '',
          isFavorite: prayer.isFavorite,
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setErrors({});
    }
  }, [isOpen, prayer]);

  // ── 유효성 검사 ────────────────────────────────────────────
  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!form.title.trim()) newErrors.title = '제목을 입력해주세요.';
    if (form.title.trim().length > 50) newErrors.title = '제목은 50자 이내로 입력해주세요.';
    if (!form.content.trim()) newErrors.content = '기도문 내용을 입력해주세요.';
    if (form.category === NEW_CATEGORY_VALUE && !form.customCategory.trim()) {
      newErrors.customCategory = '새 카테고리 이름을 입력해주세요.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── 저장 ───────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      const finalCategory =
        form.category === NEW_CATEGORY_VALUE
          ? form.customCategory.trim()
          : form.category;

      await onSave({
        title: form.title.trim(),
        content: form.content.trim(),
        category: finalCategory,
        isFavorite: form.isFavorite,
        isDeleted: false,
      });

      setToast({
        show: true,
        message: isEditMode ? '기도문이 수정되었습니다.' : '새 기도문이 추가되었습니다.',
        color: 'success',
      });

      // 짧은 딜레이 후 모달 닫기 (토스트가 보이도록)
      setTimeout(() => onDismiss(), 600);
    } catch (e) {
      setToast({ show: true, message: '저장 중 오류가 발생했습니다.', color: 'danger' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── 카테고리 옵션 (기본 + 사용자 정의 + 직접 입력) ────────
  const allCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...categories]));

  // ── 폼 필드 업데이트 헬퍼 ─────────────────────────────────
  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  return (
    <>
      <IonModal
        isOpen={isOpen}
        onDidDismiss={onDismiss}
        className="add-prayer-modal"
        breakpoints={[0, 0.95]}
        initialBreakpoint={0.95}
      >
        {/* ── 헤더 ── */}
        <IonHeader className="ion-no-border">
          <IonToolbar className="add-prayer-modal__toolbar">
            <IonButtons slot="start">
              <IonButton
                fill="clear"
                onClick={onDismiss}
                disabled={isSaving}
                aria-label="닫기"
              >
                <IonIcon icon={closeOutline} slot="icon-only" />
              </IonButton>
            </IonButtons>

            <IonTitle className="add-prayer-modal__title">
              {isEditMode ? '기도문 수정' : '새 기도문'}
            </IonTitle>

            <IonButtons slot="end">
              <IonButton
                fill="solid"
                className="add-prayer-modal__save-btn"
                onClick={handleSave}
                disabled={isSaving}
                aria-label="저장"
              >
                {isSaving ? (
                  <IonSpinner name="crescent" />
                ) : (
                  <>
                    <IonIcon icon={saveOutline} slot="start" />
                    저장
                  </>
                )}
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        {/* ── 바디 ── */}
        <IonContent className="add-prayer-modal__content">
          <IonList lines="full" className="add-prayer-modal__list">

            {/* 제목 */}
            <IonItem className={errors.title ? 'ion-invalid' : ''}>
              <IonLabel position="stacked" className="add-prayer-modal__field-label">
                기도문 제목 <span className="required">*</span>
              </IonLabel>
              <IonInput
                value={form.title}
                onIonInput={(e) => updateField('title', e.detail.value ?? '')}
                placeholder="예) 아침 봉헌 기도"
                maxlength={50}
                clearInput
                className="add-prayer-modal__input"
              />
              {errors.title && (
                <IonNote slot="error">{errors.title}</IonNote>
              )}
              <IonNote slot="helper" className="add-prayer-modal__char-count">
                {form.title.length} / 50
              </IonNote>
            </IonItem>

            {/* 카테고리 */}
            <IonItem>
              <IonLabel position="stacked" className="add-prayer-modal__field-label">
                카테고리 <span className="required">*</span>
              </IonLabel>
              <IonSelect
                value={form.category}
                onIonChange={(e) => updateField('category', e.detail.value)}
                interface="action-sheet"
                interfaceOptions={{ header: '카테고리 선택' }}
                placeholder="카테고리 선택"
                className="add-prayer-modal__select"
              >
                {allCategories.map((cat) => (
                  <IonSelectOption key={cat} value={cat}>
                    {cat}
                  </IonSelectOption>
                ))}
                <IonSelectOption value={NEW_CATEGORY_VALUE}>
                  + 새 카테고리 추가
                </IonSelectOption>
              </IonSelect>
            </IonItem>

            {/* 새 카테고리 직접 입력 (조건부) */}
            {form.category === NEW_CATEGORY_VALUE && (
              <IonItem className={errors.customCategory ? 'ion-invalid' : ''}>
                <IonLabel position="stacked" className="add-prayer-modal__field-label">
                  새 카테고리 이름 <span className="required">*</span>
                </IonLabel>
                <IonInput
                  value={form.customCategory}
                  onIonInput={(e) => updateField('customCategory', e.detail.value ?? '')}
                  placeholder="예) 본당 기도"
                  maxlength={20}
                  clearInput
                />
                {errors.customCategory && (
                  <IonNote slot="error">{errors.customCategory}</IonNote>
                )}
              </IonItem>
            )}

            {/* 기도문 본문 */}
            <IonItem
              className={`add-prayer-modal__content-item ${errors.content ? 'ion-invalid' : ''}`}
            >
              <IonLabel position="stacked" className="add-prayer-modal__field-label">
                기도문 내용 <span className="required">*</span>
              </IonLabel>
              <IonTextarea
                value={form.content}
                onIonInput={(e) => updateField('content', e.detail.value ?? '')}
                placeholder="기도문 본문을 입력해주세요..."
                autoGrow
                rows={8}
                className="add-prayer-modal__textarea"
              />
              {errors.content && (
                <IonNote slot="error">{errors.content}</IonNote>
              )}
            </IonItem>

            {/* 즐겨찾기 초기값 */}
            <IonItem
              button
              detail={false}
              onClick={() => updateField('isFavorite', !form.isFavorite)}
              className="add-prayer-modal__favorite-item"
            >
              <IonLabel>즐겨찾기에 추가</IonLabel>
              <span slot="end" className="add-prayer-modal__star">
                {form.isFavorite ? '★' : '☆'}
              </span>
            </IonItem>

          </IonList>

          {/* 안내 문구 */}
          <p className="add-prayer-modal__hint">
            * 표시 항목은 필수 입력입니다.{'\n'}
            좌우 스와이프로 기도문을 수정하거나 삭제할 수 있습니다.
          </p>
        </IonContent>
      </IonModal>

      {/* 저장 결과 토스트 */}
      <IonToast
        isOpen={toast.show}
        message={toast.message}
        color={toast.color as 'success' | 'danger'}
        duration={2000}
        onDidDismiss={() => setToast((t) => ({ ...t, show: false }))}
        position="bottom"
      />
    </>
  );
};

export default AddPrayerModal;
