import { submitPetReport, generateUuid } from './api';

export const OFFLINE_QUEUE_KEY = 'sp_offline_queue_v1';
export const OFFLINE_FAILED_KEY = 'sp_offline_failed_v1';
export const MAX_OFFLINE_QUEUE = 15;

// Module-level single-flight promise for flushOfflineQueue
let inFlightFlush = null;

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
 * Returns true on success, false on storage/quota failure.
 */
export function saveOfflineQueue(queue) {
  try {
    if (!queue || queue.length === 0) {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    } else {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Load permanently failed offline reports from localStorage.
 */
export function getFailedOfflineReports() {
  try {
    const raw = localStorage.getItem(OFFLINE_FAILED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

/**
 * Save permanently failed offline reports to localStorage.
 */
function saveFailedOfflineReports(list) {
  try {
    if (!list || list.length === 0) {
      localStorage.removeItem(OFFLINE_FAILED_KEY);
    } else {
      localStorage.setItem(OFFLINE_FAILED_KEY, JSON.stringify(list));
    }
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Discard a single permanently failed report by queueId (or discard all if queueId is omitted).
 */
export function discardFailedOfflineReport(queueId) {
  const current = getFailedOfflineReports();
  const next = queueId ? current.filter((item) => item.queueId !== queueId) : [];
  saveFailedOfflineReports(next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sp-offline-queue-changed'));
  }
  return next;
}

function notifyQueueChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sp-offline-queue-changed'));
  }
}

/**
 * Determine whether a submission error is retryable (network/timeout/429/5xx)
 * or permanent (validation error).
 */
export function isRetryableQueueError(err) {
  if (!err) return true;
  if (err.retryable === true) return true;
  if (err instanceof TypeError) return true;

  const code = String(err.code || '').toUpperCase();
  const status = Number(err.status || 0);
  const msg = String(err.message || '').toLowerCase();

  if (
    code === 'ERR_TIMEOUT' ||
    code === 'ERR_RATE_LIMIT' ||
    code === 'ERR_INTERNAL' ||
    code === 'ERR_UPSTREAM' ||
    code === 'ERR_CONFIG'
  ) {
    return true;
  }

  if (status === 429 || status >= 500) {
    return true;
  }

  if (
    code.startsWith('ERR_BAD_') ||
    code === 'ERR_OUTSIDE_EGYPT' ||
    code === 'ERR_PHOTO_SIZE' ||
    code === 'ERR_MIME_MISMATCH' ||
    code === 'ERR_MISSING_PHOTO' ||
    code === 'ERR_EMPTY_BODY' ||
    status === 400 ||
    status === 422
  ) {
    return false;
  }

  if (/network|fetch|offline|timed out|timeout|rate limit|quota/i.test(msg)) {
    return true;
  }

  if (/invalid|unsupported|must be within egypt|exceeds maximum|required|mismatch/i.test(msg)) {
    return false;
  }

  return true;
}

/**
 * Enqueue a report payload when the user is offline or a retryable network error occurs.
 * Returns { ok: true, queue, entry } or { ok: false, reason: 'full' | 'quota' }.
 */
export function enqueueOfflineReport(payload) {
  const queue = getOfflineQueue();
  if (queue.length >= MAX_OFFLINE_QUEUE) {
    return {
      ok: false,
      reason: 'full'
    };
  }

  const reportId = payload && payload.id ? String(payload.id) : generateUuid();
  const normalizedPayload = {
    ...payload,
    id: reportId
  };

  // Deduplicate if the exact report ID is already queued
  const existingIdx = queue.findIndex(
    (item) => item.payload && item.payload.id === reportId
  );
  if (existingIdx !== -1) {
    return {
      ok: true,
      queue,
      entry: queue[existingIdx]
    };
  }

  const entry = {
    queueId: 'q_' + generateUuid(),
    queuedAt: Date.now(),
    attempts: 0,
    nextRetryAt: 0,
    payload: normalizedPayload
  };

  const updated = [...queue, entry];
  const saved = saveOfflineQueue(updated);
  if (!saved) {
    return {
      ok: false,
      reason: 'quota'
    };
  }

  notifyQueueChanged();
  return {
    ok: true,
    queue: updated,
    entry
  };
}

/**
 * Remove a specific item from the freshly re-read queue without clobbering items added concurrently.
 */
function removeQueueItemSafely(queueId, reportId) {
  const fresh = getOfflineQueue();
  const filtered = fresh.filter(
    (item) =>
      item.queueId !== queueId &&
      (!reportId || !item.payload || item.payload.id !== reportId)
  );
  saveOfflineQueue(filtered);
  return filtered;
}

/**
 * Update retry metadata for a single item in the freshly re-read queue.
 */
function updateQueueItemRetrySafely(queueId, attempts, nextRetryAt, lastError) {
  const fresh = getOfflineQueue();
  const updated = fresh.map((item) => {
    if (item.queueId !== queueId) return item;
    return {
      ...item,
      attempts,
      nextRetryAt,
      lastError: String(lastError || '')
    };
  });
  saveOfflineQueue(updated);
  return updated;
}

/**
 * Move a permanently failed item out of the active queue into the failed list.
 */
function moveQueueItemToFailed(item, reason) {
  const reportId = item && item.payload && item.payload.id;
  removeQueueItemSafely(item.queueId, reportId);
  const failedList = getFailedOfflineReports();
  const nextFailed = [
    ...failedList.filter((f) => f.queueId !== item.queueId),
    {
      queueId: item.queueId,
      failedAt: Date.now(),
      reason: String(reason || 'Validation failed.'),
      gov: (item.payload && item.payload.gov) || '',
      city: (item.payload && item.payload.city) || ''
    }
  ].slice(-20);
  saveFailedOfflineReports(nextFailed);
}

/**
 * Flush queued reports to the backend sequentially (single-flight).
 * Returns { syncedCount, remainingCount, failedCount, lastGov, lastPet }.
 */
export function flushOfflineQueue({ force = false, submitFn = submitPetReport } = {}) {
  if (inFlightFlush) {
    return inFlightFlush;
  }

  inFlightFlush = (async () => {
    try {
      const snapshot = getOfflineQueue();
      if (snapshot.length === 0) {
        return {
          syncedCount: 0,
          remainingCount: 0,
          failedCount: getFailedOfflineReports().length,
          lastGov: '',
          lastPet: null
        };
      }

      let syncedCount = 0;
      let lastGov = '';
      let lastPet = null;

      for (const item of snapshot) {
        if (!force && item.nextRetryAt && Date.now() < item.nextRetryAt) {
          continue;
        }

        try {
          const res = await submitFn(item.payload);
          const reportId = item.payload && item.payload.id;
          removeQueueItemSafely(item.queueId, reportId);
          syncedCount += 1;
          if (item.payload && item.payload.gov) {
            lastGov = item.payload.gov;
          }
          if (res && res.pet) {
            lastPet = res.pet;
          }
          notifyQueueChanged();
        } catch (err) {
          const errMsg = (err && err.message) || String(err);
          if (isRetryableQueueError(err)) {
            const attempts = Number(item.attempts || 0) + 1;
            const backoffMs = Math.min(5 * 60 * 1000, 5000 * Math.pow(2, attempts - 1));
            updateQueueItemRetrySafely(
              item.queueId,
              attempts,
              Date.now() + backoffMs,
              errMsg
            );
            notifyQueueChanged();
          } else {
            moveQueueItemToFailed(item, errMsg);
            notifyQueueChanged();
          }
        }
      }

      const finalQueue = getOfflineQueue();
      return {
        syncedCount,
        remainingCount: finalQueue.length,
        failedCount: getFailedOfflineReports().length,
        lastGov,
        lastPet
      };
    } finally {
      inFlightFlush = null;
    }
  })();

  return inFlightFlush;
}
