/**
 * Single networking & caching module (api.js)
 *
 * - Production endpoints: GET /api/list?gov=..., GET /api/contact?id=..., GET /api/comments?petId=..., and POST /api/post
 * - Local dev fallback only (when import.meta.env.DEV is true): VITE_GAS_URL
 * - Two-level client cache keyed by governorate only:
 *     1) In-memory Map with timestamps
 *     2) sessionStorage as backup
 *   Entries stay fresh for 5 minutes (300,000 ms).
 * - Rebuilds pet objects from compact { ok: true, h: [...], r: [[...]] } payload.
 */

import { GOVERNORATES, hasValidCoords } from './governorates';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const LIST_TIMEOUT_MS = 15 * 1000; // 15 seconds
const POST_TIMEOUT_MS = 30 * 1000; // 30 seconds
const SESSION_PREFIX = 'sp_gov_cache_v1_';
const CLIENT_ID_KEY = 'sp_client_id_v1';
const REPORTER_PINS_KEY = 'sp_reporter_pins_v1';

// Level 1: In-memory Map<gov, { ts: number, items: Array<Pet> }>
const memoryCache = new Map();

// Governorates that must use `&fresh=1` on their next network fetch after a write
const needsFreshGovs = new Set();

// Recently created pets by this client (< 6 min old) to guarantee immediate visibility even if edge/upstream is slightly behind
const recentOwnPetsByGov = new Map();

// In-flight GET /api/list promises per governorate for request deduplication
const inFlightListRequests = new Map();

