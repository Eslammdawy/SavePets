import React, { useState, useRef } from 'react';
import {
  GOVERNORATES,
  getGovernorateName,
  reverseGeocodeLocation
} from './governorates';
import { DICT } from './i18n';
import { compressImageFile } from './imageCompress';
import { submitPetReport, generateUuid } from './api';
import { enqueueOfflineReport } from './offlineQueue';
import { FirstAidInlineCard } from './FirstAidInlineCard';

const TYPE_OPTIONS = [
  { key: 'dog', icon: '🐕' },
  { key: 'cat', icon: '🐈' }
];

const CONDITION_OPTIONS = [
  { key: 'injured', icon: '🩹', tone: 'injured' },
  { key: 'sick', icon: '🤒', tone: 'sick' },
  { key: 'pregnant', icon: '🍼', tone: 'pregnant' },
  { key: 'healthy', icon: '💚', tone: 'healthy' },
  { key: 'unsure', icon: '❓', tone: 'unsure' }
];

export default function ShareView({ lang, onPetAdded, onOpenFirstAid }) {
  const t = DICT[lang] || DICT.en;
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [photoData, setPhotoData] = useState(null); // { base64, dataUrl, mimeType, sizeBytes }
  const [compressing, setCompressing] = useState(false);

  const [coords, setCoords] = useState(null); // { lat, lng }
  const [locating, setLocating] = useState(false);
  const [detectingAddress, setDetectingAddress] = useState(false);
  const [locationError, setLocationError] = useState('');

  const [gov, setGov] = useState('');
  const [city, setCity] = useState('');
  const [animalType, setAnimalType] = useState('dog');
  const [condition, setCondition] = useState('injured');
  const [desc, setDesc] = useState('');
  const [contact, setContact] = useState('');
  const [honeypot, setHoneypot] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submittedPin, setSubmittedPin] = useState('');

  async function handleFileChange(e) {
    const inputEl = e.target;
    const file = inputEl && inputEl.files && inputEl.files[0];
    if (!file) return;

    setErrorMsg('');
    setSuccessMsg('');
    setSubmittedPin('');
    setCompressing(true);

    try {
      const result = await compressImageFile(file);
      setPhotoData(result);
    } catch (err) {
      const code = err && err.code;
      let msg = (err && err.message) || 'Failed to process photo.';
      if (code === 'ERR_HEIC_CONVERT' && t.photoHeicError) {
        msg = t.photoHeicError;
      } else if (code === 'ERR_IMAGE_LOAD' && t.photoLoadError) {
        msg = t.photoLoadError;
      } else if (code === 'ERR_INVALID_FILE' && t.photoInvalidError) {
        msg = t.photoInvalidError;
      } else if (code === 'ERR_TOO_LARGE' && t.photoTooLargeError) {
        msg = t.photoTooLargeError;
      }
      setErrorMsg(msg);
      setPhotoData(null);
    } finally {
      setCompressing(false);
      if (inputEl) {
        inputEl.value = '';
      }
    }
  }

  function handleGetLocation() {
    setLocationError('');
    setErrorMsg('');
    setSuccessMsg('');

    if (!navigator.geolocation) {
      setLocationError(t.locationDeniedError);
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Math.round(pos.coords.latitude * 1e5) / 1e5;
        const lng = Math.round(pos.coords.longitude * 1e5) / 1e5;
        setCoords({ lat, lng });
        setLocating(false);

        // Auto-read Governorate & Area/City from captured GPS coordinates
        setDetectingAddress(true);
        try {
          const detected = await reverseGeocodeLocation(lat, lng, lang);
          if (detected.gov) {
            setGov(detected.gov);
          }
          if (detected.city) {
            setCity(detected.city);
          }
        } finally {
          setDetectingAddress(false);
        }
      },
      () => {
        setLocating(false);
        setLocationError(t.locationDeniedError);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  function normalizeContactDigits(raw) {
    let digits = String(raw || '').replace(/\D+/g, '');
    if (!digits) return '';
    // Automatically prepend Egypt country code "20" if 11-digit local mobile starting with 01
    if (/^01[0125]\d{8}$/.test(digits)) {
      digits = '20' + digits.slice(1);
    }
    return digits;
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetFormFields() {
    setPhotoData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
    setCoords(null);
    setLocationError('');
    setGov('');
    setCity('');
    setAnimalType('dog');
    setCondition('injured');
    setDesc('');
    setContact('');
    setHoneypot('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmittedPin('');

    const trimmedCity = city.trim();
    if (!photoData || !gov) {
      setErrorMsg(t.validationRequired);
      scrollToTop();
      return;
    }

    const cleanContact = normalizeContactDigits(contact);
    if (cleanContact && (cleanContact.length < 8 || cleanContact.length > 15)) {
      setErrorMsg(t.validationContact);
      scrollToTop();
      return;
    }

    const hasCoords =
      coords &&
      typeof coords.lat === 'number' &&
      typeof coords.lng === 'number' &&
      Number.isFinite(coords.lat) &&
      Number.isFinite(coords.lng);

    const finalCity = trimmedCity || getGovernorateName(gov, lang);
    const payload = {
      id: generateUuid(),
      gov,
      city: finalCity,
      lat: hasCoords ? coords.lat : null,
      lng: hasCoords ? coords.lng : null,
      type: animalType,
      cond: condition,
      desc: desc.trim().slice(0, 300),
      contact: cleanContact,
      photoBase64: photoData.base64,
      mimeType: photoData.mimeType,
      website: honeypot
    };

    // If browser is offline, immediately queue in localStorage
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const queued = enqueueOfflineReport(payload);
      if (!queued.ok) {
        setErrorMsg(t.offlineStorageFullError);
        scrollToTop();
        return;
      }
      resetFormFields();
      setSuccessMsg(t.savedOfflineSuccess);
      scrollToTop();
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitPetReport(payload);

      const submittedGov = gov;
      resetFormFields();
      setSuccessMsg(t.submitSuccess);
      if (res && res.pin) {
        setSubmittedPin(String(res.pin));
      }
      scrollToTop();

      if (onPetAdded) {
        onPetAdded(submittedGov, res && res.pet);
      }
    } catch (err) {
      const isNetworkFailure =
        !navigator.onLine ||
        err instanceof TypeError ||
        (err && err.retryable === true) ||
        /network|fetch|offline|timed out/i.test(String(err && err.message));

      if (isNetworkFailure) {
        const queued = enqueueOfflineReport(payload);
        if (!queued.ok) {
          setErrorMsg(t.offlineStorageFullError);
          scrollToTop();
          return;
        }
        resetFormFields();
        setSuccessMsg(t.savedOfflineSuccess);
        scrollToTop();
      } else {
        setErrorMsg(err.message || 'Submission failed.');
        scrollToTop();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const sizeKb = photoData ? Math.max(1, Math.round(photoData.sizeBytes / 1024)) : 0;
  const showFirstAidGuide =
    condition === 'injured' || condition === 'sick' || condition === 'pregnant';

  return (
    <div className="share-container">
      <section className="surface-card panel-card">
        <div className="panel-header">
          <span className="panel-badge-icon" aria-hidden="true">🩺</span>
          <div>
            <h1 className="panel-title">{t.shareTitle}</h1>
            <p className="panel-subtitle">{t.shareSubtitle}</p>
          </div>
        </div>

        {errorMsg && (
          <div className="alert-box alert-error" role="alert">
            <span aria-hidden="true">⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert-box alert-success" role="status">
            <span aria-hidden="true">🎉</span>
            <div>
              <div>{successMsg}</div>
              {submittedPin && (
                <div className="pin-issued-box">
                  <div className="pin-issued-title">
                    🔑 {t.pinIssuedTitle}: <strong dir="ltr">{submittedPin}</strong>
                  </div>
                  <div className="pin-issued-sub">{t.pinIssuedNote(submittedPin)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* STEP 1: Photo & GPS Location */}
          <div className="form-step-block">
            <div className="step-header">
              <span className="step-number">1</span>
              <h2 className="step-title">{t.step1Title}</h2>
            </div>

            {/* Photo Dropzone / Preview */}
            <div className="form-group">
              <span className="form-label">{t.photoLabel}</span>
              {/* Hidden input for live camera capture */}
              <input
                ref={cameraInputRef}
                id="pet-camera-input"
                type="file"
                accept="image/*,image/heic,image/heif"
                capture="environment"
                className="file-input-hidden"
                onChange={handleFileChange}
              />
              {/* Hidden input for uploading from phone gallery / file picker */}
              <input
                ref={fileInputRef}
                id="pet-photo-input"
                type="file"
                accept="image/*,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png,.webp"
                className="file-input-hidden"
                onChange={handleFileChange}
              />

              {!photoData ? (
                <div className="photo-dropzone">
                  <span className="dropzone-icon-circle" aria-hidden="true">
                    📷
                  </span>
                  <span className="dropzone-title">
                    {compressing ? t.photoCompressing : t.photoBtn}
                  </span>
                  <span className="dropzone-hint">{t.photoHint}</span>

                  <div className="photo-source-actions">
                    <label
                      className="photo-source-btn is-camera"
                      htmlFor="pet-camera-input"
                    >
                      <span aria-hidden="true">📷</span>
                      <span>{t.photoCameraBtn}</span>
                    </label>
                    <label
                      className="photo-source-btn is-gallery"
                      htmlFor="pet-photo-input"
                    >
                      <span aria-hidden="true">🖼️</span>
                      <span>{t.photoGalleryBtn}</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="photo-preview-box">
                  <img
                    src={photoData.dataUrl}
                    alt="Preview"
                    className="photo-preview-img"
                  />
                  <div className="photo-preview-overlay">
                    <span className="photo-size-pill">
                      ✨ {photoData.mimeType === 'image/webp' ? 'WebP' : 'JPEG'} • {sizeKb} KB
                    </span>
                    <div className="photo-retake-actions">
                      <label className="photo-retake-btn" htmlFor="pet-camera-input">
                        <span aria-hidden="true">📷</span>
                        <span>{t.photoRetakeCameraBtn}</span>
                      </label>
                      <label className="photo-retake-btn" htmlFor="pet-photo-input">
                        <span aria-hidden="true">🖼️</span>
                        <span>{t.photoRetakeGalleryBtn}</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Governorate & City (Manual selection always available) */}
            <div className="form-row-2" style={{ marginBottom: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="share-gov">
                  {t.govLabel}
                </label>
                <select
                  id="share-gov"
                  className="select-field"
                  value={gov}
                  onChange={(e) => setGov(e.target.value)}
                  required
                >
                  <option value="">{t.govPlaceholder}</option>
                  {GOVERNORATES.map((g) => (
                    <option key={g.id} value={g.id}>
                      {lang === 'ar' ? g.ar : g.en}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="share-city">
                  {t.cityLabel}
                </label>
                <input
                  id="share-city"
                  type="text"
                  className="input-field"
                  placeholder={detectingAddress ? t.detectingAddress : t.cityPlaceholder}
                  maxLength={100}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </div>

            {/* Optional GPS Location Capture */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <span className="form-label">{t.locationLabel}</span>
              <div className="location-box">
                {!coords ? (
                  <button
                    type="button"
                    className="btn-gps-trigger"
                    onClick={handleGetLocation}
                    disabled={locating}
                  >
                    <span className="gps-icon-pulse" aria-hidden="true">📍</span>
                    <span>{locating ? t.locating : t.useMyLocation}</span>
                  </button>
                ) : (
                  <div className="location-status">
                    <div className="location-status-info">
                      <span className="location-check" aria-hidden="true">✅</span>
                      <div>
                        <div className="location-status-title">{t.locationCaptured}</div>
                        <div className="location-coords" dir="ltr">
                          {coords.lat}, {coords.lng}
                          {detectingAddress ? ` — ${t.detectingAddress}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="location-status-actions">
                      <button
                        type="button"
                        className="btn-location-refresh"
                        onClick={handleGetLocation}
                        disabled={locating || detectingAddress}
                      >
                        🔄 {t.locationUpdate}
                      </button>
                      <button
                        type="button"
                        className="btn-location-clear"
                        onClick={() => {
                          setCoords(null);
                          setLocationError('');
                        }}
                        disabled={locating || detectingAddress}
                      >
                        ✕ {t.locationClear}
                      </button>
                    </div>
                  </div>
                )}

                <p className="form-field-hint" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  💡 {t.locationOptionalHint}
                </p>

                {locationError && (
                  <div className="alert-box alert-error" role="alert" style={{ marginBottom: 0 }}>
                    <span aria-hidden="true">⚠️</span>
                    <span>{locationError}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* STEP 2: Animal Type & Condition (Visual Tap Selectors) */}
          <div className="form-step-block">
            <div className="step-header">
              <span className="step-number">2</span>
              <h2 className="step-title">{t.step2Title}</h2>
            </div>

            {/* Visual Animal Type Cards */}
            <div className="form-group">
              <span className="form-label">{t.typeLabel}</span>
              <div className="type-selector-grid" role="radiogroup" aria-label={t.typeLabel}>
                {TYPE_OPTIONS.map((opt) => {
                  const active = animalType === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`type-select-card ${active ? 'is-selected' : ''}`}
                      onClick={() => setAnimalType(opt.key)}
                    >
                      <span className="type-select-emoji" aria-hidden="true">
                        {opt.icon}
                      </span>
                      <span className="type-select-label">{t.types[opt.key]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interactive Condition Chips */}
            <div className="form-group">
              <span className="form-label">{t.condLabel}</span>
              <div className="cond-selector-wrap" role="radiogroup" aria-label={t.condLabel}>
                {CONDITION_OPTIONS.map((opt) => {
                  const active = condition === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`cond-select-chip tone-${opt.tone} ${active ? 'is-selected' : ''}`}
                      onClick={() => setCondition(opt.key)}
                    >
                      <span aria-hidden="true">{opt.icon}</span>
                      <span>{t.conditions[opt.key]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inline Street First-Aid Guide when Injured / Sick / Pregnant is selected */}
            {showFirstAidGuide && (
              <FirstAidInlineCard
                condition={condition}
                lang={lang}
                onOpenFullModal={onOpenFirstAid}
              />
            )}

            {/* Description (max 300 chars with counter) */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div className="label-header-row">
                <label className="form-label" htmlFor="share-desc" style={{ marginBottom: 0 }}>
                  {t.descLabel}
                </label>
                <span className="char-counter">{desc.length} / 300</span>
              </div>
              <textarea
                id="share-desc"
                className="textarea-field"
                placeholder={t.descPlaceholder}
                maxLength={300}
                value={desc}
                onChange={(e) => setDesc(e.target.value.slice(0, 300))}
              />
              <p className="form-field-hint" style={{ marginTop: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                💡 {t.descFollowUpHint}
              </p>
            </div>
          </div>

          {/* STEP 3: Optional Contact (WhatsApp) */}
          <div className="form-step-block">
            <div className="step-header">
              <span className="step-number">3</span>
              <h2 className="step-title">{t.step3Title}</h2>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="share-contact">
                {t.contactLabel}
              </label>
              <input
                id="share-contact"
                type="tel"
                inputMode="numeric"
                dir="ltr"
                className="input-field"
                placeholder={t.contactPlaceholder}
                value={contact}
                onChange={(e) => setContact(e.target.value.replace(/[^\d+\s-]/g, ''))}
              />
              <div className="privacy-banner">
                <span aria-hidden="true">🔒</span>
                <span>{t.contactPrivacyNote}</span>
              </div>
            </div>
          </div>

          {/* Hidden Honeypot Field for Bots */}
          <div className="hp-field" aria-hidden="true">
            <label htmlFor="share-website">Website</label>
            <input
              id="share-website"
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn-primary btn-submit-large"
            disabled={submitting || compressing}
          >
            <span aria-hidden="true">🐾</span>
            <span>{submitting ? t.submittingBtn : t.submitBtn}</span>
          </button>
        </form>
      </section>
    </div>
  );
}
