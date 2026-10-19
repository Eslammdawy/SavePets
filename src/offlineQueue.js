import { submitPetReport } from './api';

const OFFLINE_QUEUE_KEY = 'sp_offline_queue_v1';

/**
 * Load queued pet reports stored offline in localStorage.
 */
export function getOfflineQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

/**
 * Save the offline report queue to localStorage.
 */
function saveOfflineQueue(queue) {
  try {
    if (!queue || queue.length === 0) {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    } else {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch (_e) {
    // Ignore quota errors
  }
}

/**
 * Enqueue a report payload when the user is offline or a network error occurs.
 */
export function enqueueOfflineReport(payload) {
  const queue = getOfflineQueue();
  const entry = {
    queueId: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    queuedAt: Date.now(),
    payload
  };
  const updated = [...queue, entry];
  saveOfflineQueue(updated);
  window.dispatchEvent(new CustomEvent('sp-offline-queue-changed'));
  return updated;
}

/**
 * Flush all queued reports to the backend sequentially.
 * Returns { syncedCount, remainingCount, lastGov }.
 */
export async function flushOfflineQueue() {
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, remainingCount: 0, lastGov: '' };
  }

  const remaining = [];
  let syncedCount = 0;
  let lastGov = '';

  for (const item of queue) {
    try {
      await submitPetReport(item.payload);
      syncedCount += 1;
      if (item.payload && item.payload.gov) {
        lastGov = item.payload.gov;
      }
    } catch (_err) {
      remaining.push(item);
    }
  }

  saveOfflineQueue(remaining);
  window.dispatchEvent(new CustomEvent('sp-offline-queue-changed'));
  return {
    syncedCount,
    remainingCount: remaining.length,
    lastGov
  };
}
