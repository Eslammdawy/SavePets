import React, { useState, useEffect } from 'react';
import { getDrivePhotoUrl } from './api';
import { getGovernorateName, formatDistance } from './governorates';
import { DICT, formatTimeAgo, buildWhatsAppUrl } from './i18n';
import { sharePetCaseNative } from './RescuePosterModal';
import { loadPetComments, addPetComment } from './comments';

const TRUNCATE_LENGTH = 120;

const CONDITION_ICONS = {
  injured: '🩹',
  sick: '🤒',
  pregnant: '🍼',
  healthy: '💚',
  unsure: '❓'
};

const TYPE_ICONS = {
  dog: '🐕',
  cat: '🐈'
};

export default function PetCard({
  pet,
  lang,
  distanceKm = null,
  isSaved = false,
  onToggleSave,
  onOpenPoster,
  onMarkAdopted
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Comments & Follow-up State
  const [comments, setComments] = useState(() => loadPetComments(pet.id));
  const [showComments, setShowComments] = useState(false);
  const [authorInput, setAuthorInput] = useState('');
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [commentSuccess, setCommentSuccess] = useState('');
  const [commentError, setCommentError] = useState('');

  // Keep comments in sync when comments change across components or tabs
  useEffect(() => {
    function handleCommentsChanged(e) {
      if (!e.detail || e.detail.petId === pet.id) {
        setComments(loadPetComments(pet.id));
      }
    }
    window.addEventListener('sp-comments-changed', handleCommentsChanged);
    return () => {
      window.removeEventListener('sp-comments-changed', handleCommentsChanged);
    };
  }, [pet.id]);

  const t = DICT[lang] || DICT.en;
  const govName = getGovernorateName(pet.gov, lang);
  const cityText = String(pet.city || '').trim();
  const hasDistinctCity =
    cityText && cityText.toLowerCase() !== govName.toLowerCase();
  const locationLabel = hasDistinctCity
    ? lang === 'ar'
      ? `${cityText}، ${govName}`
      : `${cityText}, ${govName}`
    : govName;

  const typeLabel = t.types[pet.type] || pet.type;
  const typeIcon = TYPE_ICONS[pet.type] || '🐾';
  const condKey = pet.cond || 'unsure';
  const condLabel = t.conditions[condKey] || condKey;
  const condIcon = CONDITION_ICONS[condKey] || '🐾';
  const condClass = `cond-${condKey}`;
  const isUrgent = condKey === 'injured' || condKey === 'sick';

  const photoUrl = getDrivePhotoUrl(pet.photo);
  const timeAgo = formatTimeAgo(pet.t, lang);
  const distanceLabel = formatDistance(distanceKm, lang);
  const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${pet.lat},${pet.lng}`)}`;
  // PRIVACY RULE: never render raw phone number in text/title/tooltip; use only wa.me link on button
  const whatsappUrl = buildWhatsAppUrl(pet, lang);

  const cardHeadline =
    condKey === 'healthy'
      ? t.cardTitleAdopt(typeLabel)
      : t.cardTitleNeedsHelp(typeLabel);

  const desc = String(pet.desc || '').trim();
  const isLongDesc = desc.length > TRUNCATE_LENGTH;
  const shownDesc = !isLongDesc || expanded ? desc : desc.slice(0, TRUNCATE_LENGTH) + '…';

  async function handleQuickShare() {
    const res = await sharePetCaseNative(pet, lang);
    if (res.copied) {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2400);
    }
  }

  function handleSelectPreset(presetText) {
    setCommentError('');
    setCommentText((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}\n${presetText}` : presetText;
    });
  }

  async function handlePostComment(e) {
    e.preventDefault();
    setCommentError('');
    setCommentSuccess('');

    const cleanText = commentText.trim();
    if (!cleanText) {
      setCommentError(t.commentValidationRequired);
      return;
    }

    setPostingComment(true);
    try {
      const updated = addPetComment(pet.id, {
        author: authorInput.trim(),
        text: cleanText
      });
      setComments(updated);
      setCommentText('');
      setCommentSuccess(t.commentPostedSuccess);
      setTimeout(() => setCommentSuccess(''), 3500);
    } catch (err) {
      setCommentError(err.message || 'Failed to post comment.');
    } finally {
      setPostingComment(false);
    }
  }

  return (
    <article className={`surface-card pet-card ${isUrgent ? 'is-urgent-card' : ''}`}>
      <div className="pet-photo-wrap">
        <div className="pet-photo-placeholder" aria-hidden="true">
          <span className="placeholder-emoji">{typeIcon}</span>
        </div>

        {photoUrl && (
          <img
            src={photoUrl}
            alt={`${typeLabel} - ${locationLabel}`}
            loading="lazy"
            decoding="async"
            className={`pet-photo ${imgLoaded ? 'is-loaded' : ''}`}
            onLoad={() => setImgLoaded(true)}
          />
        )}

        {/* Top floating badges: Condition + Time Ago + Bookmark */}
        <div className="pet-photo-top-bar">
          <span className={`cond-badge ${condClass}`}>
            {isUrgent && <span className="urgent-dot" aria-hidden="true" />}
            <span aria-hidden="true">{condIcon}</span>
            <span>{condLabel}</span>
          </span>

          <div className="pet-top-right-pills">
            <span className="time-pill">
              <span aria-hidden="true">🕒</span> {timeAgo}
            </span>

            {onToggleSave && (
              <button
                type="button"
                className={`card-save-btn ${isSaved ? 'is-saved' : ''}`}
                onClick={() => onToggleSave(pet)}
                aria-pressed={isSaved}
                title={isSaved ? t.savedCaseBtn : t.saveCaseBtn}
              >
                <span aria-hidden="true">{isSaved ? '⭐' : '🔖'}</span>
                <span>{isSaved ? t.savedCaseBtn : t.saveCaseBtn}</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom floating location & distance bar on photo */}
        <div className="pet-photo-bottom-bar">
          <div className="pet-location-stack">
            <span className="pet-location-pill">
              <span aria-hidden="true">📍</span> {locationLabel}
            </span>
            {distanceLabel && (
              <span className="distance-pill">
                <span aria-hidden="true">🧭</span> {distanceLabel}
              </span>
            )}
          </div>
          <span className="type-pill">
            <span aria-hidden="true">{typeIcon}</span> {typeLabel}
          </span>
        </div>
      </div>

      <div className="pet-card-body">
        <div className="pet-headline-row">
          <h2 className="pet-headline">{cardHeadline}</h2>
        </div>

        {/* Description & Nearby Landmarks Section */}
        <div className="pet-desc-section" aria-label={t.descLabel}>
          <div className="pet-desc-header">
            <span className="pet-desc-label">
              <span aria-hidden="true">📍</span> {t.descLabel}
            </span>

            <button
              type="button"
              className={`pet-comments-toggle-btn ${showComments ? 'is-active' : ''}`}
              onClick={() => setShowComments((prev) => !prev)}
              aria-expanded={showComments}
              title={t.commentsTitle}
            >
              <span aria-hidden="true">💬</span>
              <span>
                {comments.length > 0
                  ? `${comments.length} ${t.commentsCountLabel(comments.length)}`
                  : t.addFollowUpBtn}
              </span>
              <span className="toggle-chevron" aria-hidden="true">
                {showComments ? '▲' : '▼'}
              </span>
            </button>
          </div>

          {desc ? (
            <div className="pet-desc-box">
              <p className="pet-desc">
                {shownDesc}
                {isLongDesc && (
                  <button
                    type="button"
                    className="read-more-btn"
                    onClick={() => setExpanded((prev) => !prev)}
                  >
                    {expanded ? t.readLess : t.readMore}
                  </button>
                )}
              </p>
            </div>
          ) : (
            <p className="pet-desc-fallback">{t.noDescFallback}</p>
          )}

          {/* Interactive Comments & Follow-up Section */}
          {showComments && (
            <div className="pet-comments-container">
              <div className="pet-comments-header-row">
                <span className="pet-comments-header-title">
                  <span aria-hidden="true">📝</span> {t.commentsTitle}
                </span>
                <span className="pet-comments-count-pill">
                  {comments.length} {t.commentsCountLabel(comments.length)}
                </span>
              </div>
              <p className="pet-comments-sub">{t.commentsSubtitle}</p>

              {/* Quick Preset Follow-up Chips */}
              {t.quickPresets && t.quickPresets.length > 0 && (
                <div className="quick-followup-box">
                  <span className="quick-presets-label">{t.quickPresetTitle}</span>
                  <div className="quick-followup-chips">
                    {t.quickPresets.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="quick-followup-chip"
                        onClick={() => handleSelectPreset(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments List */}
              <div className="pet-comments-list">
                {comments.length === 0 ? (
                  <div className="no-comments-box">
                    <span className="no-comments-icon" aria-hidden="true">🐾</span>
                    <p>{t.noCommentsYet}</p>
                  </div>
                ) : (
                  comments.map((cmt) => (
                    <div key={cmt.id} className="pet-comment-item">
                      <div className="pet-comment-meta">
                        <span className="pet-comment-author">
                          <span aria-hidden="true">👤</span>{' '}
                          {cmt.author || (lang === 'ar' ? 'فاعل خير / منقذ' : 'Rescuer / Follower')}
                        </span>
                        <span className="pet-comment-time">
                          🕒 {formatTimeAgo(cmt.ts, lang)}
                        </span>
                      </div>
                      <div className="pet-comment-text">{cmt.text}</div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment Form */}
              <form className="pet-comment-form" onSubmit={handlePostComment}>
                {commentError && (
                  <div className="comment-alert comment-alert-error" role="alert">
                    ⚠️ {commentError}
                  </div>
                )}
                {commentSuccess && (
                  <div className="comment-alert comment-alert-success" role="status">
                    ✅ {commentSuccess}
                  </div>
                )}

                <div className="comment-form-inputs">
                  <input
                    type="text"
                    className="comment-author-input"
                    placeholder={t.commentAuthorPlaceholder}
                    value={authorInput}
                    onChange={(e) => setAuthorInput(e.target.value)}
                    maxLength={50}
                  />

                  <textarea
                    className="comment-text-input"
                    placeholder={t.commentTextPlaceholder}
                    value={commentText}
                    onChange={(e) => {
                      setCommentText(e.target.value);
                      if (commentError) setCommentError('');
                    }}
                    maxLength={500}
                    rows={2}
                  />

                  <div className="comment-form-actions">
                    <span className="comment-char-count">{commentText.length} / 500</span>
                    <button
                      type="submit"
                      className="btn-submit-comment"
                      disabled={postingComment || !commentText.trim()}
                    >
                      <span aria-hidden="true">🚀</span>
                      <span>{postingComment ? t.postingCommentBtn : t.postCommentBtn}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>

        {shareCopied && (
          <div className="share-copied-inline" role="status">
            ✅ {t.shareCopiedToast}
          </div>
        )}

        <div className="pet-actions-row">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="action-btn btn-whatsapp"
            >
              <span aria-hidden="true">💬</span> {t.openWhatsAppBtn}
            </a>
          )}

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="action-btn btn-maps"
          >
            <span aria-hidden="true">🗺️</span> {t.openMapsBtn}
          </a>
        </div>

        {/* Secondary Social Share & Rescue Poster Row */}
        <div className="pet-utility-row">
          <button
            type="button"
            className="btn-card-utility"
            onClick={handleQuickShare}
          >
            <span aria-hidden="true">📤</span>
            <span>{t.shareCaseBtn}</span>
          </button>

          {onOpenPoster && (
            <button
              type="button"
              className="btn-card-utility"
              onClick={() => onOpenPoster(pet)}
            >
              <span aria-hidden="true">🖼️</span>
              <span>{t.posterBtn}</span>
            </button>
          )}
        </div>

        <div className="pet-card-footer">
          {!confirming ? (
            <button
              type="button"
              className="btn-adopted"
              onClick={() => setConfirming(true)}
            >
              <span aria-hidden="true">🏡</span> {t.markAdoptedBtn}
            </button>
          ) : (
            <div className="confirm-bar">
              <span className="confirm-text">{t.confirmAdoptedPrompt}</span>
              <div className="confirm-actions">
                <button
                  type="button"
                  className="btn-confirm-yes"
                  onClick={() => onMarkAdopted(pet)}
                >
                  {t.confirmYes}
                </button>
                <button
                  type="button"
                  className="btn-confirm-cancel"
                  onClick={() => setConfirming(false)}
                >
                  {t.confirmCancel}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
