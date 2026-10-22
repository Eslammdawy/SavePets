import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GOVERNORATES, getGovernorateName, formatDistance, hasValidCoords } from './governorates';
import { DICT } from './i18n';
import PetCard from './PetCard';

function resolvePetMapCoords(pet) {
  if (!pet) return null;
  if (hasValidCoords(pet)) {
    return { lat: Number(pet.lat), lng: Number(pet.lng) };
  }
  const govObj = GOVERNORATES.find((g) => g.id === pet.gov);
  if (govObj) {
    return { lat: govObj.lat, lng: govObj.lng };
  }
  return null;
}

const LEAFLET_CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_CSS_SRI = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
const LEAFLET_JS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_JS_SRI = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';

function loadLeafletAssets() {
  if (typeof window !== 'undefined' && window.L) {
    return Promise.resolve(window.L);
  }

  return new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS_URL;
      link.integrity = LEAFLET_CSS_SRI;
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector(`script[src="${LEAFLET_JS_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.L));
      existingScript.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.src = LEAFLET_JS_URL;
    script.integrity = LEAFLET_JS_SRI;
    script.crossOrigin = '';
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function getPinColorClass(pet) {
  if (pet && pet.status === 'adopted') return 'pin-adopted';
  const cond = (pet && pet.cond) || 'unsure';
  if (cond === 'injured' || cond === 'sick') return 'pin-urgent';
  if (cond === 'pregnant') return 'pin-pregnant';
  if (cond === 'healthy') return 'pin-healthy';
  return 'pin-unsure';
}

function buildPetDivIcon(L, pet, isSelected) {
  const isAdopted = pet && pet.status === 'adopted';
  const emoji = isAdopted ? '🎉' : pet.type === 'cat' ? '🐈' : '🐕';
  const colorClass = getPinColorClass(pet);
  return L.divIcon({
    className: 'sp-map-div-icon',
    html: `<div class="sp-map-pin ${colorClass} ${isSelected ? 'is-selected-pin' : ''}"><span>${emoji}</span></div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21]
  });
}

