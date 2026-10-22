/**
 * Street Pets — Google Apps Script Backend (Code.gs)
 *
 * Deploy as Web App:
 *   - Execute as: "Me"
 *   - Who has access: "Anyone"
 *
 * Required Script Properties (Project Settings > Script Properties):
 *   - FOLDER_ID: Google Drive folder ID (shared as "Anyone with the link can view")
 *   - EDGE_SHARED_SECRET: Shared secret matching EdgeOne environment variable
 *   - PIN_SALT: Random secret string used to salt 4-digit reporter PIN hashes
 */

const SHEET_PETS = 'Pets';
const SHEET_ARCHIVE = 'Archive';
const SHEET_COMMENTS = 'Comments';
const SHEET_REPORTS = 'Reports';
const SHEET_LOGS = 'Logs';

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
  'status',
  'pin_hash'
];

const COL = (function () {
  const map = {};
  for (let i = 0; i < SHEET_HEADERS.length; i++) {
    map[SHEET_HEADERS[i]] = i;
  }
  return map;
})();

const COMMENTS_HEADERS = [
  'id',
  'pet_id',
  'created_at',
  'author',
  'text'
];

const REPORTS_HEADERS = [
  'id',
  'pet_id',
  'created_at',
  'governorate',
  'ip_key'
];

const LOGS_HEADERS = [
  'timestamp',
  'code',
  'context',
  'message'
];

// Compact header sent once in list responses (no phone numbers exposed)
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
  'hc',
  'status'
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Egypt bounding box
const EGYPT_LAT_MIN = 21.7;
const EGYPT_LAT_MAX = 31.7;
const EGYPT_LNG_MIN = 24.7;
const EGYPT_LNG_MAX = 36.9;

const MAX_RECENT_ROWS = 1500;
const MAX_GOV_RESULTS = 100;
const CACHE_TTL_SEC = 300;
const COMMENTS_CACHE_TTL_SEC = 60;
const CHUNK_SIZE = 30000;
const MAX_GOV_CHUNKS = 4; // 4 chunks * 30,000 chars = 120,000 chars per governorate
const MAX_IMAGE_BYTES = 300 * 1024; // ~300 KB server limit
const ARCHIVE_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
const ARCHIVE_TIME_BUDGET_MS = 270 * 1000; // 4.5 minutes budget (stops before 5-min limit)
const MAX_LOG_ROWS = 500;

// Rate limits per IP key per hour
const RL_ADD_MAX = 5;
const RL_COMMENT_MAX = 20;
const RL_CONTACT_MAX = 30;
const RL_REPORT_ADOPTED_MAX = 10;
const RL_PIN_FAIL_MAX = 5;

/**
 * Build pre-allocated cache keys for a single governorate (`gov_<id>_meta`, `gov_<id>_0`..`gov_<id>_3`).
 */
function govCacheKeys_(gov) {
  const keys = ['gov_' + gov + '_meta'];
  for (let i = 0; i < MAX_GOV_CHUNKS; i++) {
    keys.push('gov_' + gov + '_' + i);
  }
  return keys;
}

/**
 * Build all cache keys across all 27 governorates for full invalidation.
 */
function allGovCacheKeys_() {
  const all = [];
  for (let g = 0; g < VALID_GOVS.length; g++) {
    const keys = govCacheKeys_(VALID_GOVS[g]);
    for (let k = 0; k < keys.length; k++) {
      all.push(keys[k]);
    }
  }
  return all;
}

/**
 * Sanitize user-controlled text to prevent spreadsheet formula injection.
 * Prefixes strings starting with =, +, -, @, tab, or carriage return with a single quote.
 * Does not double-prefix if already prefixed.
 */
function safeText_(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (!str) return '';
  if (str.charAt(0) === "'") return str;
  if (/^[=+\-@\t\r]/.test(str)) {
    return "'" + str;
  }
  return str;
}

/**
 * Strip the leading escape quote added by safeText_ when reading back plain-text cells
 * so the user sees the original text (e.g. "=1+1") in the UI.
 */
function fromSafeText_(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.length >= 2 && str.charAt(0) === "'" && /^[=+\-@\t\r]/.test(str.charAt(1))) {
    return str.slice(1);
  }
  return str;
}

/**
 * Format specific 1-based column numbers on a sheet as plain text ('@').
 */
function formatColumnsPlainText_(sheet, colNumbers) {
  if (!sheet || !colNumbers || colNumbers.length === 0) return;
  const maxRows = Math.max(2, sheet.getMaxRows());
  const numDataRows = Math.max(1, maxRows - 1);
  for (let i = 0; i < colNumbers.length; i++) {
    sheet.getRange(2, colNumbers[i], numDataRows, 1).setNumberFormat('@');
  }
}

/**
 * Read a required Script Property.
 */
function getScriptProp_(key) {
  const props = PropertiesService.getScriptProperties();
  return String((props && props.getProperty(key)) || '').trim();
}

/**
 * Ensures FOLDER_ID is configured; auto-creates a public Drive folder if missing.
 */
function getOrCreateFolderId_() {
  const props = PropertiesService.getScriptProperties();
  let folderId = String((props && props.getProperty('FOLDER_ID')) || '').trim();
  if (folderId) {
    return folderId;
  }
  try {
    const folder = DriveApp.createFolder('Street Pets Photos');
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    folderId = folder.getId();
    if (props) {
      props.setProperty('FOLDER_ID', folderId);
    }
    return folderId;
  } catch (err) {
    logError_('ERR_AUTO_FOLDER', 'getOrCreateFolderId_', 'Failed to auto-create photo folder: ' + err.message);
    return '';
  }
}

/**
 * Ensures PIN_SALT is configured; auto-generates a secure random salt if missing.
 */
