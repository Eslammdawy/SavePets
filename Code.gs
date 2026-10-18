/**
 * Street Pets — Google Apps Script Backend (Code.gs)
 *
 * Deploy as Web App:
 *   - Execute as: "Me"
 *   - Who has access: "Anyone"
 *
 * Pre-shared Google Drive Folder:
 *   Create ONE folder in Google Drive, set sharing once to
 *   "Anyone with the link can view", and paste its ID below.
 */

const FOLDER_ID = '1DrAsiskZdRlaZXyl2UJcmyEgAkihcneO';

const SHEET_PETS = 'Pets';
const SHEET_ARCHIVE = 'Archive';

const SHEET_HEADERS = [
  'id',
  'created_at',
  'governorate',
  'city',
  'lat',
  'lng',
  'animal_type',
  'condition',
  'description',
  'photo_id',
  'contact',
  'status'
];

// Compact header sent once in list responses
const COMPACT_HEADERS = [
  'id',
  't',
  'gov',
  'city',
  'lat',
  'lng',
  'type',
  'cond',
  'desc',
  'photo',
  'contact'
];

const VALID_GOVS = [
  'cairo',
  'giza',
  'alexandria',
  'dakahlia',
  'red_sea',
  'beheira',
  'fayoum',
  'gharbia',
  'ismailia',
  'menofia',
  'minya',
  'qalyubia',
  'new_valley',
  'suez',
  'aswan',
  'assiut',
  'beni_suef',
  'port_said',
  'damietta',
  'sharkia',
  'south_sinai',
  'kafr_el_sheikh',
  'matrouh',
  'luxor',
  'qena',
  'north_sinai',
  'sohag'
];

const VALID_TYPES = ['dog', 'cat'];
const VALID_CONDITIONS = ['healthy', 'injured', 'sick', 'pregnant', 'unsure'];
const ALLOWED_MIMES = ['image/webp', 'image/jpeg', 'image/png'];

const MAX_RECENT_ROWS = 300;
const MAX_GOV_RESULTS = 100;
const CACHE_TTL_SEC = 300;
const CHUNK_SIZE = 30000;
// Pre-allocated chunk keys so a single getAll / removeAll covers metadata + all chunks
const CACHE_KEYS = ['all_meta', 'all_0', 'all_1', 'all_2', 'all_3', 'all_4', 'all_5'];
const MAX_IMAGE_BYTES = 300 * 1024; // ~300 KB server limit
const ARCHIVE_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

/**
 * Run once manually from the Apps Script editor to initialize sheets and triggers.
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  [SHEET_PETS, SHEET_ARCHIVE].forEach(function (name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
      sheet.setFrozenRows(1);
    }
  });

  // Install monthly archive trigger if not already installed
  const triggers = ScriptApp.getProjectTriggers();
  const exists = triggers.some(function (t) {
    return t.getHandlerFunction() === 'archiveOld';
  });
  if (!exists) {
    ScriptApp.newTrigger('archiveOld')
      .timeBased()
      .onMonthDay(1)
      .atHour(3)
      .create();
  }
}

/**
 * GET handler: ?action=list&gov=<governorate_id>[&type=dog|cat]
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    if (params.action !== 'list') {
      return jsonResponse_({ ok: false, error: 'Invalid action.' });
    }

    const gov = String(params.gov || '').trim().toLowerCase();
    if (VALID_GOVS.indexOf(gov) === -1) {
      return jsonResponse_({ ok: false, error: 'Invalid governorate.' });
    }

    const typeFilter = String(params.type || '').trim().toLowerCase();
    if (typeFilter && VALID_TYPES.indexOf(typeFilter) === -1) {
      return jsonResponse_({ ok: false, error: 'Invalid animal type.' });
    }

    const allCompactRows = getCachedOrBuildAvailablePets_();
    const filtered = [];
    for (let i = 0; i < allCompactRows.length; i++) {
      if (allCompactRows[i][2] === gov && (!typeFilter || allCompactRows[i][6] === typeFilter)) {
        filtered.push(allCompactRows[i]);
        if (filtered.length >= MAX_GOV_RESULTS) break;
      }
    }

    return jsonResponse_({
      ok: true,
      h: COMPACT_HEADERS,
      r: filtered
    });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String((err && err.message) || err) });
  }
}

/**
 * POST handler: actions "add" and "markAdopted"
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse_({ ok: false, error: 'Empty request body.' });
    }

    const body = JSON.parse(e.postData.contents);
    const action = String(body.action || '');

    if (action === 'add') {
      return handleAdd_(body);
    }
    if (action === 'markAdopted') {
      return handleMarkAdopted_(body);
    }

    return jsonResponse_({ ok: false, error: 'Unknown action.' });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String((err && err.message) || err) });
  }
}

/**
 * Handle adding a new pet report.
 */