export default function PetMapView({
  pets,
  selectedGov,
  userCoords,
  lang,
  savedIds,
  onToggleSave,
  onOpenPoster,
  onMarkAdopted
}) {
  const t = DICT[lang] || DICT.en;
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const markersByIdRef = useRef(new Map());
  const petsByIdRef = useRef(new Map());
  const prevSelectedIdRef = useRef(null);
  const lastFittedIdsSignatureRef = useRef('');

  const [leafletReady, setLeafletReady] = useState(
    Boolean(typeof window !== 'undefined' && window.L)
  );
  const [leafletError, setLeafletError] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState(
    () => (pets[0] && pets[0].id) || null
  );

  // Stable signature of pet IDs so markers and fitBounds only rebuild when the ID set changes
  const petIdsSignature = useMemo(
    () => (Array.isArray(pets) ? pets.map((p) => p.id).join(',') : ''),
    [pets]
  );

  // Keep a latest lookup map of pet objects by ID
  useEffect(() => {
    const map = new Map();
    if (Array.isArray(pets)) {
      for (const p of pets) {
        if (p && p.id) map.set(p.id, p);
      }
    }
    petsByIdRef.current = map;
  }, [pets]);

  // Keep selectedPetId valid when pets list changes
  useEffect(() => {
    if (!pets || pets.length === 0) {
      setSelectedPetId(null);
      return;
    }
    if (!pets.some((p) => p.id === selectedPetId)) {
      setSelectedPetId(pets[0].id);
    }
  }, [petIdsSignature, pets, selectedPetId]);

  // Load Leaflet once
  useEffect(() => {
    let mounted = true;
    setLeafletError(false);
    loadLeafletAssets()
      .then(() => {
        if (mounted) {
          setLeafletReady(true);
          setLeafletError(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setLeafletError(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Initialize Leaflet map instance
  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current || mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;

    const govObj = GOVERNORATES.find((g) => g.id === selectedGov) || GOVERNORATES[0];
    const initialCenter = userCoords
      ? [userCoords.lat, userCoords.lng]
      : [govObj.lat, govObj.lng];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 12,
      scrollWheelZoom: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      markersByIdRef.current.clear();
    };
  }, [leafletReady, selectedGov, userCoords]);

  // Effect 1: Rebuild markers and fitBounds ONLY when the pet ID list or userCoords change
  useEffect(() => {
    const L = window.L;
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!L || !map || !layer) return;

    layer.clearLayers();
    markersByIdRef.current.clear();
    const boundsPoints = [];

    const userLat = userCoords && Number(userCoords.lat);
    const userLng = userCoords && Number(userCoords.lng);
    if (Number.isFinite(userLat) && Number.isFinite(userLng)) {
      const userIcon = L.divIcon({
        className: 'sp-map-div-icon',
        html: `<div class="sp-map-pin pin-user" title="${t.mapLegendYou}">📍</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
      L.marker([userLat, userLng], { icon: userIcon }).addTo(layer);
      boundsPoints.push([userLat, userLng]);
    }

    const currentPets = Array.from(petsByIdRef.current.values());
    currentPets.forEach((pet) => {
      const resolved = resolvePetMapCoords(pet);
      if (!resolved) return;
      const { lat, lng } = resolved;

      boundsPoints.push([lat, lng]);
      const isSelected = pet.id === selectedPetId;
      const icon = buildPetDivIcon(L, pet, isSelected);

      const marker = L.marker([lat, lng], { icon }).addTo(layer);
      marker.on('click', () => {
        setSelectedPetId(pet.id);
        map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.5 });
      });
      markersByIdRef.current.set(pet.id, marker);
    });

    prevSelectedIdRef.current = selectedPetId;

    const coordsSig =
      Number.isFinite(userLat) && Number.isFinite(userLng)
        ? `${userLat},${userLng}`
        : '';
    const fullSig = `${petIdsSignature}|${coordsSig}`;
    if (lastFittedIdsSignatureRef.current !== fullSig) {
      lastFittedIdsSignatureRef.current = fullSig;
      if (boundsPoints.length === 1) {
        map.setView(boundsPoints[0], 14);
      } else if (boundsPoints.length > 1) {
        map.fitBounds(boundsPoints, { padding: [42, 42], maxZoom: 15 });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petIdsSignature, userCoords, leafletReady, t.mapLegendYou]);

  // Effect 2: Update ONLY the selected marker style when selectedPetId changes
  useEffect(() => {
    const L = window.L;
    if (!L) return;
    const prevId = prevSelectedIdRef.current;
    if (prevId === selectedPetId) return;

    if (prevId && markersByIdRef.current.has(prevId)) {
      const prevMarker = markersByIdRef.current.get(prevId);
      const prevPet = petsByIdRef.current.get(prevId);
      if (prevMarker && prevPet) {
        prevMarker.setIcon(buildPetDivIcon(L, prevPet, false));
      }
    }

    if (selectedPetId && markersByIdRef.current.has(selectedPetId)) {
      const nextMarker = markersByIdRef.current.get(selectedPetId);
      const nextPet = petsByIdRef.current.get(selectedPetId);
      if (nextMarker && nextPet) {
        nextMarker.setIcon(buildPetDivIcon(L, nextPet, true));
      }
    }

    prevSelectedIdRef.current = selectedPetId;
  }, [selectedPetId, leafletReady]);

  function handleSelectPetPin(pet) {
    setSelectedPetId(pet.id);
    const map = mapInstanceRef.current;
    const resolved = resolvePetMapCoords(pet);
    if (map && resolved) {
      map.flyTo([resolved.lat, resolved.lng], 15, { duration: 0.55 });
    }
  }

  const activePet = pets.find((p) => p.id === selectedPetId) || pets[0] || null;

  return (
    <div className="map-view-wrapper">
      <div className="surface-card map-card-shell">
        {/* Map Color Legend */}
        <div className="map-legend-bar">
          <span className="map-legend-item">
            <span className="legend-dot dot-urgent" />
            {t.mapLegendUrgent}
          </span>
          <span className="map-legend-item">
            <span className="legend-dot dot-pregnant" />
            {t.mapLegendPregnant}
          </span>
          <span className="map-legend-item">
            <span className="legend-dot dot-healthy" />
            {t.mapLegendHealthy}
          </span>
          {userCoords && (
            <span className="map-legend-item">
              <span className="legend-dot dot-user" />
              {t.mapLegendYou}
            </span>
          )}
        </div>

        {/* Visible Error Message if Leaflet Fails to Load */}
        {leafletError ? (
          <div className="alert-box alert-error" role="alert" style={{ marginBottom: 12 }}>
            <span aria-hidden="true">⚠️</span>
            <span>{t.mapLoadError}</span>
          </div>
        ) : (
          <div ref={mapContainerRef} className="sp-leaflet-container" />
        )}

        {/* Quick Pet Pin Selector Strip */}
        <div className="map-pin-strip">
          <div className="map-pin-hint">{t.mapClickPinHint}</div>
          <div className="map-pin-chips-scroll">
            {pets.map((pet) => {
              const isSelected = activePet && activePet.id === pet.id;
              const emoji = pet.type === 'cat' ? '🐈' : '🐕';
              const govName = getGovernorateName(pet.gov, lang);
              const cityLabel = String(pet.city || '').trim() || govName;
              const distText =
                typeof pet._distanceKm === 'number'
                  ? ` • ${formatDistance(pet._distanceKm, lang)}`
                  : '';
              return (
                <button
                  key={pet.id}
                  type="button"
                  className={`map-pin-chip ${isSelected ? 'is-active' : ''}`}
                  onClick={() => handleSelectPetPin(pet)}
                >
                  <span>{emoji}</span>
                  <span>
                    {cityLabel}
                    {distText}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Pet Inspector Card */}
      {activePet && (
        <div className="map-selected-pet-wrap">
          <PetCard
            pet={activePet}
            lang={lang}
            distanceKm={activePet._distanceKm}
            isSaved={savedIds.has(activePet.id)}
            onToggleSave={onToggleSave}
            onOpenPoster={onOpenPoster}
            onMarkAdopted={onMarkAdopted}
          />
        </div>
      )}
    </div>
  );
}