function getOrCreatePinSalt_() {
  const props = PropertiesService.getScriptProperties();
  let pinSalt = String((props && props.getProperty('PIN_SALT')) || '').trim();
  if (pinSalt) {
    return pinSalt;
  }
  try {
    pinSalt = Utilities.getUuid() + '-' + Utilities.getUuid();
    if (props) {
      props.setProperty('PIN_SALT', pinSalt);
    }
    return pinSalt;
  } catch (err) {
    logError_('ERR_AUTO_PIN_SALT', 'getOrCreatePinSalt_', 'Failed to auto-generate PIN_SALT: ' + err.message);
    return '';
  }
}

/**
 * Constant-time string comparison for secrets and hashes.
 */
function timingSafeEqual_(a, b) {
  const strA = String(a || '');
  const strB = String(b || '');
  if (!strA || !strB || strA.length !== strB.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < strA.length; i++) {
    diff |= strA.charCodeAt(i) ^ strB.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verify the shared secret sent by EdgeOne edge functions.
 * If EDGE_SHARED_SECRET is configured in Script Properties, enforces constant-time match.
 */
function verifySharedSecret_(providedSecret) {
  const expected = getScriptProp_('EDGE_SHARED_SECRET');
  if (!expected) {
    return true;
  }
  return timingSafeEqual_(String(providedSecret || '').trim(), expected);
}

/**
 * Compute salted SHA-256 hex hash for a 4-digit reporter PIN.
 */
function hashPin_(pin, salt) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(salt) + ':' + String(pin),
    Utilities.Charset.UTF_8
  );
  return digest
    .map(function (b) {
      const v = b < 0 ? b + 256 : b;
      return ('0' + v.toString(16)).slice(-2);
    })
    .join('');
}

/**
 * Detect actual image MIME type from magic bytes.
 * Returns 'image/webp', 'image/jpeg', 'image/png', or ''.
 */
function detectImageMime_(bytes) {
  if (!bytes || bytes.length < 12) return '';
  function u8(idx) {
    const b = bytes[idx];
    return b < 0 ? b + 256 : b;
  }
  // JPEG: FF D8 FF
  if (u8(0) === 0xff && u8(1) === 0xd8 && u8(2) === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    u8(0) === 0x89 &&
    u8(1) === 0x50 &&
    u8(2) === 0x4e &&
    u8(3) === 0x47 &&
    u8(4) === 0x0d &&
    u8(5) === 0x0a &&
    u8(6) === 0x1a &&
    u8(7) === 0x0a
  ) {
    return 'image/png';
  }
  // WebP: "RIFF" (52 49 46 46) at 0..3 and "WEBP" (57 45 42 50) at 8..11
  if (
    u8(0) === 0x52 &&
    u8(1) === 0x49 &&
    u8(2) === 0x46 &&
    u8(3) === 0x46 &&
    u8(8) === 0x57 &&
    u8(9) === 0x45 &&
    u8(10) === 0x42 &&
    u8(11) === 0x50
  ) {
    return 'image/webp';
  }
  return '';
}

/**
 * Normalize the IP-derived rate-limit key injected by the edge proxy.
 */
function normalizeIpKey_(rawIpKey) {
  return String(rawIpKey || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);
}

/**
 * Check and increment an hourly rate limit counter in CacheService.
 */
function checkAndIncrementRateLimit_(cache, actionPrefix, ipKey, maxPerHour) {
  if (!ipKey) return false;
  const rlKey = 'rl_' + actionPrefix + '_' + ipKey;
  const currentCount = parseInt(cache.get(rlKey) || '0', 10);
  if (currentCount >= maxPerHour) {
    return false;
  }
  cache.put(rlKey, String(currentCount + 1), 3600);
  return true;
}

/**
 * Log internal errors to the Logs sheet (capped at 500 data rows).
 */
function logError_(code, context, err) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    let sheet = ss.getSheetByName(SHEET_LOGS);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_LOGS);
      sheet.getRange(1, 1, 1, LOGS_HEADERS.length).setValues([LOGS_HEADERS]);
      sheet.setFrozenRows(1);
    }
    const msg = String((err && (err.stack || err.message)) || err || 'Unknown error').slice(0, 1000);
    sheet.appendRow([
      new Date().toISOString(),
      safeText_(code),
      safeText_(context),
      safeText_(msg)
    ]);
    const lastRow = sheet.getLastRow();
    if (lastRow > MAX_LOG_ROWS + 1) {
      sheet.deleteRows(2, lastRow - (MAX_LOG_ROWS + 1));
    }
  } catch (_loggingErr) {
    // Never fail response if logging itself fails
  }
}