function handleAdd_(data) {
  // Rule 7: Reject honeypot-filled submissions silently
  if (data.website && String(data.website).trim() !== '') {
    return jsonResponse_({ ok: true });
  }

  // Rule 7: Rate limit max 5 submissions per client per hour using CacheService
  const clientId = String(data.clientId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  if (!clientId) {
    return jsonResponse_({ ok: false, error: 'Missing client identifier.' });
  }
  const cache = CacheService.getScriptCache();
  const rlKey = 'rl_' + clientId;
  const currentCount = parseInt(cache.get(rlKey) || '0', 10);
  if (currentCount >= 5) {
    return jsonResponse_({ ok: false, error: 'Rate limit exceeded (max 5 reports per hour).' });
  }

  // Rule 8: Server-side validation
  const gov = String(data.gov || '').trim().toLowerCase();
  if (VALID_GOVS.indexOf(gov) === -1) {
    return jsonResponse_({ ok: false, error: 'Invalid governorate.' });
  }

  const city = String(data.city || '').trim().slice(0, 100);

  const animalType = String(data.type || '').trim().toLowerCase();
  if (VALID_TYPES.indexOf(animalType) === -1) {
    return jsonResponse_({ ok: false, error: 'Invalid animal type.' });
  }

  const condition = String(data.cond || '').trim().toLowerCase();
  if (VALID_CONDITIONS.indexOf(condition) === -1) {
    return jsonResponse_({ ok: false, error: 'Invalid condition.' });
  }

  const lat = Number(data.lat);
  const lng = Number(data.lng);
  if (
    data.lat === undefined ||
    data.lat === null ||
    data.lat === '' ||
    data.lng === undefined ||
    data.lng === null ||
    data.lng === '' ||
    isNaN(lat) ||
    isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return jsonResponse_({ ok: false, error: 'Valid GPS coordinates (lat, lng) are required.' });
  }

  const description = String(data.desc || '').trim().slice(0, 300);

  // Sanitize optional WhatsApp contact to digits only (auto-prepend 20 for local Egyptian 01x numbers)
  let contact = String(data.contact || '').replace(/\D+/g, '');
  if (contact) {
    if (/^01[0125]\d{8}$/.test(contact)) {
      contact = '20' + contact.slice(1);
    }
    if (contact.length < 8 || contact.length > 15) {
      return jsonResponse_({
        ok: false,
        error: 'Contact number must be 8 to 15 digits including country code.'
      });
    }
  }

  const mimeType = String(data.mimeType || 'image/webp').trim().toLowerCase();
  if (ALLOWED_MIMES.indexOf(mimeType) === -1) {
    return jsonResponse_({ ok: false, error: 'Unsupported image MIME type.' });
  }

  const rawBase64 = String(data.photoBase64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!rawBase64) {
    return jsonResponse_({ ok: false, error: 'Photo is required.' });
  }

  const bytes = Utilities.base64Decode(rawBase64);
  if (!bytes || bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    return jsonResponse_({ ok: false, error: 'Photo exceeds maximum allowed size (300 KB).' });
  }

  // Rule 5: Upload photo to Drive with ONE getFolderById + createFile (no setSharing per file)
  const id = Utilities.getUuid();
  const ext = mimeType === 'image/png' ? '.png' : mimeType === 'image/jpeg' ? '.jpg' : '.webp';
  const blob = Utilities.newBlob(bytes, mimeType, 'pet_' + id + ext);
  const file = DriveApp.getFolderById(FOLDER_ID).createFile(blob);
  const photoId = file.getId();

  const createdAt = Date.now();
  const newRow = [
    id,
    createdAt,
    gov,
    city,
    Math.round(lat * 1e5) / 1e5,
    Math.round(lng * 1e5) / 1e5,
    animalType,
    condition,
    description,
    photoId,
    contact,
    'available'
  ];

  // Rule 6: Lock ONLY around write operation and release in finally
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PETS);
    // Rule 4: Single appendRow per submission
    sheet.appendRow(newRow);
    // Rule 3: Invalidate cache in ONE removeAll
    invalidateCache_(cache);
  } finally {
    lock.releaseLock();
  }

  // Increment hourly rate limit counter
  cache.put(rlKey, String(currentCount + 1), 3600);

  return jsonResponse_({ ok: true, id: id, photo: photoId });
}

