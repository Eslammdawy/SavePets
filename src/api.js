/**
 * Single networking & caching module (api.js)
 *
 * - Production endpoints: GET /api/list?gov=..., GET /api/contact?id=..., and POST /api/post
 * - Local dev fallback only (when import.meta.env.DEV is true): VITE_GAS_URL
 * - Two-level client cache keyed by governorate only:
 *     1) In-memory Map with timestamps
 *     2) sessionStorage as backup
 *   Entries stay fresh for 5 minutes (300,000 ms).
 * - Rebuilds pet objects from compact { ok: true, h: [...], r: [[...]] } payload.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_PREFIX = 'sp_gov_cache_v1_';
const CLIENT_ID_KEY = 'sp_client_id_v1';
const REPORTER_PINS_KEY = 'sp_reporter_pins_v1';

// Level 1: In-memory Map<gov, { ts: number, items: Array<Pet> }>
const memoryCache = new Map();

/**
 * Generate a UUID v4 with fallback.
 */
export function generateUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or generate a persistent random client ID in localStorage.
 */
export function getClientId() {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = 'sp_' + generateUuid();
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch (_e) {
    return 'sp_anon_' + generateUuid();
  }
}

/**
 * Load stored reporter PINs map { [petId]: pin } from localStorage.
 */
function loadPinsMap() {
  try {
    const raw = localStorage.getItem(REPORTER_PINS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_e) {
    return {};
  }
}

/**
 * Save a 4-digit reporter PIN for a pet ID on this device.
 */
export function savePetPin(petId, pin) {
  if (!petId || !pin) return;
  try {
    const map = loadPinsMap();
    map[String(petId)] = String(pin).trim();
    localStorage.setItem(REPORTER_PINS_KEY, JSON.stringify(map));
  } catch (_e) {
    // Ignore storage errors
  }
}

/**
 * Get the stored 4-digit reporter PIN for a pet ID on this device, or ''.
 */
export function getPetPin(petId) {
  if (!petId) return '';
  const map = loadPinsMap();
  return String(map[String(petId)] || '');
}

/**
 * Return true if this device owns the pet report (has its 4-digit PIN stored).
 */
export function hasPetPin(petId) {
  return /^\d{4}$/.test(getPetPin(petId));
}

/**
 * Return VITE_GAS_URL only during local development (`import.meta.env.DEV`).
 * Never use VITE_GAS_URL in production builds.
 */
function getDevGasUrl() {
  if (!import.meta.env || !import.meta.env.DEV) {
    return '';
  }
  return (import.meta.env.VITE_GAS_URL || '').trim();
}

function getListUrl(gov) {
  const gasUrl = getDevGasUrl();
  if (gasUrl) {
    return `${gasUrl}?action=list&gov=${encodeURIComponent(gov)}`;
  }
  return `/api/list?gov=${encodeURIComponent(gov)}`;
}

function getContactUrl(petId) {
  const gasUrl = getDevGasUrl();
  if (gasUrl) {
    const devSecret = (import.meta.env.VITE_EDGE_SHARED_SECRET || '').trim();
    return `${gasUrl}?action=contact&id=${encodeURIComponent(petId)}&_ip=${encodeURIComponent(
      getClientId()
    )}&_secret=${encodeURIComponent(devSecret)}`;
  }
  return `/api/contact?id=${encodeURIComponent(petId)}`;
}

function getPostUrl() {
  const gasUrl = getDevGasUrl();
  if (gasUrl) {
    return gasUrl;
  }
  return '/api/post';
}

/**
 * Rebuild array of pet objects from compact { h, r } response.
 * Never exposes `contact` digits on pet objects; sets boolean `hc` instead.
 */
export function expandCompactResponse(data) {
  if (!data || !Array.isArray(data.h) || !Array.isArray(data.r)) {
    return [];
  }
  const headers = data.h;
  return data.r.map((row) => {
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = row[i];
    }
    if ('contact' in obj) {
      if (obj.hc === undefined) {
        obj.hc = Boolean(String(obj.contact || '').replace(/\D+/g, ''));
      }
      delete obj.contact;
    } else {
      obj.hc = Boolean(obj.hc);
    }
    return obj;
  });
}

/**
 * Check if a governorate has a fresh cached list (< 5 minutes old).
 * Checks memory first, then sessionStorage.
 */
export function getFreshCachedList(gov) {
  if (!gov) return null;
  const now = Date.now();

  // 1. Check in-memory Map first
  const memEntry = memoryCache.get(gov);
  if (memEntry && now - memEntry.ts < CACHE_TTL_MS) {
    return memEntry.items;
  }

  // 2. Check sessionStorage second
  try {
    const raw = sessionStorage.getItem(SESSION_PREFIX + gov);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.ts === 'number' && Array.isArray(parsed.items)) {
        if (now - parsed.ts < CACHE_TTL_MS) {
          memoryCache.set(gov, parsed);
          return parsed.items;
        }
      }
    }
  } catch (_e) {
    // Ignore sessionStorage errors in private browsing
  }

  return null;
}

/**
 * Save a governorate's pet list to both memory Map and sessionStorage.
 */