/**
 * Run once manually from the Apps Script editor to initialize sheets, plain-text formats, and triggers.
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
    } else {
      const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (existingHeaders.indexOf('pin_hash') === -1) {
        sheet.getRange(1, existingHeaders.length + 1).setValue('pin_hash');
      }
    }
    // Plain-text format on city, description, contact
    formatColumnsPlainText_(sheet, [COL.city + 1, COL.description + 1, COL.contact + 1]);
  });

  let commentSheet = ss.getSheetByName(SHEET_COMMENTS);
  if (!commentSheet) {
    commentSheet = ss.insertSheet(SHEET_COMMENTS);
  }
  if (commentSheet.getLastRow() === 0) {
    commentSheet.getRange(1, 1, 1, COMMENTS_HEADERS.length).setValues([COMMENTS_HEADERS]);
    commentSheet.setFrozenRows(1);
  }
  // Plain-text format on pet_id (col 2), author (col 4), text (col 5)
  formatColumnsPlainText_(commentSheet, [2, 4, 5]);

  let reportsSheet = ss.getSheetByName(SHEET_REPORTS);
  if (!reportsSheet) {
    reportsSheet = ss.insertSheet(SHEET_REPORTS);
  }
  if (reportsSheet.getLastRow() === 0) {
    reportsSheet.getRange(1, 1, 1, REPORTS_HEADERS.length).setValues([REPORTS_HEADERS]);
    reportsSheet.setFrozenRows(1);
  }

  let logsSheet = ss.getSheetByName(SHEET_LOGS);
  if (!logsSheet) {
    logsSheet = ss.insertSheet(SHEET_LOGS);
  }
  if (logsSheet.getLastRow() === 0) {
    logsSheet.getRange(1, 1, 1, LOGS_HEADERS.length).setValues([LOGS_HEADERS]);
    logsSheet.setFrozenRows(1);
  }

  // Install daily archive trigger and 5-minute cache warmup trigger if missing
  const triggers = ScriptApp.getProjectTriggers();
  const hasArchive = triggers.some(function (t) {
    return t.getHandlerFunction() === 'archiveOld';
  });
  if (!hasArchive) {
    ScriptApp.newTrigger('archiveOld')
      .timeBased()
      .everyDays(1)
      .atHour(3)
      .create();
  }

  const hasWarmup = triggers.some(function (t) {
    return t.getHandlerFunction() === 'warmCaches';
  });
  if (!hasWarmup) {
    ScriptApp.newTrigger('warmCaches')
      .timeBased()
      .everyMinutes(5)
      .create();
  }

  // Auto-provision Google Drive photo folder and PIN_SALT if not already configured
  const provisionedFolderId = getOrCreateFolderId_();
  const provisionedPinSalt = getOrCreatePinSalt_();
  Logger.log('Photo Folder ID: ' + provisionedFolderId);
  Logger.log('PIN Salt configured: ' + (provisionedPinSalt ? 'YES' : 'NO'));
}

/**
 * GET handler:
 * - ?action=list&gov=<governorate_id>[&type=dog|cat][&fresh=1] (public)
 * - ?action=comments&petId=<pet_id> (public)
 * - ?action=contact&id=<pet_id>&_ip=<ip_key>&_secret=<secret> (protected by shared secret)
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = String(params.action || '');

    if (action === 'comments') {
      return handleGetComments_(params);
    }

    if (action === 'contact') {
      if (!verifySharedSecret_(params._secret)) {
        return jsonResponse_({ ok: false, code: 'ERR_FORBIDDEN', error: 'Unauthorized request.' });
      }
      return handleGetContact_(params.id, params._ip);
    }

    if (action !== 'list') {
      return jsonResponse_({ ok: false, code: 'ERR_BAD_ACTION', error: 'Invalid action.' });
    }

    const gov = String(params.gov || '').trim().toLowerCase();
    if (VALID_GOVS.indexOf(gov) === -1) {
      return jsonResponse_({ ok: false, code: 'ERR_BAD_GOV', error: 'Invalid governorate.' });
    }

    const typeFilter = String(params.type || '').trim().toLowerCase();
    if (typeFilter && VALID_TYPES.indexOf(typeFilter) === -1) {
      return jsonResponse_({ ok: false, code: 'ERR_BAD_TYPE', error: 'Invalid animal type.' });
    }

    const forceFresh = String(params.fresh || '') === '1';
    const govCompactRows = getCachedOrBuildGovPets_(gov, forceFresh);
    const filtered = [];
    for (let i = 0; i < govCompactRows.length; i++) {
      if (!typeFilter || govCompactRows[i][6] === typeFilter) {
        filtered.push(govCompactRows[i]);
        if (filtered.length >= MAX_GOV_RESULTS) break;
      }
    }

    return jsonResponse_({
      ok: true,
      h: COMPACT_HEADERS,
      r: filtered
    });
  } catch (err) {
    logError_('ERR_DO_GET', 'doGet', err);
    return jsonResponse_({
      ok: false,
      code: 'ERR_INTERNAL',
      error: 'An unexpected server error occurred.'
    });
  }
}

/**
 * POST handler: actions "add", "markAdopted", "reportAdopted", "addComment", and "contact"
 * Every POST requires the shared secret from the edge function.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse_({ ok: false, code: 'ERR_EMPTY_BODY', error: 'Empty request body.' });
    }

    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (_parseErr) {
      return jsonResponse_({ ok: false, code: 'ERR_BAD_JSON', error: 'Invalid JSON payload.' });
    }

    if (!verifySharedSecret_(body._secret)) {
      return jsonResponse_({ ok: false, code: 'ERR_FORBIDDEN', error: 'Unauthorized request.' });
    }

    const action = String(body.action || '');

    if (action === 'add') {
      return handleAdd_(body);
    }
    if (action === 'markAdopted') {
      return handleMarkAdopted_(body);
    }
    if (action === 'reportAdopted') {
      return handleReportAdopted_(body);
    }
    if (action === 'addComment') {
      return handleAddComment_(body);
    }
    if (action === 'contact') {
      return handleGetContact_(body.id, body._ip);
    }

    return jsonResponse_({ ok: false, code: 'ERR_BAD_ACTION', error: 'Unknown action.' });
  } catch (err) {
    logError_('ERR_DO_POST', 'doPost', err);
    return jsonResponse_({
      ok: false,
      code: 'ERR_INTERNAL',
      error: 'An unexpected server error occurred.'
    });
  }
}

/**
 * Look up a single pet's contact digits by pet ID (rate-limited, never cached).
 */
