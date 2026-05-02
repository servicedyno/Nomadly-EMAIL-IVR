import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Lightbox-style preview for an image file in the current folder, with arrow
 * navigation when there are 2+ images in the gallery. Only renders when
 * `preview` is non-null.
 *
 * Props:
 *  - preview: { name, url } | null  — the currently-shown image
 *  - galleryLength: total images in this folder
 *  - galleryIndex: 0-based index of `preview` in the gallery
 *  - hasPrev / hasNext: whether ←/→ navigation is available
 *  - onNav(delta): navigate by ±1
 *  - onClose: dismiss the modal
 */
export default function ImagePreviewModal({
  preview,
  galleryLength,
  galleryIndex,
  hasPrev,
  hasNext,
  onNav,
  onClose,
}) {
  const { t } = useTranslation();
  if (!preview) return null;
  return (
    <div className="fm-modal-overlay" data-testid="fm-img-modal" onClick={onClose}>
      <div className="fm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fm-modal-header">
          <span data-testid="fm-img-modal-name">
            {preview.name}
            {galleryLength > 1 && (
              <span className="fm-img-counter" data-testid="fm-img-counter">
                {galleryIndex + 1} / {galleryLength}
              </span>
            )}
          </span>
          <button onClick={onClose} className="fm-modal-close" data-testid="fm-img-modal-close">&times;</button>
        </div>
        <div className="fm-img-preview">
          {hasPrev && (
            <button
              className="fm-img-nav fm-img-nav--prev"
              onClick={() => onNav(-1)}
              data-testid="fm-img-prev"
              aria-label={t('fm.imgPreview.prev')}
              title={t('fm.imgPreview.prevTitle')}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <img src={preview.url} alt={preview.name} data-testid="fm-img-modal-img" />
          {hasNext && (
            <button
              className="fm-img-nav fm-img-nav--next"
              onClick={() => onNav(1)}
              data-testid="fm-img-next"
              aria-label={t('fm.imgPreview.next')}
              title={t('fm.imgPreview.nextTitle')}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}
        </div>
        <div className="fm-modal-actions">
          {galleryLength > 1 && (
            <span style={{ marginRight: 'auto', fontSize: 11.5, color: 'var(--pv-text-muted)', fontFamily: 'var(--pv-font-mono)' }}>
              {t('fm.imgPreview.navHint')}
            </span>
          )}
          <a href={preview.url} target="_blank" rel="noopener noreferrer" className="fm-btn fm-btn--ghost" data-testid="fm-img-open-tab">
            {t('fm.imgPreview.openInTab')}
          </a>
          <button onClick={onClose} className="fm-btn fm-btn--primary">{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
