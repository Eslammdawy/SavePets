import React, { useState, useEffect, useRef } from 'react';
import {
  GOVERNORATES,
  reverseGeocodeLocation,
  calculateDistanceKm
} from './governorates';
import { DICT } from './i18n';
import { fetchPetsByGovernorate, markPetAdopted } from './api';
import {
  loadSavedPets,
  toggleSavedPet,
  removeSavedPetById
} from './bookmarks';
import PetCard from './PetCard';
import PetMapView from './PetMapView';
import RescuePosterModal from './RescuePosterModal';

const PAGE_SIZE = 12;
const POPULAR_GOV_IDS = ['cairo', 'giza', 'alexandria', 'qalyubia', 'dakahlia', 'sharkia'];
const RADIUS_OPTIONS = [0, 5, 15, 30];

export default function AdoptView({ lang, adoptTrigger = 0, petAddedEvent = null }) {
  const t = DICT[lang] || DICT.en;
  const govSelectRef = useRef(null);

  // Filter inputs
  const [selectedGov, setSelectedGov] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [typeInput, setTypeInput] = useState('');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);

  // Near Me / GPS distance sorting & radius filter
  const [userCoords, setUserCoords] = useState(null); // { lat, lng }
  const [locatingNearMe, setLocatingNearMe] = useState(false);
  const [sortByNearest, setSortByNearest] = useState(false);
  const [radiusKm, setRadiusKm] = useState(0); // 0 = all distances

  // View Mode: 'list' | 'map'
  const [viewMode, setViewMode] = useState('list');

  // Bookmarked / Saved pets in localStorage
  const [savedPets, setSavedPets] = useState(() => loadSavedPets());

  // Rescue Poster Modal pet
  const [posterPet, setPosterPet] = useState(null);

  // Active search state (persists while switching tabs because AdoptView stays mounted)
  const [searchedGov, setSearchedGov] = useState('');
  const [appliedCity, setAppliedCity] = useState('');
  const [appliedType, setAppliedType] = useState('');
  const [govPets, setGovPets] = useState([]);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const savedIds = new Set(savedPets.map((item) => item.id));

  async function runSearchForGov(govToSearch, cityVal = cityInput, typeVal = typeInput) {
    setErrorMsg('');

    if (!govToSearch) {
      setErrorMsg(t.selectGovPrompt);
      if (govSelectRef.current) {
        govSelectRef.current.focus();
      }
      return;
    }

    setLoading(true);
    try {
      // Fetches from network ONLY if not already fresh in memory/sessionStorage (<5 min)
      const list = await fetchPetsByGovernorate(govToSearch);
      setGovPets(list);
      setSearchedGov(govToSearch);
      setAppliedCity(cityVal.trim().toLowerCase());
      setAppliedType(typeVal);
      setPage(1);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to fetch pets.');
    } finally {
      setLoading(false);
    }
  }

  // When a pet is added in ShareView, preselect its governorate and load its pets
  useEffect(() => {
    if (!petAddedEvent || !petAddedEvent.gov) return;
    setSavedOnly(false);
    setSelectedGov(petAddedEvent.gov);
    runSearchForGov(petAddedEvent.gov, cityInput, typeInput);
  }, [petAddedEvent]);

  // Respond when user clicks "Save & adopt a pet" while already on this tab
  useEffect(() => {
    if (adoptTrigger === 0) return;
    if (selectedGov) {
      runSearchForGov(selectedGov, cityInput, typeInput);
    }
  }, [adoptTrigger]);

  function handleGovChange(e) {
    const newGov = e.target.value;
    setSelectedGov(newGov);
    setSavedOnly(false);
    setErrorMsg('');
    if (newGov) {
      runSearchForGov(newGov, cityInput, typeInput);
    } else {
      setSearchedGov('');
      setGovPets([]);
    }
  }

  function handleQuickSelectGov(govId) {
    setSelectedGov(govId);
    setSavedOnly(false);
    setErrorMsg('');
    runSearchForGov(govId, cityInput, typeInput);
  }

  function handleCityChange(e) {
    const val = e.target.value;
    setCityInput(val);
    setAppliedCity(val.trim().toLowerCase());
    setPage(1);
  }

  function handleTypeChipSelect(val) {
    setTypeInput(val);
    setAppliedType(val);
    setPage(1);
  }

  function handleToggleUrgent() {
    setUrgentOnly((prev) => !prev);
    setPage(1);
  }

  function handleToggleSavedOnly() {
    setSavedOnly((prev) => !prev);
    setErrorMsg('');
    setPage(1);
  }

  function handleToggleSavePet(pet) {
    setSavedPets((prev) => toggleSavedPet(prev, pet));
  }

  function handleNearMeSort() {
    setErrorMsg('');

    // If we already have user coordinates, toggle sorting directly
    if (userCoords && selectedGov) {
      setSortByNearest((prev) => !prev);
      setPage(1);
      return;
    }

    if (!navigator.geolocation) {
      setErrorMsg(t.locationDeniedError);
      return;
    }

    setLocatingNearMe(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Math.round(pos.coords.latitude * 1e5) / 1e5;
        const lng = Math.round(pos.coords.longitude * 1e5) / 1e5;
        setUserCoords({ lat, lng });
        setSortByNearest(true);

        try {
          if (!selectedGov) {
            const detected = await reverseGeocodeLocation(lat, lng, lang);
            if (detected.gov) {
              setSelectedGov(detected.gov);
              await runSearchForGov(detected.gov, cityInput, typeInput);
            }
          }
        } finally {
          setLocatingNearMe(false);
        }
      },
      () => {
        setLocatingNearMe(false);
        setErrorMsg(t.locationDeniedError);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  function handleResetFilters() {
    setCityInput('');
    setAppliedCity('');
    setTypeInput('');
    setAppliedType('');
    setUrgentOnly(false);
    setSavedOnly(false);
    setSortByNearest(false);
    setRadiusKm(0);
    setPage(1);
  }

  async function handleSearch(e) {
    e.preventDefault();
    await runSearchForGov(selectedGov, cityInput, typeInput);
  }

  function handleMarkAdopted(pet) {
    // 1. Optimistically remove from local state and saved bookmarks immediately
    setGovPets((prev) => prev.filter((item) => item.id !== pet.id));
    setSavedPets((prev) => removeSavedPetById(prev, pet.id));

    // 2. Remove from memory + sessionStorage cache and send POST in background
    markPetAdopted(pet.id, pet.gov).catch(() => {
      // Background errors are non-blocking per spec
    });
  }

  // Choose base source: either the user's saved bookmarks across all governorates, or the loaded governorate list
  const sourcePets = savedOnly ? savedPets : govPets;

  // Enrich with distance from userCoords when available
  const enrichedPets = sourcePets.map((pet) => {
    const dist = userCoords
      ? calculateDistanceKm(userCoords.lat, userCoords.lng, pet.lat, pet.lng)
      : null;
    return {
      ...pet,
      _distanceKm: dist
    };
  });

  // Filter in-browser
  const filteredPets = enrichedPets.filter((pet) => {
    if (appliedType && pet.type !== appliedType) {
      return false;
    }
    if (urgentOnly && pet.cond !== 'injured' && pet.cond !== 'sick') {
      return false;
    }
    if (appliedCity) {
      const petCity = String(pet.city || '').toLowerCase();
      if (!petCity.includes(appliedCity)) {
        return false;
      }
    }
    if (userCoords && radiusKm > 0 && typeof pet._distanceKm === 'number') {
      if (pet._distanceKm > radiusKm) {
        return false;
      }
    }
    return true;
  });

  // Sort by closest distance when enabled
  if (sortByNearest && userCoords) {
    filteredPets.sort((a, b) => {
      const dA = typeof a._distanceKm === 'number' ? a._distanceKm : Infinity;
      const dB = typeof b._distanceKm === 'number' ? b._distanceKm : Infinity;
      return dA - dB;
    });
  }

  const visiblePets = filteredPets.slice(0, page * PAGE_SIZE);
  const hasMore = visiblePets.length < filteredPets.length;
  const hasActiveSubFilters = Boolean(
    appliedType || appliedCity || urgentOnly || savedOnly || sortByNearest || radiusKm > 0
  );

  const popularGovs = POPULAR_GOV_IDS.map((id) =>
    GOVERNORATES.find((g) => g.id === id)
  ).filter(Boolean);

  return (
    <div>
      <section className="surface-card panel-card filter-panel">
        <div className="panel-header">
          <span className="panel-badge-icon" aria-hidden="true">🏡</span>
          <div>
            <h1 className="panel-title">{t.adoptTitle}</h1>
            <p className="panel-subtitle">{t.adoptSubtitle}</p>
          </div>
        </div>

        {errorMsg && (
          <div className="alert-box alert-error" role="alert">
            <span aria-hidden="true">⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSearch} noValidate>
          <div className="filter-inputs-grid">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="adopt-gov">
                📍 {t.filterGovLabel}
              </label>
              <select
                ref={govSelectRef}
                id="adopt-gov"
                className="select-field"
                value={selectedGov}
                onChange={handleGovChange}
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
              <label className="form-label" htmlFor="adopt-city">
                🔎 {t.filterCityLabel}
              </label>
              <input
                id="adopt-city"
                type="text"
                className="input-field"
                placeholder={t.filterCityPlaceholder}
                value={cityInput}
                onChange={handleCityChange}
              />
            </div>
          </div>

          {/* Quick Popular Governorate Chips */}
          <div className="quick-gov-bar">
            <span className="quick-gov-label">{t.quickGovLabel}</span>
            <div className="quick-gov-chips">
              {popularGovs.map((g) => {
                const isSelected = selectedGov === g.id && !savedOnly;
                return (
                  <button
                    key={g.id}
                    type="button"
                    className={`gov-shortcut-chip ${isSelected ? 'is-active' : ''}`}
                    onClick={() => handleQuickSelectGov(g.id)}
                  >
                    {lang === 'ar' ? g.ar : g.en}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Type, Urgent, Near Me & Saved Filter Chips */}
          <div className="filter-chips-row">
            <div className="filter-chips-group" role="group" aria-label={t.filterTypeLabel}>
              <button
                type="button"
                className={`filter-chip ${appliedType === '' && !savedOnly ? 'is-active' : ''}`}
                onClick={() => {
                  setSavedOnly(false);
                  handleTypeChipSelect('');
                }}
              >
                <span aria-hidden="true">🐾</span>
                <span>{t.filterAllTypes}</span>
              </button>

              <button
                type="button"
                className={`filter-chip ${appliedType === 'dog' ? 'is-active' : ''}`}
                onClick={() => handleTypeChipSelect('dog')}
              >
                <span aria-hidden="true">🐕</span>
                <span>{t.types.dog}</span>
              </button>

              <button
                type="button"
                className={`filter-chip ${appliedType === 'cat' ? 'is-active' : ''}`}
                onClick={() => handleTypeChipSelect('cat')}
              >
                <span aria-hidden="true">🐈</span>
                <span>{t.types.cat}</span>
              </button>

              <button
                type="button"
                className={`filter-chip chip-urgent ${urgentOnly ? 'is-active' : ''}`}
                onClick={handleToggleUrgent}
                aria-pressed={urgentOnly}
              >
                <span aria-hidden="true">🚨</span>
                <span>{t.filterUrgentOnly}</span>
              </button>

              <button
                type="button"
                className={`filter-chip chip-near-me ${sortByNearest ? 'is-active' : ''}`}
                onClick={handleNearMeSort}
                disabled={locatingNearMe}
                aria-pressed={sortByNearest}
              >
                <span aria-hidden="true">🧭</span>
                <span>
                  {locatingNearMe
                    ? t.nearMeLocating
                    : sortByNearest
                      ? t.nearMeActiveBtn
                      : t.nearMeBtn}
                </span>
              </button>

              <button
                type="button"
                className={`filter-chip chip-saved ${savedOnly ? 'is-active' : ''}`}
                onClick={handleToggleSavedOnly}
                aria-pressed={savedOnly}
              >
                <span aria-hidden="true">⭐</span>
                <span>{t.filterSavedOnly(savedPets.length)}</span>
              </button>
            </div>

            {selectedGov && !savedOnly && (
              <button
                type="submit"
                className="btn-refresh-inline"
                disabled={loading}
              >
                🔄 {loading ? t.searchingBtn : t.searchBtn}
              </button>
            )}
          </div>

          {/* Optional Distance Radius Sub-Bar when GPS is active */}
          {userCoords && (
            <div className="radius-filter-bar">
              {RADIUS_OPTIONS.map((km) => (
                <button
                  key={km}
                  type="button"
                  className={`radius-pill-btn ${radiusKm === km ? 'is-active' : ''}`}
                  onClick={() => {
                    setRadiusKm(km);
                    setPage(1);
                  }}
                >
                  {km === 0 ? t.radiusAll : t.radiusWithin(km)}
                </button>
              ))}
            </div>
          )}
        </form>
      </section>

      {loading ? (
        <div className="cards-list" aria-busy="true">
          {[1, 2, 3].map((n) => (
            <div key={n} className="surface-card skeleton-card">
              <div className="skeleton-photo" />
              <div className="skeleton-body">
                <div className="skeleton-line skeleton-title" />
                <div className="skeleton-line skeleton-text" />
                <div className="skeleton-line skeleton-btns" />
              </div>
            </div>
          ))}
        </div>
      ) : !searchedGov && !savedOnly ? (
        <div className="surface-card empty-state-box">
          <div className="empty-state-illustration" aria-hidden="true">
            🐕 🐈
          </div>
          <h2 className="empty-state-title">{t.selectGovPromptTitle}</h2>
          <p className="empty-state-text">{t.selectGovPrompt}</p>

          {/* Auto-Detect Governorate & Nearest Pets CTA */}
          <div className="empty-state-gps-cta">
            <button
              type="button"
              className="btn-primary btn-detect-gov"
              onClick={handleNearMeSort}
              disabled={locatingNearMe}
            >
              <span aria-hidden="true">📍</span>
              <span>{locatingNearMe ? t.nearMeLocating : t.detectMyGovBtn}</span>
            </button>
          </div>

          <div className="empty-state-gov-pills">
            {popularGovs.map((g) => (
              <button
                key={g.id}
                type="button"
                className="gov-shortcut-chip is-large"
                onClick={() => handleQuickSelectGov(g.id)}
              >
                📍 {lang === 'ar' ? g.ar : g.en}
              </button>
            ))}
          </div>
        </div>
      ) : filteredPets.length === 0 ? (
        <div className="surface-card empty-state-box">
          <div className="empty-state-illustration" aria-hidden="true">
            {savedOnly ? '⭐' : '🐾'}
          </div>
          <h2 className="empty-state-title">
            {savedOnly ? t.emptySavedTitle : t.emptyStateTitle}
          </h2>
          <p className="empty-state-text">
            {savedOnly ? t.emptySavedText : t.emptyState}
          </p>
          {hasActiveSubFilters && (
            <button
              type="button"
              className="btn-secondary"
              style={{ marginTop: '14px' }}
              onClick={handleResetFilters}
            >
              ↺ {t.resetFiltersBtn}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="results-toolbar">
            <div className="results-toolbar-left">
              <span className="showing-count">
                {t.showingCount(visiblePets.length, filteredPets.length)}
              </span>
              {hasActiveSubFilters && (
                <button
                  type="button"
                  className="btn-clear-filters"
                  onClick={handleResetFilters}
                >
                  ✕ {t.resetFiltersBtn}
                </button>
              )}
            </div>

            {/* List vs Interactive Map View Switcher */}
            <div className="view-mode-toggle" role="group" aria-label="View mode">
              <button
                type="button"
                className={`view-mode-btn ${viewMode === 'list' ? 'is-active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                <span aria-hidden="true">📋</span>
                <span>{t.viewListBtn}</span>
              </button>
              <button
                type="button"
                className={`view-mode-btn ${viewMode === 'map' ? 'is-active' : ''}`}
                onClick={() => setViewMode('map')}
              >
                <span aria-hidden="true">🗺️</span>
                <span>{t.viewMapBtn}</span>
              </button>
            </div>
          </div>

          {viewMode === 'map' ? (
            <PetMapView
              pets={filteredPets}
              selectedGov={selectedGov || (filteredPets[0] && filteredPets[0].gov)}
              userCoords={userCoords}
              lang={lang}
              savedIds={savedIds}
              onToggleSave={handleToggleSavePet}
              onOpenPoster={(pet) => setPosterPet(pet)}
              onMarkAdopted={handleMarkAdopted}
            />
          ) : (
            <>
              <div className="cards-list">
                {visiblePets.map((pet) => (
                  <PetCard
                    key={pet.id}
                    pet={pet}
                    lang={lang}
                    distanceKm={pet._distanceKm}
                    isSaved={savedIds.has(pet.id)}
                    onToggleSave={handleToggleSavePet}
                    onOpenPoster={(p) => setPosterPet(p)}
                    onMarkAdopted={handleMarkAdopted}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="pagination-box">
                  <button
                    type="button"
                    className="btn-secondary btn-load-more"
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t.loadMoreBtn}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {posterPet && (
        <RescuePosterModal
          pet={posterPet}
          lang={lang}
          onClose={() => setPosterPet(null)}
        />
      )}
    </div>
  );
}