function handleGetContact_(rawId, rawIpKey) {
  const id = String(rawId || '').trim();
  if (!UUID_REGEX.test(id)) {
    return jsonResponse_({ ok: false, code: 'ERR_BAD_ID', error: 'Invalid pet ID.' });
  }

  const ipKey = normalizeIpKey_(rawIpKey);
  if (!ipKey) {
    return jsonResponse_({ ok: false, code: 'ERR_MISSING_IP', error: 'Missing client identifier.' });
  }

  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (!checkAndIncrementRateLimit_(cache, 'contact', ipKey, RL_CONTACT_MAX)) {
      return jsonResponse_({
        ok: false,
        code: 'ERR_RATE_LIMIT',
        error: 'Rate limit exceeded. Please try again later.'
      });
    }
  } finally {
    lock.releaseLock();
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PETS);
  const lastRow = sheet ? sheet.getLastRow() : 0;
  if (lastRow < 2) {
    return jsonResponse_({ ok: false, code: 'ERR_NOT_FOUND', error: 'Pet not found.' });
  }

  const finder = sheet
    .getRange(2, COL.id + 1, lastRow - 1, 1)
    .createTextFinder(id)
    .matchEntireCell(true);
  const cell = finder.findNext();
  if (!cell) {
    return jsonResponse_({ ok: false, code: 'ERR_NOT_FOUND', error: 'Pet not found.' });
  }

  const rowValues = sheet.getRange(cell.getRow(), 1, 1, SHEET_HEADERS.length).getValues()[0];
  const status = String(rowValues[COL.status] || '').trim().toLowerCase();
  if (status !== 'available') {
    return jsonResponse_({ ok: false, code: 'ERR_NOT_AVAILABLE', error: 'Case is already closed.' });
  }

  const digits = String(fromSafeText_(rowValues[COL.contact]) || '').replace(/\D+/g, '');
  if (!digits) {
    return jsonResponse_({ ok: false, code: 'ERR_NO_CONTACT', error: 'No contact number for this report.' });
  }

  return jsonResponse_({ ok: true, contact: digits });
}

/**
 * Check if a petId exists in either Pets or Archive sheet.
 */
function petExistsInSheets_(ss, petId) {
  const sheets = [SHEET_PETS, SHEET_ARCHIVE];
  for (let i = 0; i < sheets.length; i++) {
    const sh = ss.getSheetByName(sheets[i]);
    if (sh && sh.getLastRow() >= 2) {
      const found = sh
        .getRange(2, COL.id + 1, sh.getLastRow() - 1, 1)
        .createTextFinder(petId)
        .matchEntireCell(true)
        .findNext();
      if (found) return true;
    }
  }
  return false;
}

/**
 * Handle adding a follow-up comment on a pet case (idempotent on commentId).
 */
function handleAddComment_(data) {
  if (data.website && String(data.website).trim() !== '') {
    return jsonResponse_({ ok: true });
  }

  const ipKey = normalizeIpKey_(data._ip);
  if (!ipKey) {
    return jsonResponse_({ ok: false, code: 'ERR_MISSING_IP', error: 'Missing client identifier.' });
  }

  const petId = String(data.petId || '').trim();
  if (!UUID_REGEX.test(petId)) {
    return jsonResponse_({ ok: false, code: 'ERR_BAD_PET_ID', error: 'Valid Pet ID is required.' });
  }

  const text = String(data.text || '').trim().slice(0, 500);
  if (!text) {
    return jsonResponse_({ ok: false, code: 'ERR_EMPTY_COMMENT', error: 'Comment text is required.' });
  }

  const author = String(data.author || '').trim().slice(0, 60);
  const rawCommentId = String(data.commentId || '').trim();
  const id = UUID_REGEX.test(rawCommentId) ? rawCommentId : Utilities.getUuid();
  const createdAt = Date.now();

  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_COMMENTS);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_COMMENTS);
      sheet.getRange(1, 1, 1, COMMENTS_HEADERS.length).setValues([COMMENTS_HEADERS]);
      sheet.setFrozenRows(1);
      formatColumnsPlainText_(sheet, [2, 4, 5]);
    }

    // Idempotency check: if commentId already exists, return ok without duplicating
    const lastCommentRow = sheet.getLastRow();
    if (lastCommentRow >= 2 && UUID_REGEX.test(rawCommentId)) {
      const scanRows = Math.min(lastCommentRow - 1, 300);
      const scanStart = Math.max(2, lastCommentRow - scanRows + 1);
      const existingCell = sheet
        .getRange(scanStart, 1, scanRows, 1)
        .createTextFinder(id)
        .matchEntireCell(true)
        .findNext();
      if (existingCell) {
        return jsonResponse_({ ok: true, id: id, duplicate: true });
      }
    }

    if (!checkAndIncrementRateLimit_(cache, 'comment', ipKey, RL_COMMENT_MAX)) {
      return jsonResponse_({
        ok: false,
        code: 'ERR_RATE_LIMIT',
        error: 'Rate limit exceeded (max 20 comments per hour).'
      });
    }

    if (!petExistsInSheets_(ss, petId)) {
      return jsonResponse_({ ok: false, code: 'ERR_PET_NOT_FOUND', error: 'Pet case not found.' });
    }

    sheet.appendRow([
      id,
      safeText_(petId),
      createdAt,
      safeText_(author),
      safeText_(text)
    ]);

    // Invalidate per-pet comments cache
    cache.remove('cmts_' + petId);

    return jsonResponse_({ ok: true, id: id, ts: createdAt });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handle fetching comments for a pet using TextFinder + bounded single getRange + 60s CacheService.
 */
function handleGetComments_(params) {
  const petId = String(params.petId || '').trim();
  if (!UUID_REGEX.test(petId)) {
    return jsonResponse_({ ok: false, code: 'ERR_BAD_PET_ID', error: 'Invalid petId parameter.' });
  }

  const cache = CacheService.getScriptCache();
  const cacheKey = 'cmts_' + petId;
  const cachedJson = cache.get(cacheKey);
  if (cachedJson) {
    try {
      return jsonResponse_({ ok: true, comments: JSON.parse(cachedJson) });
    } catch (_e) {
      // Fall through on corrupted cache
    }
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_COMMENTS);
  const lastRow = sheet ? sheet.getLastRow() : 0;
  if (!sheet || lastRow <= 1) {
    cache.put(cacheKey, '[]', COMMENTS_CACHE_TTL_SEC);
    return jsonResponse_({ ok: true, comments: [] });
  }

  // Find matching rows for petId across the sheet using TextFinder on pet_id column (col 2)
  const matches = sheet
    .getRange(2, 2, lastRow - 1, 1)
    .createTextFinder(petId)
    .matchEntireCell(true)
    .findAll();

  if (!matches || matches.length === 0) {
    cache.put(cacheKey, '[]', COMMENTS_CACHE_TTL_SEC);
    return jsonResponse_({ ok: true, comments: [] });
  }

  // Take the most recent up to 50 comment matches and read a bounded range in ONE getRange call
  const recentMatches = matches.slice(-50);
  const maxRow = recentMatches[recentMatches.length - 1].getRow();
  const minRow = Math.max(recentMatches[0].getRow(), maxRow - 500 + 1);
  const numRows = maxRow - minRow + 1;

  const data = sheet.getRange(minRow, 1, numRows, COMMENTS_HEADERS.length).getValues();
  const matched = [];
  for (let i = 0; i < data.length; i++) {
    const rowPetId = fromSafeText_(data[i][1]);
    if (rowPetId === petId) {
      matched.push({
        id: String(data[i][0] || ''),
        petId: rowPetId,
        ts: Number(data[i][2]) || 0,
        author: fromSafeText_(data[i][3]),
        text: fromSafeText_(data[i][4])
      });
    }
  }

  try {
    cache.put(cacheKey, JSON.stringify(matched), COMMENTS_CACHE_TTL_SEC);
  } catch (_e) {
    // Ignore if comments payload exceeds cache entry limit
  }

  return jsonResponse_({ ok: true, comments: matched });
}