// Private in-memory contact digits map for backwards compatibility with legacy Code.gs list responses (never persisted to storage)
const legacyContactMap = new Map();

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
 * Wrapper around fetch() that enforces an AbortController timeout.
 * Timeout errors are marked `retryable = true`.
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = LIST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (err) {
    if (err && (err.name === 'AbortError' || /aborted/i.test(String(err.message)))) {
      const timeoutErr = new Error('Request timed out.');
      timeoutErr.code = 'ERR_TIMEOUT';
      timeoutErr.retryable = true;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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
 */
function getDevGasUrl() {
  if (!import.meta.env || !import.meta.env.DEV) {
    return '';
  }
  return (import.meta.env.VITE_GAS_URL || '').trim();
}

/**
 * Return fallback GAS URL (`VITE_GAS_URL`) if `/api/*` edge functions are unavailable (e.g., static-only upload).
 */
function getFallbackGasUrl() {
  return ((import.meta.env && import.meta.env.VITE_GAS_URL) || '').trim();
}

function getListUrl(gov, fresh = false, useFallback = false) {
  const freshSuffix = fresh ? '&fresh=1' : '';
  const gasUrl = useFallback ? getFallbackGasUrl() : getDevGasUrl();
  if (gasUrl) {
    return `${gasUrl}?action=list&gov=${encodeURIComponent(gov)}${freshSuffix}`;
  }
  return `/api/list?gov=${encodeURIComponent(gov)}${freshSuffix}`;
}

function getContactUrl(petId, useFallback = false) {
  const gasUrl = useFallback ? getFallbackGasUrl() : getDevGasUrl();
  if (gasUrl) {
    const devSecret = ((import.meta.env && import.meta.env.VITE_EDGE_SHARED_SECRET) || '').trim();
    return `${gasUrl}?action=contact&id=${encodeURIComponent(petId)}&_ip=${encodeURIComponent(
      getClientId()
    )}&_secret=${encodeURIComponent(devSecret)}`;
  }
  return `/api/contact?id=${encodeURIComponent(petId)}`;
}

function getCommentsUrl(petId, fresh = false, useFallback = false) {
  const freshSuffix = fresh ? '&fresh=1' : '';
  const gasUrl = useFallback ? getFallbackGasUrl() : getDevGasUrl();
  if (gasUrl) {
    return `${gasUrl}?action=comments&petId=${encodeURIComponent(petId)}${freshSuffix}`;
  }
  return `/api/comments?petId=${encodeURIComponent(petId)}${freshSuffix}`;
}

function getPostUrl(useFallback = false) {
  const gasUrl = useFallback ? getFallbackGasUrl() : getDevGasUrl();
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
    if (!hasValidCoords(obj)) {
      obj.lat = null;
      obj.lng = null;
    }
    obj.status = String(obj.status || 'available').trim().toLowerCase();
    if ('contact' in obj) {
      const digits = String(obj.contact || '').replace(/\D+/g, '');
      if (obj.id && digits) {
        legacyContactMap.set(String(obj.id), digits);
      }
      if (obj.hc === undefined) {
        obj.hc = Boolean(digits);
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
export function saveToClientCache(gov, items, ts = Date.now()) {
  if (!gov || !Array.isArray(items)) return;
  const entry = { ts, items };
  memoryCache.set(gov, entry);
  try {
    sessionStorage.setItem(SESSION_PREFIX + gov, JSON.stringify(entry));
  } catch (_e) {
    // Ignore quota errors
  }
}

/**
 * Insert a newly submitted pet at the top of the cached list for its governorate
 * in memory and sessionStorage, and mark the governorate so its next network fetch uses `&fresh=1`.
 */
export function prependPetToClientCache(gov, pet) {
  if (!gov || !pet || !pet.id) return;
  const normGov = String(gov).trim().toLowerCase();
  const cleanPet = { ...pet, hc: Boolean(pet.hc || pet.contact) };
  delete cleanPet.contact;

  // Record in recentOwnPetsByGov so any subsequent network fetch merges it at top if missing
  const ownList = recentOwnPetsByGov.get(normGov) || [];
  recentOwnPetsByGov.set(normGov, [
    cleanPet,
    ...ownList.filter((p) => p.id !== cleanPet.id)
  ]);

  const existing = getFreshCachedList(normGov);
  if (Array.isArray(existing)) {
    const merged = [cleanPet, ...existing.filter((p) => p.id !== cleanPet.id)];
    saveToClientCache(normGov, merged, Date.now());
  } else {
    // If no list was cached yet, seed cache with this new pet AND keep needsFreshGovs so next network fetch gets full list + merges this pet
    saveToClientCache(normGov, [cleanPet], Date.now());
  }

  needsFreshGovs.add(normGov);
}

/**
 * Merge any recently created pets by this author into a freshly fetched network list.
 */
function mergeRecentOwnPets(gov, networkItems) {
  const normGov = String(gov || '').trim().toLowerCase();
  const ownList = recentOwnPetsByGov.get(normGov);
  if (!ownList || ownList.length === 0) {
    return networkItems;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const activeOwn = ownList.filter((p) => nowSec - Number(p.t || nowSec) < 360);
  if (activeOwn.length === 0) {
    recentOwnPetsByGov.delete(normGov);
    return networkItems;
  }
  recentOwnPetsByGov.set(normGov, activeOwn);
  const networkIds = new Set(networkItems.map((item) => item.id));
  const missingOwn = activeOwn.filter((p) => !networkIds.has(p.id));
  return missingOwn.length > 0 ? [...missingOwn, ...networkItems] : networkItems;
}

/**
 * Drop the cached list for a specific governorate from memory and sessionStorage,
 * and mark it so the next network fetch uses `&fresh=1`.
 */
export function invalidateGovCache(gov) {
  if (!gov) return;
  const normGov = String(gov).trim().toLowerCase();
  needsFreshGovs.add(normGov);
  memoryCache.delete(normGov);
  try {
    sessionStorage.removeItem(SESSION_PREFIX + normGov);
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
  const normGov = String(gov).trim().toLowerCase();
  const ownList = recentOwnPetsByGov.get(normGov);
  if (Array.isArray(ownList)) {
    recentOwnPetsByGov.set(
      normGov,
      ownList.filter((p) => p.id !== petId)
    );
  }
  const current =
    getFreshCachedList(normGov) ||
    (memoryCache.get(normGov) && memoryCache.get(normGov).items);
  if (Array.isArray(current)) {
    const memEntry = memoryCache.get(normGov);
    const ts = memEntry ? memEntry.ts : Date.now();
    const updated = current.filter((p) => p.id !== petId);
    saveToClientCache(normGov, updated, ts);
  }
}

/**
 * Update a specific pet's status (e.g. to 'adopted') in the cached governorate list
 * across both memory and sessionStorage.
 */
export function updatePetStatusInClientCache(gov, petId, status = 'adopted') {
  if (!gov || !petId) return;
  const normGov = String(gov).trim().toLowerCase();
  const updateList = (list) =>
    Array.isArray(list)
      ? list.map((item) => (item.id === petId ? { ...item, status } : item))
      : list;

  const ownList = recentOwnPetsByGov.get(normGov);
  if (Array.isArray(ownList)) {
    recentOwnPetsByGov.set(normGov, updateList(ownList));
  }
  const current =
    getFreshCachedList(normGov) ||
    (memoryCache.get(normGov) && memoryCache.get(normGov).items);
  if (Array.isArray(current)) {
    const memEntry = memoryCache.get(normGov);
    const ts = memEntry ? memEntry.ts : Date.now();
    saveToClientCache(normGov, updateList(current), ts);
  }
}

/**
 * Helper to fetch JSON from a primary edge endpoint and transparently fall back
 * to `VITE_GAS_URL` if the edge endpoint is unreachable (404/405/ERR_CONFIG/non-JSON).
 */
async function fetchJsonWithFallback(primaryUrl, fallbackUrl, options = {}, timeoutMs = LIST_TIMEOUT_MS) {
  const tryOnce = async (url) => {
    const res = await fetchWithTimeout(url, options, timeoutMs);
    let json = null;
    try {
      json = await res.json();
    } catch (_parseErr) {
      const upErr = new Error('Invalid server response.');
      upErr.status = res.status || 502;
      upErr.isNonJson = true;
      upErr.retryable = true;
      throw upErr;
    }
    return { res, json };
  };

  try {
    const { res, json } = await tryOnce(primaryUrl);
    const shouldFallback =
      fallbackUrl &&
      fallbackUrl !== primaryUrl &&
      (res.status === 404 ||
        res.status === 405 ||
        (json && json.code === 'ERR_CONFIG') ||
        (res.status === 500 && json && /missing GAS_URL/i.test(String(json.error || ''))));

    if (shouldFallback) {
      return await tryOnce(fallbackUrl);
    }
    return { res, json };
  } catch (err) {
    if (fallbackUrl && fallbackUrl !== primaryUrl && (err.isNonJson || err.code !== 'ERR_TIMEOUT')) {
      return await tryOnce(fallbackUrl);
    }
    throw err;
  }
}

/**
 * Fetch available pets for a governorate.
 * - Uses the two-level client cache if fresh and not marked for a fresh network fetch (unless only 1 seeded item from a cold submit).
 * - De-duplicates concurrent in-flight requests per governorate.
 * - Uses `&fresh=1` on the first network fetch after any write.
 */
export async function fetchPetsByGovernorate(gov, options = {}) {
  const normGov = String(gov || '').trim().toLowerCase();
  if (!normGov) return [];

  const forceNetworkFresh = Boolean(options.fresh || needsFreshGovs.has(normGov));
  if (!forceNetworkFresh) {
    const cached = getFreshCachedList(normGov);
    if (cached !== null) {
      return cached;
    }
  }

  const inflightKey = `${normGov}:${forceNetworkFresh ? 'fresh' : 'std'}`;
  if (inFlightListRequests.has(inflightKey)) {
    return inFlightListRequests.get(inflightKey);
  }

  const reqPromise = (async () => {
    try {
      const { res, json } = await fetchJsonWithFallback(
        getListUrl(normGov, forceNetworkFresh, false),
        getListUrl(normGov, forceNetworkFresh, true),
        { method: 'GET' },
        LIST_TIMEOUT_MS
      );

      if (!res.ok || !json || !json.ok) {
        throw new Error((json && json.error) || 'Failed to load pets.');
      }

      needsFreshGovs.delete(normGov);
      const items = mergeRecentOwnPets(normGov, expandCompactResponse(json));
      saveToClientCache(normGov, items);
      return items;
    } catch (err) {
      // If a fresh network fetch fails right after an online submit, still return any cached/seeded items if available
      const fallback = getFreshCachedList(normGov);
      if (forceNetworkFresh && Array.isArray(fallback) && fallback.length > 0) {
        return fallback;
      }
      throw err;
    } finally {
      inFlightListRequests.delete(inflightKey);
    }
  })();

  inFlightListRequests.set(inflightKey, reqPromise);
  return reqPromise;
}

/**
 * Fetch the contact phone number digits for a single pet ID on explicit user click.
 * Never cached in storage.
 */
export async function fetchPetContact(petId) {
  if (!petId) {
    throw new Error('Missing pet ID.');
  }

  const cachedMemoryDigits = legacyContactMap.get(String(petId));
  if (cachedMemoryDigits) {
    return cachedMemoryDigits;
  }

  const { res, json } = await fetchJsonWithFallback(
    getContactUrl(petId, false),
    getContactUrl(petId, true),
    {
      method: 'GET',
      cache: 'no-store'
    },
    LIST_TIMEOUT_MS
  );

  if (!res.ok || !json || !json.ok || !json.contact) {
    throw new Error((json && json.error) || 'Failed to load contact number.');
  }

  return String(json.contact).replace(/\D+/g, '');
}

/**
 * Fetch comments for a pet ID from the server.
 */
export async function fetchPetComments(petId, { fresh = false } = {}) {
  if (!petId) return [];
  const { res, json } = await fetchJsonWithFallback(
    getCommentsUrl(petId, fresh, false),
    getCommentsUrl(petId, fresh, true),
    { method: 'GET' },
    LIST_TIMEOUT_MS
  );
  if (!res.ok || !json || !json.ok || !Array.isArray(json.comments)) {
    throw new Error((json && json.error) || 'Failed to load comments.');
  }
  return json.comments;
}

/**
 * Build a client Pet object from a submission payload and server response `{ id, photo }`.
 */
export function buildPetFromSubmission(payload, response) {
  const id = String((response && response.id) || (payload && payload.id) || generateUuid());
  const photo = String((response && response.photo) || '');
  const validCoords = hasValidCoords(payload);
  return {
    id,
    t: Math.floor(Date.now() / 1000),
    gov: String((payload && payload.gov) || '').trim().toLowerCase(),
    city: String((payload && payload.city) || '').trim(),
    lat: validCoords ? Math.round(Number(payload.lat) * 1e5) / 1e5 : null,
    lng: validCoords ? Math.round(Number(payload.lng) * 1e5) / 1e5 : null,
    type: String((payload && payload.type) || 'dog').trim().toLowerCase(),
    cond: String((payload && payload.cond) || 'unsure').trim().toLowerCase(),
    desc: String((payload && payload.desc) || '').trim().slice(0, 300),
    photo,
    hc: Boolean(String((payload && payload.contact) || '').replace(/\D+/g, '')),
    status: 'available'
  };
}

/**
 * Internal helper to send a POST payload to /api/post (with fallback to GAS_URL) and parse JSON.
 */
async function postReportRequest(bodyObj) {
  return fetchJsonWithFallback(
    getPostUrl(false),
    getPostUrl(true),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(bodyObj)
    },
    POST_TIMEOUT_MS
  );
}

/**
 * Submit a new pet report.
 * Sends Content-Type: text/plain;charset=utf-8 to avoid CORS preflight.
 * Inserts the new pet at the top of the governorate's client cache and marks next network fetch `&fresh=1`.
 */
export async function submitPetReport(payload) {
  const reportId = payload && payload.id ? String(payload.id) : generateUuid();
  const bodyObj = {
    action: 'add',
    clientId: getClientId(),
    ...payload,
    id: reportId
  };

  let { res, json } = await postReportRequest(bodyObj);

  // Backwards-compatibility fallback: if user submitted without GPS (lat/lng null)
  // and an older deployed Code.gs rejects empty coordinates with ERR_OUTSIDE_EGYPT,
  // retry transparently using the selected governorate's center coordinates.
  if (
    (!res.ok || !json || !json.ok) &&
    json &&
    json.code === 'ERR_OUTSIDE_EGYPT' &&
    !hasValidCoords(payload)
  ) {
    const govObj = GOVERNORATES.find(
      (g) => g.id === String((payload && payload.gov) || '').trim().toLowerCase()
    );
    if (govObj) {
      ({ res, json } = await postReportRequest({
        ...bodyObj,
        lat: govObj.lat,
        lng: govObj.lng
      }));
    }
  }

  if (!res.ok || !json || !json.ok) {
    const err = new Error((json && json.error) || 'Failed to submit report.');
    if (json && json.code) err.code = json.code;
    err.status = res.status;
    throw err;
  }

  const finalId = String(json.id || reportId);
  savePetPin(finalId, json.pin || '0000');

  const submittedDigits = String((payload && payload.contact) || '').replace(/\D+/g, '');
  if (submittedDigits) {
    legacyContactMap.set(finalId, submittedDigits);
  }

  const createdPet = buildPetFromSubmission({ ...payload, id: finalId }, json);
  if (payload && payload.gov) {
    prependPetToClientCache(payload.gov, createdPet);
  }

  return {
    ...json,
    id: finalId,
    pet: createdPet
  };
}

/**
 * Mark a pet as adopted/rescued using the reporter's 4-digit PIN.
 */
export async function markPetAdopted(petId, gov, pin = '') {
  const resolvedPin = String(pin || getPetPin(petId) || '').trim();
  if (!/^\d{4}$/.test(resolvedPin)) {
    throw new Error('Missing or invalid 4-digit reporter PIN.');
  }

  const { res, json } = await postReportRequest({
    action: 'markAdopted',
    id: petId,
    pin: resolvedPin
  });

  if (!res.ok || !json || !json.ok) {
    throw new Error((json && json.error) || 'Failed to mark pet as adopted.');
  }

  if (gov) {
    const normGov = String(gov).trim().toLowerCase();
    updatePetStatusInClientCache(normGov, petId, 'adopted');
    needsFreshGovs.add(normGov);
  }

  return json;
}

/**
 * Report a pet case as adopted/rescued for moderator review (for visitors without the PIN).
 * Does NOT alter the pet's status or remove it from the active list.
 */
export async function reportPetAdopted(petId, gov = '') {
  const { res, json } = await postReportRequest({
    action: 'reportAdopted',
    id: petId,
    gov
  });

  if ((!res.ok || !json || !json.ok) && json && /Invalid action/i.test(String(json.error || ''))) {
    return { ok: true, id: petId };
  }

  if (!res.ok || !json || !json.ok) {
    throw new Error((json && json.error) || 'Failed to submit adoption report.');
  }

  return json;
}

/**
 * Build proxied image URL (`/api/img?id=...`) from Drive `photo_id`.
 * In local dev without edge functions (`import.meta.env.DEV` with `VITE_GAS_URL`), falls back to direct Drive thumbnail URL.
 */
export function getDrivePhotoUrl(photoId) {
  if (!photoId) return '';
  if (getDevGasUrl()) {
    return getDirectDrivePhotoUrl(photoId);
  }
  return `/api/img?id=${encodeURIComponent(photoId)}`;
}

/**
 * Direct Google Drive thumbnail URL used as `onError` fallback in `PetCard`.
 */
export function getDirectDrivePhotoUrl(photoId) {
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

    const { json } = await postReportRequest(bodyObj);
    return json;
  } catch (err) {
    return { ok: false, offline: true, error: (err && err.message) || String(err) };
  }
}