/**
 * Handle marking a pet as adopted/rescued.
 */
function handleMarkAdopted_(data) {
  const id = String(data.id || '').trim();
  if (!id) {
    return jsonResponse_({ ok: false, error: 'Missing pet ID.' });
  }

  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PETS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return jsonResponse_({ ok: false, error: 'Pet not found.' });
    }

    // Rule 4: Find the row with ONE createTextFinder on the id column (col 1)
    const finder = sheet
      .getRange(2, 1, lastRow - 1, 1)
      .createTextFinder(id)
      .matchEntireCell(true);
    const cell = finder.findNext();
    if (!cell) {
      return jsonResponse_({ ok: false, error: 'Pet not found.' });
    }

    // Rule 4: ONE setValue('adopted') on status column (col 12)
    sheet.getRange(cell.getRow(), 12).setValue('adopted');

    // Rule 3: Invalidate shared cache
    invalidateCache_(cache);
  } finally {
    lock.releaseLock();
  }

  return jsonResponse_({ ok: true });
}

/**
 * Rule 1 & Rule 2: Read from chunked ScriptCache with ONE getAll, or rebuild from the last 300 rows
 * with ONE getRange().getValues() and store with ONE putAll.
 */
function getCachedOrBuildAvailablePets_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.getAll(CACHE_KEYS);

  if (cached && cached.all_meta) {
    const chunkCount = parseInt(cached.all_meta, 10);
    if (chunkCount === 0) {
      return [];
    }
    if (chunkCount > 0 && chunkCount <= CACHE_KEYS.length - 1) {
      const parts = [];
      let complete = true;
      for (let i = 0; i < chunkCount; i++) {
        const part = cached['all_' + i];
        if (typeof part !== 'string') {
          complete = false;
          break;
        }
        parts.push(part);
      }
      if (complete) {
        try {
          return JSON.parse(parts.join(''));
        } catch (_e) {
          // Cache corrupted; fall through to rebuild
        }
      }
    }
  }

  // Cache miss: Read at most the last 300 data rows in ONE call (no getDataRange)
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PETS);
  const lastRow = sheet ? sheet.getLastRow() : 0;
  if (lastRow < 2) {
    cache.putAll({ all_meta: '0' }, CACHE_TTL_SEC);
    return [];
  }

  const startRow = Math.max(2, lastRow - MAX_RECENT_ROWS + 1);
  const numRows = lastRow - startRow + 1;
  const rawRows = sheet.getRange(startRow, 1, numRows, SHEET_HEADERS.length).getValues();

  // Filter available in memory and sort newest first
  const available = [];
  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i];
    const status = String(r[11] || '').trim().toLowerCase();
    if (status === 'available' && r[0]) {
      available.push(r);
    }
  }

  available.sort(function (a, b) {
    return Number(b[1] || 0) - Number(a[1] || 0);
  });

  // Shrink each row to compact format: [id, t(sec), gov, city, lat, lng, type, cond, desc, photo, contact]
  const compactRows = new Array(available.length);
  for (let j = 0; j < available.length; j++) {
    const row = available[j];
    compactRows[j] = [
      String(row[0]),
      Math.floor(Number(row[1] || 0) / 1000),
      String(row[2] || '').trim().toLowerCase(),
      String(row[3] || '').trim(),
      Math.round(Number(row[4] || 0) * 1e5) / 1e5,
      Math.round(Number(row[5] || 0) * 1e5) / 1e5,
      String(row[6] || '').trim().toLowerCase(),
      String(row[7] || '').trim().toLowerCase(),
      String(row[8] || '').trim().slice(0, 300),
      String(row[9] || '').trim(),
      String(row[10] || '').trim()
    ];
  }

  // Split JSON into 30,000-char chunks and store with ONE putAll
  const jsonStr = JSON.stringify(compactRows);
  const chunksObj = {};
  let chunkIndex = 0;
  for (let pos = 0; pos < jsonStr.length; pos += CHUNK_SIZE) {
    chunksObj['all_' + chunkIndex] = jsonStr.slice(pos, pos + CHUNK_SIZE);
    chunkIndex++;
  }
  chunksObj.all_meta = String(chunkIndex);
  cache.putAll(chunksObj, CACHE_TTL_SEC);

  return compactRows;
}