/**
 * Handle adding a new pet report (idempotent on client-generated UUID `id`).
 */
function handleAdd_(data) {
  // Reject honeypot-filled submissions silently
  if (data.website && String(data.website).trim() !== '') {
    return jsonResponse_({ ok: true });
  }

  const ipKey = normalizeIpKey_(data._ip);
  if (!ipKey) {
    return jsonResponse_({ ok: false, code: 'ERR_MISSING_IP', error: 'Missing client identifier.' });
  }

  const folderId = getOrCreateFolderId_();
  if (!folderId) {
    logError_('ERR_MISSING_FOLDER_ID', 'handleAdd_', 'FOLDER_ID is not set in Script Properties and auto-creation failed.');
    return jsonResponse_({
      ok: false,
      code: 'ERR_CONFIG',
      error: 'Server photo storage is not configured.'
    });
  }

  const pinSalt = getOrCreatePinSalt_();
  if (!pinSalt) {
    logError_('ERR_MISSING_PIN_SALT', 'handleAdd_', 'PIN_SALT is not set in Script Properties and auto-generation failed.');
    return jsonResponse_({
      ok: false,
      code: 'ERR_CONFIG',
      error: 'Server security configuration is incomplete.'
    });
  }

  // Server-side validation
  const gov = String(data.gov || '').trim().toLowerCase();
  if (VALID_GOVS.indexOf(gov) === -1) {
    return jsonResponse_({ ok: false, code: 'ERR_BAD_GOV', error: 'Invalid governorate.' });
  }

  const city = String(data.city || '').trim().slice(0, 100);

  const animalType = String(data.type || '').trim().toLowerCase();
  if (VALID_TYPES.indexOf(animalType) === -1) {
    return jsonResponse_({ ok: false, code: 'ERR_BAD_TYPE', error: 'Invalid animal type.' });
  }

  const condition = String(data.cond || '').trim().toLowerCase();
  if (VALID_CONDITIONS.indexOf(condition) === -1) {
    return jsonResponse_({ ok: false, code: 'ERR_BAD_COND', error: 'Invalid condition.' });
  }

  // GPS coordinates are optional; if provided, validate they fall within Egypt
  const hasLat = data.lat !== undefined && data.lat !== null && data.lat !== '';
  const hasLng = data.lng !== undefined && data.lng !== null && data.lng !== '';
  let latVal = '';
  let lngVal = '';

  if (hasLat || hasLng) {
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    if (
      !hasLat ||
      !hasLng ||
      isNaN(lat) ||
      isNaN(lng) ||
      lat < EGYPT_LAT_MIN ||
      lat > EGYPT_LAT_MAX ||
      lng < EGYPT_LNG_MIN ||
      lng > EGYPT_LNG_MAX
    ) {
      return jsonResponse_({
        ok: false,
        code: 'ERR_OUTSIDE_EGYPT',
        error: 'GPS coordinates must be within Egypt.'
      });
    }
    latVal = Math.round(lat * 1e5) / 1e5;
    lngVal = Math.round(lng * 1e5) / 1e5;
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
        code: 'ERR_BAD_CONTACT',
        error: 'Contact number must be 8 to 15 digits including country code.'
      });
    }
  }

  const mimeType = String(data.mimeType || 'image/webp').trim().toLowerCase();
  if (ALLOWED_MIMES.indexOf(mimeType) === -1) {
    return jsonResponse_({ ok: false, code: 'ERR_BAD_MIME', error: 'Unsupported image MIME type.' });
  }

  const rawBase64 = String(data.photoBase64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!rawBase64) {
    return jsonResponse_({ ok: false, code: 'ERR_MISSING_PHOTO', error: 'Photo is required.' });
  }

  const bytes = Utilities.base64Decode(rawBase64);
  if (!bytes || bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    return jsonResponse_({
      ok: false,
      code: 'ERR_PHOTO_SIZE',
      error: 'Photo exceeds maximum allowed size (300 KB).'
    });
  }

  // Verify magic bytes match claimed MIME type
  const detectedMime = detectImageMime_(bytes);
  if (!detectedMime || detectedMime !== mimeType) {
    return jsonResponse_({
      ok: false,
      code: 'ERR_MIME_MISMATCH',
      error: 'Uploaded image content does not match declared MIME type.'
    });
  }

  const rawClientId = String(data.id || '').trim();
  const id = UUID_REGEX.test(rawClientId) ? rawClientId : Utilities.getUuid();
  const cache = CacheService.getScriptCache();

  // Atomic idempotency check AND rate-limit check/increment inside script lock BEFORE Drive upload
  const rlLock = LockService.getScriptLock();
  rlLock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PETS);
    const lastRow = sheet ? sheet.getLastRow() : 0;
    if (lastRow >= 2 && UUID_REGEX.test(rawClientId)) {
      const scanRows = Math.min(lastRow - 1, 300);
      const scanStart = Math.max(2, lastRow - scanRows + 1);
      const existingCell = sheet
        .getRange(scanStart, COL.id + 1, scanRows, 1)
        .createTextFinder(id)
        .matchEntireCell(true)
        .findNext();
      if (existingCell) {
        const existingPhoto = String(
          sheet.getRange(existingCell.getRow(), COL.photo_id + 1).getValue() || ''
        );
        return jsonResponse_({
          ok: true,
          id: id,
          photo: existingPhoto,
          duplicate: true
        });
      }
    }

    if (!checkAndIncrementRateLimit_(cache, 'add', ipKey, RL_ADD_MAX)) {
      return jsonResponse_({
        ok: false,
        code: 'ERR_RATE_LIMIT',
        error: 'Rate limit exceeded (max 5 reports per hour).'
      });
    }
  } finally {
    rlLock.releaseLock();
  }

  const pin = String(Math.floor(1000 + Math.random() * 9000));
  const pinHash = hashPin_(pin, pinSalt);

  // Upload photo to Drive AFTER validation and rate limiting
  const ext = mimeType === 'image/png' ? '.png' : mimeType === 'image/jpeg' ? '.jpg' : '.webp';
  const blob = Utilities.newBlob(bytes, mimeType, 'pet_' + id + ext);
  const file = DriveApp.getFolderById(folderId).createFile(blob);
  const photoId = file.getId();

  const createdAt = Date.now();
  const newRow = [
    id,
    createdAt,
    gov,
    safeText_(city),
    latVal,
    lngVal,
    animalType,
    condition,
    safeText_(description),
    photoId,
    safeText_(contact),
    'available',
    pinHash
  ];

  // Lock around sheet write operation and trash uploaded photo if sheet write fails
  const writeLock = LockService.getScriptLock();
  writeLock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PETS);
    sheet.appendRow(newRow);
    invalidateGovCache_(cache, gov);
  } catch (writeErr) {
    try {
      file.setTrashed(true);
    } catch (_trashErr) {
      // Ignore cleanup error
    }
    throw writeErr;
  } finally {
    writeLock.releaseLock();
  }

  return jsonResponse_({ ok: true, id: id, photo: photoId, pin: pin });
}

