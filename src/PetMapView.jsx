import React, { useEffect, useRef, useState } from 'react';
import { GOVERNORATES, getGovernorateName, formatDistance } from './governorates';
import { DICT } from './i18n';
import PetCard from './PetCard';

const LEAFLET_CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

function loadLeafletAssets() {
  if (typeof window !== 'undefined' && window.L) {
    return Promise.resolve(window.L);
  }

  return new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS_URL;
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
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function getPinColorClass(cond) {
  if (cond === 'injured' || cond === 'sick') return 'pin-urgent';
  if (cond === 'pregnant') return 'pin-pregnant';
  if (cond === 'healthy') return 'pin-healthy';
  return 'pin-unsure';
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

  const [leafletReady, setLeafletReady] = useState(Boolean(typeof window !== 'undefined' && window.L));
  const [selectedPetId, setSelectedPetId] = useState(() => (pets[0] && pets[0].id) || null);

  // Keep selectedPetId valid when pets list changes
  useEffect(() => {
    if (!pets || pets.length === 0) {
      setSelectedPetId(null);
      return;
    }
    if (!pets.some((p) => p.id === selectedPetId)) {
      setSelectedPetId(pets[0].id);
    }
  }, [pets, selectedPetId]);

  // Load Leaflet once
  useEffect(() => {
    let mounted = true;
    loadLeafletAssets()
      .then(() => {
        if (mounted) setLeafletReady(true);
      })
      .catch(() => {
        // Fallback still renders interactive list selector
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
    };
  }, [leafletReady]);

  // Sync markers whenever pets, userCoords, or selectedPetId change
  useEffect(() => {
    const L = window.L;
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!L || !map || !layer) return;

    layer.clearLayers();
    const boundsPoints = [];

    if (userCoords && Number.isFinite(userCoords.lat) && Number.isFinite(userCoords.lng)) {
      const userIcon = L.divIcon({
        className: 'sp-map-div-icon',
        html: `<div class="sp-map-pin pin-user" title="${t.mapLegendYou}">📍</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
      L.marker([userCoords.lat, userCoords.lng], { icon: userIcon }).addTo(layer);
      boundsPoints.push([userCoords.lat, userCoords.lng]);
    }

    pets.forEach((pet) => {
      const lat = Number(pet.lat);
      const lng = Number(pet.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      boundsPoints.push([lat, lng]);
      const isSelected = pet.id === selectedPetId;
      const emoji = pet.type === 'cat' ? '🐈' : '🐕';
      const colorClass = getPinColorClass(pet.cond);

      const icon = L.divIcon({
        className: 'sp-map-div-icon',
        html: `<div class="sp-map-pin ${colorClass} ${isSelected ? 'is-selected-pin' : ''}"><span>${emoji}</span></div>`,
        iconSize: [42, 42],
        iconAnchor: [21, 21]
      });

      const marker = L.marker([lat, lng], { icon }).addTo(layer);
      marker.on('click', () => {
        setSelectedPetId(pet.id);
        map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.5 });
      });
    });

    if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 14);
    } else if (boundsPoints.length > 1) {
      map.fitBounds(boundsPoints, { padding: [42, 42], maxZoom: 15 });
    }
  }, [pets, userCoords, leafletReady, t.mapLegendYou]);

  function handleSelectPetPin(pet) {
    setSelectedPetId(pet.id);
    const map = mapInstanceRef.current;
    const lat = Number(pet.lat);
    const lng = Number(pet.lng);
    if (map && Number.isFinite(lat) && Number.isFinite(lng)) {
      map.flyTo([lat, lng], 15, { duration: 0.55 });
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

        {/* Leaflet Map Canvas */}
        <div ref={mapContainerRef} className="sp-leaflet-container" />

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
