import { submitComment } from './api';

const COMMENTS_STORAGE_KEY = 'sp_pet_comments_v1';

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
 * Load comments array for a specific pet.
 */
export function loadPetComments(petId) {
  if (!petId) return [];
  const map = getStoredCommentsMap();
  const list = map[petId];
  return Array.isArray(list) ? list : [];
}

/**
 * Get count of comments for a specific pet.
 */
export function getPetCommentsCount(petId) {
  if (!petId) return 0;
  return loadPetComments(petId).length;
}

/**
 * Add a new comment/follow-up on a pet.
 * Persists locally immediately and syncs with backend in background.
 */
export function addPetComment(petId, { author = '', text = '' } = {}) {
  const cleanText = String(text || '').trim().slice(0, 500);
  if (!petId || !cleanText) {
    throw new Error('Comment text is required.');
  }

  const cleanAuthor = String(author || '').trim().slice(0, 60);
  const newComment = {
    id: 'cmt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    petId,
    author: cleanAuthor,
    text: cleanText,
    ts: Date.now()
  };

  const map = getStoredCommentsMap();
  const currentList = Array.isArray(map[petId]) ? map[petId] : [];
  const updatedList = [...currentList, newComment];
  map[petId] = updatedList;

  saveCommentsMap(map);

  // Dispatch custom event for reactive real-time UI updates across cards
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('sp-comments-changed', {
        detail: { petId, comment: newComment }
      })
    );
  }

  // Attempt backend persistence in the background (non-blocking)
  submitComment({
    petId,
    author: cleanAuthor,
    text: cleanText,
    commentId: newComment.id,
    ts: newComment.ts
  }).catch(() => {
    // Non-blocking fallback
  });

  return updatedList;
}