/**
 * Handle marking a pet as adopted/rescued (requires valid 4-digit reporter PIN).
 */
function handleMarkAdopted_(data) {
  const id = String(data.id || '').trim();
  const pin = String(data.pin || '').trim();
  if (!UUID_REGEX.test(id)) {
    return jsonResponse_({ ok: false, code: 'ERR_BAD_ID', error: 'Invalid pet ID.' });
  }
  if (!/^\d{4}$/.test(pin)) {
    return jsonResponse_({ ok: false, code: 'ERR_BAD_PIN', error: 'A valid 4-digit PIN is required.' });
  }

  const pinSalt = getOrCreatePinSalt_();
  if (!pinSalt) {
    logError_('ERR_MISSING_PIN_SALT', 'handleMarkAdopted_', 'PIN_SALT is not set in Script Properties and auto-generation failed.');
    return jsonResponse_({
      ok: false,
      code: 'ERR_CONFIG',
      error: 'Server security configuration is incomplete.'
    });
  }

  const cache = CacheService.getScriptCache();
  const failKey = 'pin_fail_' + id;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const failCount = parseInt(cache.get(failKey) || '0', 10);
    if (failCount >= RL_PIN_FAIL_MAX) {
      return jsonResponse_({
        ok: false,
        code: 'ERR_PIN_LOCKED',
        error: 'Too many wrong PIN attempts for this case. Please try again in an hour.'
      });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PETS);
    const lastRow = sheet ? sheet.getLastRow() : 0;
    if (lastRow < 2) {
      return jsonResponse_({ ok: false, code: 'ERR_NOT_FOUND', error: 'Pet not found.' });
    }

    const finder = sheet
      .getRange(2, COL.id + 1, lastRow - 1, 1)
      .createTextFinder(id)
      .matchEntireCell(true);
    const cell = finder.findNext();
    if (!cell) {
      return jsonResponse_({ ok: false, code: 'ERR_NOT_FOUND', error: 'Pet not found.' });
    }

    const rowNum = cell.getRow();
    const rowData = sheet.getRange(rowNum, 1, 1, SHEET_HEADERS.length).getValues()[0];
    const storedHash = String(rowData[COL.pin_hash] || '').trim();
    const rowGov = String(rowData[COL.governorate] || '').trim().toLowerCase();

    if (!storedHash) {
      return jsonResponse_({
        ok: false,
        code: 'ERR_LEGACY_NO_PIN',
        error: 'This older report has no PIN and can only be closed by moderators.'
      });
    }

    const candidateHash = hashPin_(pin, pinSalt);
    if (!timingSafeEqual_(candidateHash, storedHash)) {
      cache.put(failKey, String(failCount + 1), 3600);
      return jsonResponse_({
        ok: false,
        code: 'ERR_INVALID_PIN',
        error: 'Incorrect reporter PIN.'
      });
    }

    sheet.getRange(rowNum, COL.status + 1).setValue('adopted');
    cache.remove(failKey);
    invalidateGovCache_(cache, rowGov);
  } finally {
    lock.releaseLock();
  }

  return jsonResponse_({ ok: true });
}

/**
 * Handle non-owner visitors reporting a pet case as adopted for moderator review.
 * Does NOT change the status on the Pets sheet.
 */
