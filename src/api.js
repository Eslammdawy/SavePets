/**
 * Single networking & caching module (api.js)
 *
 * - Production endpoints: GET /api/list?gov=... and POST /api/post
 * - Local dev fallback only: VITE_GAS_URL
 * - Two-level client cache keyed by governorate only:
 *     1) In-memory Map with timestamps
 *     2) sessionStorage as backup
 *   Entries stay fresh for 5 minutes (300,000 ms).
 * - Rebuilds pet objects from compact { ok: true, h: [...], r: [[...]] } payload.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_PREFIX = 'sp_gov_cache_v1_';
const CLIENT_ID_KEY = 'sp_client_id_v1';

// Level 1: In-memory Map<gov, { ts: number, items: Array<Pet> }>
const memoryCache = new Map();

/**
 * Get or generate a persistent random client ID in localStorage for server rate-limiting.
 */
export function getClientId() {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id =
        'sp_' +
        Math.random().toString(36).slice(2, 11) +
        '_' +
        Date.now().toString(36);
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch (_e) {
    return 'sp_anon_' + Math.random().toString(36).slice(2, 10);
  }
}

/**
 * Determine base endpoints. Uses VITE_GAS_URL when configured (allowing direct
 * static `dist` uploads), or falls back to /api/list and /api/post edge functions.
 */
function getListUrl(gov) {
  const gasUrl = (import.meta.env.VITE_GAS_URL || '').trim();
  if (gasUrl) {
    return `${gasUrl}?action=list&gov=${encodeURIComponent(gov)}`;
  }
  return `/api/list?gov=${encodeURIComponent(gov)}`;
}

function getPostUrl() {
  const gasUrl = (import.meta.env.VITE_GAS_URL || '').trim();
  if (gasUrl) {
    return gasUrl;
  }
  return '/api/post';
}

/**
 * Rebuild array of pet objects from compact { h, r } response.
 */
function expandCompactResponse(data) {
  if (!data || !Array.isArray(data.h) || !Array.isArray(data.r)) {
    return [];
  }
  const headers = data.h;
  return data.r.map((row) => {
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = row[i];
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
          // Promote back into memory cache
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
 * Submit a new pet report.
 * Sends Content-Type: text/plain;charset=utf-8 to avoid CORS preflight.
 * Invalidates the affected governorate's client cache on success.
 */
export async function submitPetReport(payload) {
  const bodyObj = {
    action: 'add',
    clientId: getClientId(),
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
    throw new Error((json && json.error) || 'Failed to submit report.');
  }

  if (payload.gov) {
    invalidateGovCache(payload.gov);
  }

  return json;
}

/**
 * Mark a pet as adopted/rescued in the background.
 * Uses Content-Type: text/plain;charset=utf-8.
 */
export async function markPetAdopted(petId, gov) {
  // Immediately update/drop local cache
  if (gov) {
    removePetFromClientCache(gov, petId);
  }

  const res = await fetch(getPostUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action: 'markAdopted',
      id: petId
    })
  });

  const json = await res.json();
  if (!res.ok || !json || !json.ok) {
    throw new Error((json && json.error) || 'Failed to mark pet as adopted.');
  }

  if (gov) {
    invalidateGovCache(gov);
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
      clientId: getClientId(),
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