function saveToClientCache(gov, items, ts = Date.now()) {
  const entry = { ts, items };
  memoryCache.set(gov, entry);
  try {
    sessionStorage.setItem(SESSION_PREFIX + gov, JSON.stringify(entry));
  } catch (_e) {
    // Ignore quota errors
  }
}

/**
 * Drop the cached list for a specific governorate from memory and sessionStorage.
 */
export function invalidateGovCache(gov) {
  if (!gov) return;
  memoryCache.delete(gov);
  try {
    sessionStorage.removeItem(SESSION_PREFIX + gov);
  } catch (_e) {
    // Ignore
  }
}

/**
 * Remove a specific pet ID from the cached governorate list immediately
 * (both memory and sessionStorage).
 */
export function removePetFromClientCache(gov, petId) {
  if (!gov || !petId) return;
  const current = getFreshCachedList(gov) || (memoryCache.get(gov) && memoryCache.get(gov).items);
  if (Array.isArray(current)) {
    const memEntry = memoryCache.get(gov);
    const ts = memEntry ? memEntry.ts : Date.now();
    const updated = current.filter((p) => p.id !== petId);
    saveToClientCache(gov, updated, ts);
  }
}

/**
 * Fetch available pets for a governorate.
 * Uses the two-level client cache if fresh; otherwise fetches from network.
 */
export async function fetchPetsByGovernorate(gov) {
  const cached = getFreshCachedList(gov);
  if (cached !== null) {
    return cached;
  }

  const res = await fetch(getListUrl(gov), {
    method: 'GET'
  });

  const json = await res.json();
  if (!res.ok || !json || !json.ok) {
    throw new Error((json && json.error) || 'Failed to load pets.');
  }

  const items = expandCompactResponse(json);
  saveToClientCache(gov, items);
  return items;
}

/**
 * Fetch the contact phone number digits for a single pet ID on explicit user click.
 * Never cached.
 */
export async function fetchPetContact(petId) {
  if (!petId) {
    throw new Error('Missing pet ID.');
  }

  const res = await fetch(getContactUrl(petId), {
    method: 'GET',
    cache: 'no-store'
  });

  const json = await res.json();
  if (!res.ok || !json || !json.ok || !json.contact) {
    throw new Error((json && json.error) || 'Failed to load contact number.');
  }

  return String(json.contact).replace(/\D+/g, '');
}

/**
 * Submit a new pet report.
 * Sends Content-Type: text/plain;charset=utf-8 to avoid CORS preflight.
 * Invalidates the affected governorate's client cache on success and stores the returned PIN.
 */
export async function submitPetReport(payload) {
  const bodyObj = {
    action: 'add',
    ...payload
  };

  const res = await fetch(getPostUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(bodyObj)
  });

  const json = await res.json();
  if (!res.ok || !json || !json.ok) {
    const err = new Error((json && json.error) || 'Failed to submit report.');
    if (json && json.code) err.code = json.code;
    err.status = res.status;
    throw err;
  }

  if (json.id && json.pin) {
    savePetPin(json.id, json.pin);
  }

  if (payload.gov) {
    invalidateGovCache(payload.gov);
  }

  return json;
}

/**
 * Mark a pet as adopted/rescued using the reporter's 4-digit PIN.
 */
export async function markPetAdopted(petId, gov, pin = '') {
  const resolvedPin = String(pin || getPetPin(petId) || '').trim();
  if (!/^\d{4}$/.test(resolvedPin)) {
    throw new Error('Missing or invalid 4-digit reporter PIN.');
  }

  const res = await fetch(getPostUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action: 'markAdopted',
      id: petId,
      pin: resolvedPin
    })
  });

  const json = await res.json();
  if (!res.ok || !json || !json.ok) {
    throw new Error((json && json.error) || 'Failed to mark pet as adopted.');
  }

  if (gov) {
    removePetFromClientCache(gov, petId);
    invalidateGovCache(gov);
  }

  return json;
}

/**
 * Report a pet case as adopted/rescued for moderator review (for visitors without the PIN).
 * Does NOT alter the pet's status or remove it from the active list.
 */
export async function reportPetAdopted(petId, gov = '') {
  const res = await fetch(getPostUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action: 'reportAdopted',
      id: petId,
      gov
    })
  });

  const json = await res.json();
  if (!res.ok || !json || !json.ok) {
    throw new Error((json && json.error) || 'Failed to submit adoption report.');
  }

  return json;
}

/**
 * Build Google Drive thumbnail URL from photo_id.
 * Never returns or uses base64 from the backend.
 */
export function getDrivePhotoUrl(photoId) {
  if (!photoId) return '';
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(photoId)}&sz=w400`;
}

/**
 * Submit a follow-up comment on a pet case.
 * Non-blocking with graceful fallback.
 */
export async function submitComment(payload) {
  try {
    const bodyObj = {
      action: 'addComment',
      ...payload
    };

    const res = await fetch(getPostUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(bodyObj)
    });

    const json = await res.json();
    return json;
  } catch (err) {
    return { ok: false, offline: true, error: (err && err.message) || String(err) };
  }
}
