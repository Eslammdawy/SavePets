const SAVED_PETS_KEY = 'sp_saved_pets_v1';

/**
 * Strip any legacy phone number (`contact`) from a pet object before storing or returning.
 * Preserves boolean `hc` (has contact) so the WhatsApp button still renders.
 */
function sanitizeSavedPet(pet) {
  if (!pet || typeof pet !== 'object') return null;
  const copy = { ...pet };
  if ('contact' in copy) {
    if (copy.hc === undefined) {
      copy.hc = Boolean(String(copy.contact || '').replace(/\D+/g, ''));
    }
    delete copy.contact;
  } else {
    copy.hc = Boolean(copy.hc);
  }
  return copy;
}

/**
 * Load all saved/bookmarked pet objects from localStorage.
 * Automatically strips `contact` from entries saved by older versions.
 */
export function loadSavedPets() {
  try {
    const raw = localStorage.getItem(SAVED_PETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    let hadLegacyContact = false;
    const sanitized = [];
    for (const item of parsed) {
      if (item && typeof item === 'object' && item.id) {
        if ('contact' in item) {
          hadLegacyContact = true;
        }
        sanitized.push(sanitizeSavedPet(item));
      }
    }
    if (hadLegacyContact) {
      saveBookmarkedPets(sanitized);
    }
    return sanitized;
  } catch (_e) {
    return [];
  }
}

/**
 * Persist saved pets array to localStorage (always stripped of contact numbers).
 */
export function saveBookmarkedPets(pets) {
  try {
    const cleanList = Array.isArray(pets)
      ? pets.map(sanitizeSavedPet).filter(Boolean)
      : [];
    localStorage.setItem(SAVED_PETS_KEY, JSON.stringify(cleanList));
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
  const cleanPet = sanitizeSavedPet(pet);
  const next = exists
    ? currentList.filter((item) => item.id !== pet.id)
    : [cleanPet, ...currentList];
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

/**
 * Reconcile bookmarked pets when a governorate's available pet list loads:
 * remove any saved pet from that governorate that is no longer in the available list.
 */
export function reconcileSavedPetsForGov(currentList, gov, availableGovPets) {
  if (!gov || !Array.isArray(currentList) || !Array.isArray(availableGovPets)) {
    return currentList;
  }
  const normGov = String(gov).trim().toLowerCase();
  const availableIds = new Set(availableGovPets.map((p) => p && p.id).filter(Boolean));
  let changed = false;
  const next = currentList.filter((item) => {
    if (!item || String(item.gov || '').trim().toLowerCase() !== normGov) {
      return true;
    }
    if (!availableIds.has(item.id)) {
      changed = true;
      return false;
    }
    return true;
  });
  if (changed) {
    saveBookmarkedPets(next);
  }
  return changed ? next : currentList;
}
