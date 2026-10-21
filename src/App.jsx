import React, { useState, useEffect, useCallback } from 'react';
import { DICT } from './i18n';
import ShareView from './ShareView';
import AdoptView from './AdoptView';
import FirstAidModal from './FirstAidModal';
import {
  getOfflineQueue,
  flushOfflineQueue,
  getFailedOfflineReports,
  discardFailedOfflineReport
} from './offlineQueue';

const LANG_STORAGE_KEY = 'sp_lang_v1';

export default function App() {
  // Default to Arabic ('ar', RTL) on first visit; persist choice in localStorage
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'ar' || saved === 'en') return saved;
    } catch (_e) {
      // Ignore storage errors
    }
    return 'ar';
  });

  const [activeTab, setActiveTab] = useState('share');
  const [adoptTrigger, setAdoptTrigger] = useState(0);
  const [petAddedEvent, setPetAddedEvent] = useState(null);
  const [firstAidOpen, setFirstAidOpen] = useState(false);

  // Offline Queue & Network Status
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );
  const [queuedCount, setQueuedCount] = useState(() => getOfflineQueue().length);
  const [failedReports, setFailedReports] = useState(() => getFailedOfflineReports());
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [syncToast, setSyncToast] = useState('');

  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch (_e) {
      // Ignore storage errors
    }
  }, [lang]);

  const t = DICT[lang] || DICT.en;

  const handleSyncOfflineQueue = useCallback(
    async (force = false) => {
      setSyncingQueue(true);
      try {
        const res = await flushOfflineQueue({ force });
        setQueuedCount(res.remainingCount);
        setFailedReports(getFailedOfflineReports());
        if (res.syncedCount > 0) {
          setSyncToast(
            (DICT[lang] || DICT.en).syncCompleteToast(res.syncedCount)
          );
          setTimeout(() => setSyncToast(''), 4000);
          if (res.lastGov) {
            setPetAddedEvent({
              gov: res.lastGov,
              pet: res.lastPet || null,
              ts: Date.now()
            });
          }
        }
      } finally {
        setSyncingQueue(false);
      }
    },
    [lang]
  );

  useEffect(() => {
    function refreshQueueState() {
      setQueuedCount(getOfflineQueue().length);
      setFailedReports(getFailedOfflineReports());
    }

    function handleOnline() {
      setIsOnline(true);
      if (getOfflineQueue().length > 0) {
        handleSyncOfflineQueue(false);
      }
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('sp-offline-queue-changed', refreshQueueState);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('sp-offline-queue-changed', refreshQueueState);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleSyncOfflineQueue]);

  function toggleLanguage() {
    setLang((prev) => (prev === 'ar' ? 'en' : 'ar'));
  }

  function handleSelectShareTab() {
    setActiveTab('share');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSelectAdoptTab() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (activeTab !== 'adopt') {
      setActiveTab('adopt');
    } else {
      setAdoptTrigger((prev) => prev + 1);
    }
  }

  function handlePetAdded(submittedGov, createdPet = null) {
    if (submittedGov) {
      setPetAddedEvent({
        gov: submittedGov,
        pet: createdPet || null,
        ts: Date.now()
      });
    }
  }

  function handleDiscardFailed(queueId) {
    setFailedReports(discardFailedOfflineReport(queueId));
  }

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="surface-card top-bar">
        <div className="brand-wrap">
          <div className="brand-logo-badge" aria-hidden="true">
            🐾
          </div>
          <div>
            <div className="brand-title">{t.appName}</div>
            <div className="brand-tagline">{t.appTagline}</div>
          </div>
        </div>

        {/* Desktop / Tablet Segmented Nav */}
        <nav className="desktop-nav" aria-label="Primary Navigation">
          <button
            type="button"
            className={`desktop-nav-btn ${activeTab === 'share' ? 'is-active' : ''}`}
            onClick={handleSelectShareTab}
          >
            <span aria-hidden="true">📸</span>
            <span>{t.tabShare}</span>
          </button>

          <button
            type="button"
            className={`desktop-nav-btn ${activeTab === 'adopt' ? 'is-active' : ''}`}
            onClick={handleSelectAdoptTab}
          >
            <span aria-hidden="true">🏡</span>
            <span>{t.tabAdopt}</span>
          </button>
        </nav>

        <div className="header-actions-group">
          <button
            type="button"
            className="first-aid-top-btn"
            onClick={() => setFirstAidOpen(true)}
          >
            <span aria-hidden="true">🩺</span>
            <span className="first-aid-top-label">{t.firstAidHeaderBtn}</span>
          </button>

          <button
            type="button"
            className="lang-btn"
            onClick={toggleLanguage}
            aria-label="Switch language"
          >
            <span aria-hidden="true">🌐</span>
            <span>{t.langToggle}</span>
          </button>
        </div>
      </header>

      {/* Offline Queue & Network Status Banner */}
      {(!isOnline || queuedCount > 0 || failedReports.length > 0) && (
        <div className="surface-card offline-queue-banner" role="status">
          <div className="offline-queue-info">
            <span className="offline-icon" aria-hidden="true">
              {isOnline ? '📡' : '📴'}
            </span>
            <div>
              {!isOnline && (
                <div className="offline-banner-title">{t.offlineBannerTitle}</div>
              )}
              {queuedCount > 0 && (
                <div className="offline-banner-sub">
                  {t.offlineQueueCount(queuedCount)}
                </div>
              )}
              {failedReports.length > 0 && (
                <div className="offline-failed-list">
                  <div className="offline-failed-title">⚠️ {t.offlineFailedTitle}</div>
                  {failedReports.map((item) => (
                    <div key={item.queueId} className="offline-failed-item">
                      <span>{item.reason}</span>
                      <button
                        type="button"
                        className="btn-discard-failed"
                        onClick={() => handleDiscardFailed(item.queueId)}
                      >
                        ✕ {t.discardFailedBtn}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {queuedCount > 0 && isOnline && (
            <button
              type="button"
              className="btn-sync-queue"
              onClick={() => handleSyncOfflineQueue(true)}
              disabled={syncingQueue}
            >
              🔄 {syncingQueue ? t.syncingBtn : t.syncNowBtn}
            </button>
          )}
        </div>
      )}

      {syncToast && (
        <div className="alert-box alert-success" role="status">
          <span aria-hidden="true">🎉</span>
          <span>{syncToast}</span>
        </div>
      )}

      {/* Main Content: Both views stay mounted so switching tabs never loses state or refetches */}
      <main>
        <div
          className={`view-panel ${activeTab === 'share' ? '' : 'is-hidden'}`}
          aria-hidden={activeTab !== 'share'}
        >
          <ShareView
            lang={lang}
            onPetAdded={handlePetAdded}
            onOpenFirstAid={() => setFirstAidOpen(true)}
          />
        </div>

        <div
          className={`view-panel ${activeTab === 'adopt' ? '' : 'is-hidden'}`}
          aria-hidden={activeTab !== 'adopt'}
        >
          <AdoptView
            lang={lang}
            adoptTrigger={adoptTrigger}
            petAddedEvent={petAddedEvent}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="surface-card app-footer" dir="ltr">
        <span>🐾 Street Pets Egypt</span>
        <span className="footer-dot" aria-hidden="true">•</span>
        <span>Created by Eslam Eldawy 01010115588</span>
      </footer>

      {/* Fixed Bottom Navigation Bar (Mobile) */}
      <div className="bottom-nav-wrap">
        <nav className="surface-card bottom-nav" aria-label="Mobile Navigation">
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'share' ? 'is-active' : ''}`}
            onClick={handleSelectShareTab}
          >
            <span aria-hidden="true">📸</span>
            <span>{t.tabShare}</span>
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'adopt' ? 'is-active' : ''}`}
            onClick={handleSelectAdoptTab}
          >
            <span aria-hidden="true">🏡</span>
            <span>{t.tabAdopt}</span>
          </button>
        </nav>
      </div>

      {/* Emergency First-Aid & Shelter Directory Modal */}
      {firstAidOpen && (
        <FirstAidModal lang={lang} onClose={() => setFirstAidOpen(false)} />
      )}
    </div>
  );
}