/**
 * Rule 3: Invalidate all cache keys in ONE removeAll call.
 */
function invalidateCache_(cache) {
  const c = cache || CacheService.getScriptCache();
  c.removeAll(CACHE_KEYS);
}

/**
 * Rule 11: Monthly archive job triggered on day 1 of each month at 03:00.
 * Moves rows where status === 'adopted' OR older than 60 days to the Archive sheet.
 */
function archiveOld() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const petsSheet = ss.getSheetByName(SHEET_PETS);
    let archiveSheet = ss.getSheetByName(SHEET_ARCHIVE);
    if (!archiveSheet) {
      archiveSheet = ss.insertSheet(SHEET_ARCHIVE);
      archiveSheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
    }

    const lastRow = petsSheet.getLastRow();
    if (lastRow < 2) return;

    const numRows = lastRow - 1;
    const allData = petsSheet.getRange(2, 1, numRows, SHEET_HEADERS.length).getValues();
    const cutoffMs = Date.now() - ARCHIVE_MAX_AGE_MS;

    const keep = [];
    const move = [];

    for (let i = 0; i < allData.length; i++) {
      const row = allData[i];
      const createdAt = Number(row[1] || 0);
      const status = String(row[11] || '').trim().toLowerCase();
      if (status === 'adopted' || (createdAt > 0 && createdAt < cutoffMs)) {
        move.push(row);
      } else {
        keep.push(row);
      }
    }

    if (move.length === 0) return;

    // Append moved rows to Archive with ONE setValues
    const archiveLastRow = Math.max(1, archiveSheet.getLastRow());
    archiveSheet
      .getRange(archiveLastRow + 1, 1, move.length, SHEET_HEADERS.length)
      .setValues(move);

    // Rewrite Pets data area: clearContent() + ONE setValues for kept rows
    petsSheet.getRange(2, 1, numRows, SHEET_HEADERS.length).clearContent();
    if (keep.length > 0) {
      petsSheet.getRange(2, 1, keep.length, SHEET_HEADERS.length).setValues(keep);
    }

    // Rule 3: Invalidate cache
    invalidateCache_(CacheService.getScriptCache());
  } finally {
    lock.releaseLock();
  }
}

/**
 * Rule 9: Format JSON output with proper MIME type.
 */
function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
