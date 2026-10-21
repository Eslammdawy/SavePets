import { submitComment, fetchPetComments, generateUuid } from './api';

const COMMENTS_STORAGE_KEY = 'sp_pet_comments_v1';
const COMMENTS_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes per pet

// In-memory per-pet fetch timestamp cache: Map<petId, number>
const fetchedAtByPet = new Map();
const inFlightCommentFetches = new Map();

/**
 * Load all comments map from localStorage: Record<petId, Comment[]>
 */
function getStoredCommentsMap() {
  try {
    const raw = localStorage.getItem(COMMENTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_e) {
    return {};
  }
}

/**
 * Persist comments map to localStorage.
 */
function saveCommentsMap(map) {
  try {
    localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(map));
  } catch (_e) {
    // Ignore storage quota errors
  }
}

/**
 * Merge two arrays of comments by `id`, sorted oldest-first by `ts`.
 */
function mergeCommentsById(existingList = [], incomingList = []) {
  const byId = new Map();
  for (const item of existingList) {
    if (item && item.id) {
      byId.set(String(item.id), item);
    }
  }
  for (const item of incomingList) {
    if (item && item.id) {
      byId.set(String(item.id), {
        id: String(item.id),
        petId: String(item.petId || ''),
        author: String(item.author || ''),
        text: String(item.text || ''),
        ts: Number(item.ts) || Date.now()
      });
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => Number(a.ts || 0) - Number(b.ts || 0)
  );
}

/**
 * Load locally stored comments array for a specific pet.
 */
export function loadPetComments(petId) {
  if (!petId) return [];
  const map = getStoredCommentsMap();
  const list = map[petId];
  return Array.isArray(list) ? list : [];
}

/**
 * Get count of locally known comments for a specific pet.
 */
export function getPetCommentsCount(petId) {
  if (!petId) return 0;
  return loadPetComments(petId).length;
}

/**
 * Fetch comments for a pet from the server when the comment tray opens,
 * merge with local optimistic comments by `id`, and cache per pet for 3 minutes.
 */
export async function syncPetComments(petId, { force = false } = {}) {
  if (!petId) return [];
  const now = Date.now();
  const lastFetched = fetchedAtByPet.get(petId) || 0;
  if (!force && now - lastFetched < COMMENTS_CACHE_TTL_MS) {
    return loadPetComments(petId);
  }

  if (inFlightCommentFetches.has(petId)) {
    return inFlightCommentFetches.get(petId);
  }

  const reqPromise = (async () => {
    try {
      const remoteComments = await fetchPetComments(petId, { fresh: force });
      const map = getStoredCommentsMap();
      const localList = Array.isArray(map[petId]) ? map[petId] : [];
      const merged = mergeCommentsById(localList, remoteComments);
      map[petId] = merged;
      saveCommentsMap(map);
      fetchedAtByPet.set(petId, Date.now());

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sp-comments-changed', {
            detail: { petId }
          })
        );
      }

      return merged;
    } catch (_err) {
      return loadPetComments(petId);
    } finally {
      inFlightCommentFetches.delete(petId);
    }
  })();

  inFlightCommentFetches.set(petId, reqPromise);
  return reqPromise;
}

/**
 * Add a new comment/follow-up on a pet.
 * Persists locally immediately and syncs with backend in background.
 */
export async function addPetComment(
  petId,
  { author = '', text = '', website = '' } = {}
) {
  const cleanText = String(text || '').trim().slice(0, 500);
  if (!petId || !cleanText) {
    throw new Error('Comment text is required.');
  }

  // Honeypot check on client side
  if (website && String(website).trim() !== '') {
    return loadPetComments(petId);
  }

  const cleanAuthor = String(author || '').trim().slice(0, 60);
  const newComment = {
    id: generateUuid(),
    petId,
    author: cleanAuthor,
    text: cleanText,
    ts: Date.now()
  };

  const map = getStoredCommentsMap();
  const currentList = Array.isArray(map[petId]) ? map[petId] : [];
  const updatedList = mergeCommentsById(currentList, [newComment]);
  map[petId] = updatedList;

  saveCommentsMap(map);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('sp-comments-changed', {
        detail: { petId, comment: newComment }
      })
    );
  }

  const res = await submitComment({
    petId,
    author: cleanAuthor,
    text: cleanText,
    commentId: newComment.id,
    website: ''
  });

  if (res && res.ok && res.ts) {
    const freshMap = getStoredCommentsMap();
    const list = Array.isArray(freshMap[petId]) ? freshMap[petId] : [];
    freshMap[petId] = mergeCommentsById(list, [
      { ...newComment, ts: Number(res.ts) || newComment.ts }
    ]);
    saveCommentsMap(freshMap);
    fetchedAtByPet.set(petId, Date.now());
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sp-comments-changed', {
          detail: { petId }
        })
      );
    }
    return freshMap[petId];
  }

  if (res && !res.ok && !res.offline && res.error) {
    // Roll back optimistic comment if server rejected it (e.g. rate limit or invalid petId)
    const rollbackMap = getStoredCommentsMap();
    const list = Array.isArray(rollbackMap[petId]) ? rollbackMap[petId] : [];
    rollbackMap[petId] = list.filter((c) => c.id !== newComment.id);
    saveCommentsMap(rollbackMap);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sp-comments-changed', {
          detail: { petId }
        })
      );
    }
    throw new Error(res.error);
  }

  return updatedList;
}
