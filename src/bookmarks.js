const SAVED_PETS_KEY = 'sp_saved_pets_v1';

/**
 * Load all saved/bookmarked pet objects from localStorage.
 */
export function loadSavedPets() {
  try {
    const raw = localStorage.getItem(SAVED_PETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

/**
 * Persist saved pets array to localStorage.
 */
export function saveBookmarkedPets(pets) {
  try {
    localStorage.setItem(SAVED_PETS_KEY, JSON.stringify(pets));
  } catch (_e) {
    // Ignore storage quota errors
  }
}

/**
 * Toggle a pet in the saved list and return the updated array.
 */
export function toggleSavedPet(currentList, pet) {
  if (!pet || !pet.id) return currentList;
  const exists = currentList.some((item) => item.id === pet.id);
  const next = exists
    ? currentList.filter((item) => item.id !== pet.id)
    : [pet, ...currentList];
  saveBookmarkedPets(next);
  return next;
}

/**
 * Remove a pet ID from the saved list (e.g. when marked as rescued/adopted).
 */
export function removeSavedPetById(currentList, petId) {
  const next = currentList.filter((item) => item.id !== petId);
  saveBookmarkedPets(next);
  return next;
}