function handleReportAdopted_(data) {
  const id = String(data.id || '').trim();
  if (!UUID_REGEX.test(id)) {
    return jsonResponse_({ ok: false, code: 'ERR_BAD_ID', error: 'Invalid pet ID.' });
  }

  const ipKey = normalizeIpKey_(data._ip);
  if (!ipKey) {
    return jsonResponse_({ ok: false, code: 'ERR_MISSING_IP', error: 'Missing client identifier.' });
  }

  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (!checkAndIncrementRateLimit_(cache, 'report_adopted', ipKey, RL_REPORT_ADOPTED_MAX)) {
      return jsonResponse_({
        ok: false,
        code: 'ERR_RATE_LIMIT',
        error: 'Rate limit exceeded. Please try again later.'
      });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const petsSheet = ss.getSheetByName(SHEET_PETS);
    const lastRow = petsSheet ? petsSheet.getLastRow() : 0;
    if (lastRow < 2) {
      return jsonResponse_({ ok: false, code: 'ERR_NOT_FOUND', error: 'Pet not found.' });
    }

    const cell = petsSheet
      .getRange(2, COL.id + 1, lastRow - 1, 1)
      .createTextFinder(id)
      .matchEntireCell(true)
      .findNext();
    if (!cell) {
      return jsonResponse_({ ok: false, code: 'ERR_NOT_FOUND', error: 'Pet not found.' });
    }

    const gov = String(petsSheet.getRange(cell.getRow(), COL.governorate + 1).getValue() || '');
    let reportsSheet = ss.getSheetByName(SHEET_REPORTS);
    if (!reportsSheet) {
      reportsSheet = ss.insertSheet(SHEET_REPORTS);
      reportsSheet.getRange(1, 1, 1, REPORTS_HEADERS.length).setValues([REPORTS_HEADERS]);
      reportsSheet.setFrozenRows(1);
    }

    reportsSheet.appendRow([
      Utilities.getUuid(),
      safeText_(id),
      Date.now(),
      safeText_(gov),
      safeText_(ipKey)
    ]);

    return jsonResponse_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Try reading a governorate's chunked list from CacheService in ONE getAll call.
 * Returns Array of compact rows on hit, or null on miss.
 */
function readGovFromCache_(cache, gov) {
  const keys = govCacheKeys_(gov);
  const cached = cache.getAll(keys);
  const metaKey = 'gov_' + gov + '_meta';
  if (!cached || !cached[metaKey]) {
    return null;
  }
  const chunkCount = parseInt(cached[metaKey], 10);
  if (chunkCount === 0) {
    return [];
  }
  if (chunkCount > 0 && chunkCount <= MAX_GOV_CHUNKS) {
    const parts = [];
    for (let i = 0; i < chunkCount; i++) {
      const part = cached['gov_' + gov + '_' + i];
      if (typeof part !== 'string') {
        return null;
      }
      parts.push(part);
    }
    try {
      return JSON.parse(parts.join(''));
    } catch (_e) {
      return null;
    }
  }
  return null;
}

/**
 * Build chunked cache entries for a single governorate, trimming oldest rows if JSON exceeds
 * MAX_GOV_CHUNKS * CHUNK_SIZE instead of silently bypassing the cache.
 */
function buildGovChunksObj_(gov, govRows) {
  const rowsCopy = govRows.slice(0, MAX_GOV_RESULTS);
  const maxChars = MAX_GOV_CHUNKS * CHUNK_SIZE;
  let jsonStr = JSON.stringify(rowsCopy);

  if (jsonStr.length > maxChars) {
    logError_(
      'WARN_CACHE_TRIM',
      'buildGovChunksObj_:' + gov,
      'Governorate JSON length ' + jsonStr.length + ' exceeded ' + maxChars + '; trimming oldest rows.'
    );
    while (rowsCopy.length > 0 && jsonStr.length > maxChars) {
      rowsCopy.pop();
      jsonStr = JSON.stringify(rowsCopy);
    }
  }

  const chunksObj = {};
  if (rowsCopy.length === 0) {
    chunksObj['gov_' + gov + '_meta'] = '0';
    return { chunksObj: chunksObj, rows: rowsCopy };
  }

  let chunkIndex = 0;
  for (let pos = 0; pos < jsonStr.length; pos += CHUNK_SIZE) {
    chunksObj['gov_' + gov + '_' + chunkIndex] = jsonStr.slice(pos, pos + CHUNK_SIZE);
    chunkIndex++;
  }
  chunksObj['gov_' + gov + '_meta'] = String(chunkIndex);
  return { chunksObj: chunksObj, rows: rowsCopy };
}

/**
 * Read the last MAX_RECENT_ROWS (1500) rows in ONE getRange call, partition by governorate,
 * sort newest first, cap at 100 per governorate, and store in CacheService with ONE putAll.
 */
function rebuildAllGovCaches_(cache) {
  const byGov = {};
  for (let g = 0; g < VALID_GOVS.length; g++) {
    byGov[VALID_GOVS[g]] = [];
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PETS);
  const lastRow = sheet ? sheet.getLastRow() : 0;

  if (lastRow >= 2) {
    const startRow = Math.max(2, lastRow - MAX_RECENT_ROWS + 1);
    const numRows = lastRow - startRow + 1;
    const colCount = Math.min(sheet.getLastColumn(), SHEET_HEADERS.length);
    const rawRows = sheet.getRange(startRow, 1, numRows, colCount).getValues();

    // Sort available and adopted rows newest first
    const activeAndAdopted = [];
    for (let i = 0; i < rawRows.length; i++) {
      const r = rawRows[i];
      const status = String(r[COL.status] || '').trim().toLowerCase();
      const rowGov = String(r[COL.governorate] || '').trim().toLowerCase();
      if ((status === 'available' || status === 'adopted') && r[COL.id] && byGov[rowGov]) {
        activeAndAdopted.push(r);
      }
    }

    activeAndAdopted.sort(function (a, b) {
      return Number(b[COL.created_at] || 0) - Number(a[COL.created_at] || 0);
    });

    for (let j = 0; j < activeAndAdopted.length; j++) {
      const row = activeAndAdopted[j];
      const rowGov = String(row[COL.governorate] || '').trim().toLowerCase();
      const list = byGov[rowGov];
      if (list && list.length < MAX_GOV_RESULTS) {
        const rawContact = String(fromSafeText_(row[COL.contact]) || '').replace(/\D+/g, '');
        const rawLat = row[COL.lat];
        const rawLng = row[COL.lng];
        const hasCoords =
          rawLat !== '' &&
          rawLat !== null &&
          rawLat !== undefined &&
          rawLng !== '' &&
          rawLng !== null &&
          rawLng !== undefined &&
          Number(rawLat) !== 0 &&
          Number(rawLng) !== 0 &&
          !isNaN(Number(rawLat)) &&
          !isNaN(Number(rawLng));
        list.push([
          String(row[COL.id]),
          Math.floor(Number(row[COL.created_at] || 0) / 1000),
          rowGov,
          fromSafeText_(row[COL.city]).trim(),
          hasCoords ? Math.round(Number(rawLat) * 1e5) / 1e5 : null,
          hasCoords ? Math.round(Number(rawLng) * 1e5) / 1e5 : null,
          String(row[COL.animal_type] || '').trim().toLowerCase(),
          String(row[COL.condition] || '').trim().toLowerCase(),
          fromSafeText_(row[COL.description]).trim().slice(0, 300),
          String(row[COL.photo_id] || '').trim(),
          Boolean(rawContact),
          String(row[COL.status] || 'available').trim().toLowerCase()
        ]);
      }
    }
  }

  const allChunksToPut = {};
  for (let g = 0; g < VALID_GOVS.length; g++) {
    const govId = VALID_GOVS[g];
    const built = buildGovChunksObj_(govId, byGov[govId]);
    byGov[govId] = built.rows;
    const keys = Object.keys(built.chunksObj);
    for (let k = 0; k < keys.length; k++) {
      allChunksToPut[keys[k]] = built.chunksObj[keys[k]];
    }
  }

  try {
    cache.putAll(allChunksToPut, CACHE_TTL_SEC);
  } catch (err) {
    logError_('WARN_CACHE_PUTALL', 'rebuildAllGovCaches_', err);
  }

  return byGov;
}

/**
 * Get cached compact rows for a governorate or rebuild safely using tryLock to prevent stampede.
 */
function getCachedOrBuildGovPets_(gov, forceFresh) {
  const cache = CacheService.getScriptCache();
  if (!forceFresh) {
    const hit = readGovFromCache_(cache, gov);
    if (hit !== null) {
      return hit;
    }
  }

  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(5000);
  try {
    if (gotLock && !forceFresh) {
      const secondCheck = readGovFromCache_(cache, gov);
      if (secondCheck !== null) {
        return secondCheck;
      }
    }
    const allByGov = rebuildAllGovCaches_(cache);
    return allByGov[gov] || [];
  } finally {
    if (gotLock) {
      lock.releaseLock();
    }
  }
}

/**
 * Time-driven trigger (every 5 minutes) to warm per-governorate caches so users never hit a cold start.
 */
function warmCaches() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    rebuildAllGovCaches_(CacheService.getScriptCache());
  } catch (err) {
    logError_('ERR_WARM_CACHES', 'warmCaches', err);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Invalidate only the affected governorate's cache in ONE removeAll call.
 */
function invalidateGovCache_(cache, gov) {
  const c = cache || CacheService.getScriptCache();
  if (gov && VALID_GOVS.indexOf(gov) !== -1) {
    c.removeAll(govCacheKeys_(gov));
  } else {
    c.removeAll(allGovCacheKeys_());
  }
}

/**
 * Invalidate all governorate caches in ONE removeAll call.
 */
function invalidateAllGovCaches_(cache) {
  const c = cache || CacheService.getScriptCache();
  c.removeAll(allGovCacheKeys_());
}

/**
 * Daily archive job triggered at 03:00.
 * Moves rows where status === 'adopted' OR older than 60 days to the Archive sheet,
 * and trashes their Drive photos inside try/catch with a 4.5-minute time budget.
 */
function archiveOld() {
  const startMs = Date.now();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const petsSheet = ss.getSheetByName(SHEET_PETS);
    let archiveSheet = ss.getSheetByName(SHEET_ARCHIVE);
    if (!archiveSheet) {
      archiveSheet = ss.insertSheet(SHEET_ARCHIVE);
      archiveSheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
      archiveSheet.setFrozenRows(1);
      formatColumnsPlainText_(archiveSheet, [COL.city + 1, COL.description + 1, COL.contact + 1]);
    }

    const lastRow = petsSheet.getLastRow();
    if (lastRow < 2) return;

    const numRows = lastRow - 1;
    const allData = petsSheet.getRange(2, 1, numRows, SHEET_HEADERS.length).getValues();
    const cutoffMs = Date.now() - ARCHIVE_MAX_AGE_MS;

    const keep = [];
    const move = [];

    for (let i = 0; i < allData.length; i++) {
      const row = allData[i].slice();
      // Ensure free-text fields remain sanitized without double-prefixing
      row[COL.city] = safeText_(fromSafeText_(row[COL.city]));
      row[COL.description] = safeText_(fromSafeText_(row[COL.description]));
      row[COL.contact] = safeText_(fromSafeText_(row[COL.contact]));

      const createdAt = Number(row[COL.created_at] || 0);
      const status = String(row[COL.status] || '').trim().toLowerCase();
      // Keep adopted pets visible for 30 days before archiving and trashing Drive photos
      const ADOPTED_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
      const shouldArchive =
        (status === 'adopted' && createdAt > 0 && createdAt < Date.now() - ADOPTED_GRACE_PERIOD_MS) ||
        (createdAt > 0 && createdAt < cutoffMs);

      if (shouldArchive && Date.now() - startMs < ARCHIVE_TIME_BUDGET_MS) {
        const photoId = String(row[COL.photo_id] || '').trim();
        if (photoId) {
          try {
            DriveApp.getFileById(photoId).setTrashed(true);
          } catch (_trashErr) {
            // Continue even if file was already deleted or inaccessible
          }
        }
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

    invalidateAllGovCaches_(CacheService.getScriptCache());
  } finally {
    lock.releaseLock();
  }
}

/**
 * Format JSON output with proper MIME type.
 */
function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
