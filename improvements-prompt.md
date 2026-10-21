# Task: Security, reliability and performance improvements for Street Pets Egypt (SavePets)

You are working in the repository `Eslammdawy/SavePets` (React 18 + Vite 5 frontend, Tencent EdgeOne Pages edge functions in `edge-functions/api/`, Google Apps Script backend in `Code.gs`, Google Sheets as the database, Google Drive for photos).

A code review found the issues below. Fix them in the phases given. Read each file before editing it. Do not rewrite things that are not listed.

## Ground rules

- Keep the architecture: React + Vite, vanilla CSS, Apps Script backend, EdgeOne edge proxy. Do not add UI frameworks or a new backend.
- Keep it bilingual (Arabic RTL / English LTR). Every new user-facing string goes into both dictionaries in `src/i18n.js`.
- Keep the Google quota discipline: bounded reads, one `getRange` per read, one `putAll` and one `removeAll` per cache operation, no per-file `setSharing`.
- Reporter phone numbers must never appear in HTML, attributes, tooltips, logs, or any public API response.
- Work phase by phase. After each phase, run `npm run build` and fix any warning or error before moving on. Make one commit per phase with a clear message.
- Some claims below are marked **VERIFY**. Check them yourself first. If the claim turns out to be wrong, say so in your final report and skip that item.
- Do not invent secrets. Anything secret (shared secret, folder ID) is read from environment variables or Apps Script Script Properties, and you document in `README.md` and `.env.example` what the owner must set.

---

## Phase 1: Critical security and privacy

### 1.1 Stop leaking phone numbers (`Code.gs`, `src/api.js`, `src/i18n.js`, `src/PetCard.jsx`, edge functions)

Problem: `contact` is in `COMPACT_HEADERS` (about line 54) and in each compact row (about line 523). `/api/list` is public and edge-cached, so anyone can collect every number with one request.

Do:
- Remove `contact` from the list response. Return a boolean `hc` (has contact) instead. Update `COMPACT_HEADERS`, the row builder, `expandCompactResponse`, `buildAutoSummary` and `buildWhatsAppUrl` accordingly (they currently read `pet.contact`).
- Add a new GET action `contact` in `Code.gs` that takes a pet `id` and returns the digits for that pet only. Rate-limit it (see 1.4) and never cache it (`Cache-Control: no-store`).
- Add `edge-functions/api/contact.js` that validates `id` (UUID format), forwards to Apps Script, and returns `no-store`.
- In `PetCard.jsx`, the WhatsApp button must fetch the number on click (show a short loading state), then open `https://wa.me/<digits>?text=...` in a new tab. Do not put the number in the DOM before the click.
- Saved bookmarks in `localStorage` (`src/bookmarks.js`) currently store full pet objects. Make sure they no longer store any phone number, including entries saved by older versions (strip `contact` when loading).

Acceptance: `curl /api/list?gov=cairo` contains no phone number anywhere in the body. The WhatsApp button still works.

### 1.2 Spreadsheet formula injection (`Code.gs`)

Problem: `sheet.appendRow(newRow)` (about line 394) and the comment `appendRow` (about line 237) write raw strings. A string starting with `=` becomes a formula, e.g. `=IMPORTXML(...)` can send sheet data to an attacker.

Do:
- Add a helper `safeText_(value)` that returns the string, and if it starts with `=`, `+`, `-`, `@`, tab or carriage return, prefixes it with a single quote character so it stays text.
- Apply it to every user-controlled text field before writing: `city`, `description`, comment `author` and `text`, and `petId`.
- In `setup()`, also set the free-text columns (city, description, contact on Pets/Archive; author, text on Comments) to plain-text format with `setNumberFormat('@')`. Make sure the code that reads those columns still works.
- Apply the same sanitizer in `archiveOld` only if it re-derives text. Do not double-prefix.

Acceptance: submitting a description of `=1+1` shows `=1+1` as plain text in the sheet and in the app.

### 1.3 Closing a case must not be open to everyone (`Code.gs`, `src/PetCard.jsx`, `src/AdoptView.jsx`, `src/api.js`)

Problem: `markAdopted` needs only a public pet ID, and every visitor sees a "Mark as adopted" button on every card.

Implement the reporter PIN from the roadmap:
- On a successful `add`, the server generates a 4-digit PIN, stores only a salted hash (SHA-256 via `Utilities.computeDigest`, salt from Script Properties) in a new `pin_hash` column at the END of the Pets sheet schema (append to `SHEET_HEADERS`; do not reorder existing columns), and returns the PIN once in the response.
- The client shows the PIN prominently after submit (with a "save this" note) and stores the pet ID + PIN in `localStorage` for that device.
- `markAdopted` requires `id` and `pin`; the server compares hashes and returns a clear error on mismatch. Add a per-pet attempt limit (for example 5 wrong tries per hour, tracked in `CacheService`).
- In the UI, show the "Mark as adopted" button only when this device owns the pet (has the PIN stored). For other visitors show a "Report as adopted" action that sends a `reportAdopted` request, stored in a new `Reports` sheet for moderator review. It must NOT change the status.
- Handle old rows without `pin_hash`: they can only be closed by the owner editing the sheet. Document this in `README.md`.
- Update `setup()` so new deployments get the extra column, and document the migration step for existing sheets (add `pin_hash` header at the end of Pets and Archive).

Acceptance: a stranger cannot change a case's status using only IDs from the public list.

### 1.4 Real rate limiting and a shared secret (edge functions, `Code.gs`)

Problem: the rate limit is keyed by a browser-generated `clientId`, so it is trivially bypassed. The counter is read before the lock and written after the Drive upload, so concurrent requests all pass. The Apps Script URL is "Anyone", so the proxy can be skipped. `addComment`, `markAdopted` and `contact` have no limits.

Do:
- In `edge-functions/api/post.js` and `contact.js`, read the real client IP from the platform header (**VERIFY** the correct EdgeOne header name in the EdgeOne docs before using it; do not guess). Derive the limiting key from a hash of the IP, and inject it plus a shared secret into the JSON body sent to Apps Script (`_ip`, `_secret`). The secret comes from an EdgeOne environment variable `EDGE_SHARED_SECRET`. Drop any `_ip` or `_secret` sent by the browser.
- In `Code.gs`, read the secret from Script Properties. Reject every `doPost` and the `contact` GET when the secret is missing or wrong. Keep the public `list` GET open.
- Do the rate-limit check and increment atomically inside the script lock, using the IP-derived key, before the Drive upload. Apply limits per action: add (5/hour), comment (20/hour), contact lookup (30/hour), PIN attempts (see 1.3).
- Validate on the server, not just the client: lat/lng must be inside Egypt (roughly lat 21.7 to 31.7, lng 24.7 to 36.9); detect the real image type from the first bytes (WebP `RIFF....WEBP`, JPEG `FFD8FF`, PNG `89504E47`) and reject mismatches with the claimed MIME; validate that `petId` for comments exists in the Pets sheet or Archive and is a UUID.
- Do not return raw `err.message` from `doGet`/`doPost`. Return a generic error plus a short error code, and log the real error to a `Logs` sheet (cap it at 500 rows).

Acceptance: sending random `clientId` values no longer bypasses the limit; calling the Apps Script URL directly without the secret is rejected.

### 1.5 Remove the committed Drive folder ID and keep the GAS URL private

- Move `FOLDER_ID` from `Code.gs` into Script Properties (`PropertiesService.getScriptProperties()`), fail clearly if it is missing, and document it in `README.md`. Remove the hardcoded ID.
- Add a note in `README.md` and `.env.example`: never set `VITE_GAS_URL` in the production build (it would bake the Apps Script URL into the public JS). Optionally make `api.js` ignore `VITE_GAS_URL` unless `import.meta.env.DEV` is true.

---

## Phase 2: Data correctness and reliability

### 2.1 Edge must not cache errors (`edge-functions/api/list.js`)

Problem: the function sets `Cache-Control: public, max-age=0, s-maxage=300` on whatever Apps Script returns. Apps Script returns HTTP 200 for `{ok:false}` errors and quota pages, so an error can be cached for 5 minutes.

Do:
- Read the body text, and set the public cache header ONLY when `upstream.ok` is true and the body parses as JSON with `ok === true`. Otherwise respond with `Cache-Control: no-store`. If the upstream returned a non-JSON body, return a 502 JSON error with `no-store`.
- **VERIFY** how EdgeOne caches edge-function responses. The EdgeOne Cache API docs (https://edgeone.ai/document/52710) show an explicit `caches.default` `match`/`put` pattern. If header-only caching does not work for edge functions, implement the Cache API pattern with a normalized cache key (lowercase `gov`, ignore all other query parameters so random extra params cannot bypass the cache).
- Support `?fresh=1`: skip reading the edge cache and do not store the result. The browser will use it right after a write (see 2.2).
- The worklog claims `stale-while-revalidate=60`. Either add it or fix the worklog.

### 2.2 The author must see their own new report (`src/api.js`, `src/AdoptView.jsx`, `src/ShareView.jsx`)

Problem: after submit, `AdoptView` refetches `/api/list`, which can be a stale edge copy for up to 5 minutes, and the client also caches that stale result for 5 more minutes. The same happens after marking a case adopted.

Do:
- After a successful `add`, insert the new pet (built from the payload and the response `id`/`photo`) at the top of the cached list for that governorate in memory and `sessionStorage`, then render it.
- After any write, the next network fetch for that governorate uses `&fresh=1`.

### 2.3 Offline queue correctness (`src/offlineQueue.js`, `src/ShareView.jsx`, `src/App.jsx`, `Code.gs`)

Do:
- Generate a UUID (`crypto.randomUUID()`, with a fallback) on the client when the report is created, send it as `id`, and make the server idempotent: if that `id` already exists in Pets (check recent rows, bounded) return the existing result instead of creating a duplicate. Same for comments (`commentId` already exists, make the server ignore duplicates).
- `saveOfflineQueue` must return success or failure. If storage fails (quota), `enqueueOfflineReport` must return an error, and `ShareView` must NOT clear the form; it shows a clear message ("storage is full, free some space or submit when online"). Add a size guard: cap the queue length (for example 15 reports).
- Make `flushOfflineQueue` single-flight with a module-level promise so the `online` event and the Sync button cannot run two flushes at once.
- Do not overwrite the queue at the end of a flush. After each item succeeds, remove only that item from the freshly re-read queue, so reports queued during a flush are never lost.
- Classify errors: network errors, 429/rate-limit and 5xx are retryable (keep in queue, back off). Validation errors are permanent: move them to a `failed` list with the reason shown in the banner and a "discard" action, instead of retrying forever.

### 2.4 Comments must actually be shared (`src/comments.js`, `src/api.js`, `Code.gs`, `src/PetCard.jsx`)

Problem: nothing in `src` calls the backend `action=comments`, so comments are only ever local. The server also reads only the last 200 rows across all pets.

Do:
- When the comment tray opens, fetch that pet's comments from the server (`GET ?action=comments&petId=`), merge with local optimistic ones by `id`, and cache per pet for a few minutes. Do not fetch for every card on load. Show a count only from the data you have (local count, or `hc`-style `cc` count if you add one to the list; optional).
- On the server, find comments for a pet efficiently: use `TextFinder` or a bounded scan, but do not rely on "last 200 rows of everything". Cache per-pet comment responses in `CacheService` (60 seconds) and invalidate on `addComment`.
- Comments need the same protections as reports: shared secret, IP rate limit, text sanitizer (1.2), length limits, honeypot field, and server-generated timestamps (ignore the client `ts`).

### 2.5 Sheet window and archive (`Code.gs`)

- Fix the "last 300 rows nationwide" window. Keep one cache per governorate (`gov_<id>` keys, chunked the same way) built from the last N rows where N is larger (for example 1500), filtered by status `available`, newest first, capped at 100 per governorate. Keep reads bounded with one `getRange`. Update `CACHE_KEYS`/invalidations accordingly; invalidate only the affected governorate on write where possible.
- Make the cache rebuild safe: if the JSON for a governorate exceeds the number of pre-allocated chunks, log it and fall back to trimming the oldest rows instead of silently bypassing the cache. Use `tryLock` around the rebuild to avoid a stampede.
- `archiveOld`: also trash the Drive photo of each archived row (`DriveApp.getFileById(photo_id).setTrashed(true)`) inside try/catch with a time budget (stop before about 5 minutes and let the next run continue). Keep the existing single `setValues` approach. Run it daily instead of monthly (rows older than 60 days or adopted).
- Replace hardcoded column indexes (`r[11]`, `getRange(row, 12)`) with a column map derived from `SHEET_HEADERS`.
- In `handleAdd_`, upload the photo AFTER validation and rate limiting. If the sheet write fails afterwards, trash the uploaded file.
- Add a time-driven trigger (every 5 minutes) that rebuilds the list caches so users never hit a cold start. Install it in `setup()` if missing.

### 2.6 Client request safety (`src/api.js`, `src/AdoptView.jsx`)

- Add `AbortController` timeouts to every fetch (list 15 s, post 30 s). Timeouts are retryable.
- Make `runSearchForGov` latest-request-wins (ignore responses for an outdated governorate) and de-duplicate in-flight requests per governorate.
- On a failed `markAdopted` or `reportAdopted`, roll back the optimistic UI change and show an error.
- When a governorate list loads, reconcile saved bookmarks for that governorate: remove or mark as "closed" any saved pet no longer in the list.

---

## Phase 3: Frontend performance and quality

### 3.1 Map view (`src/AdoptView.jsx`, `src/PetMapView.jsx`)

Problem: `filteredPets` is a new array every render, and the marker effect depends on `pets`, so any parent state change (such as bookmarking a card) rebuilds all markers and re-runs `fitBounds`. The effect also reads `selectedPetId` but does not list it as a dependency, so the selected-pin highlight never updates.

Do:
- Wrap `enrichedPets` and `filteredPets` in `useMemo` with correct dependencies, and memoize `savedIds`.
- In `PetMapView`, split the effect: rebuild markers when the pet list changes (compare by ID list), update only the selected marker style when `selectedPetId` changes, and call `fitBounds` only when the ID set actually changes.
- Show a visible message in the map area if Leaflet fails to load (offline or CDN error). Load Leaflet with a pinned version and an `integrity` (SRI) hash plus `crossorigin`. **VERIFY** the correct SRI hashes for `leaflet@1.9.4` from the official Leaflet download page; do not invent hashes.

### 3.2 Fonts and CSS (`index.html`, `src/styles.css`)

- **VERIFY** which selector the `backdrop-filter: blur(14px)` at about line 146 of `src/styles.css` belongs to, and whether `.surface-card` (used by every pet card) inherits any blur. Remove blur from list cards and use a solid, slightly translucent background instead. Keep blur only on the sticky header, bottom nav and modal backdrops. Add `@media (prefers-reduced-transparency: reduce)` and `@supports not (backdrop-filter: blur(1px))` fallbacks.
- Fonts: remove the render-blocking Google Fonts stylesheet. Self-host a variable Cairo font (Arabic and Latin subsets, woff2, via `@fontsource-variable/cairo` or files in `public/fonts/`), preload the main file, use `font-display: swap`. Drop Plus Jakarta Sans unless the CSS truly depends on it (it appears once); if you keep it, self-host a single weight range too.
- `RescuePosterModal.jsx`: before drawing, `await document.fonts.load('800 44px Cairo')` (and the weights you use) so exported PNGs use the right font.

### 3.3 Images and poster (`src/api.js`, edge functions, `src/RescuePosterModal.jsx`)

- Add `edge-functions/api/img.js`: takes `id` (validated against `^[A-Za-z0-9_-]{10,80}$`), fetches the Drive thumbnail server-side, and returns it with `Cache-Control: public, max-age=31536000, immutable` and `Access-Control-Allow-Origin: *`. Use the Cache API pattern if needed (see 2.1). Add a size limit and a content-type check (images only).
- Switch `getDrivePhotoUrl` to `/api/img?id=...` (keep a direct Drive URL as a fallback via `onError` in `PetCard`).
- **VERIFY** whether the poster currently falls back to the emoji placeholder because of CORS. With the proxy returning CORS headers, the poster should include the real photo.

### 3.4 Smaller improvements

- `PetCard`: wrap in `React.memo`; load comments from localStorage lazily (when the tray opens), not on mount.
- `PetCard` images: add explicit `width`/`height` or an `aspect-ratio` on the wrapper to avoid layout shift.
- `imageCompress.js`: use `createImageBitmap` and `canvas.toBlob` (async) where available. If the result is still above 80 KB at the lowest quality, reduce the dimensions step by step (800, 700, 600) before giving up. Keep the server limit as the hard stop.
- Lazy-load `RescuePosterModal`, `FirstAidModal` and `PetMapView` with `React.lazy` and `Suspense` (small gain; keep fallbacks accessible).
- Add an Error Boundary around the map and modals so one failing component does not blank the app.
- Add a service worker (cache the app shell, network-first for `/api/list`, never cache `/api/post`, `/api/contact`) and register it in `src/main.jsx`. `public/manifest.json` already exists; fix the roadmap entry in `worklog.md`.
- Replace `Math.random()` IDs with `crypto.randomUUID()` (with a safe fallback) in `api.js`, `comments.js` and `offlineQueue.js`.

### 3.5 Tooling and tests

- Add ESLint (react, react-hooks rules) and Prettier with minimal config. Fix the warnings that matter (missing `useEffect` dependencies in `AdoptView.jsx`).
- Add Vitest with unit tests for: `matchGovernorateId`, `findNearestGovernorateId`, `calculateDistanceKm`, `formatDistance`, `formatTimeAgo`, the offline queue (enqueue, quota failure, single-flight flush, no lost items, retryable vs permanent errors), and the formula sanitizer (port the logic to a small shared JS module or duplicate it with a matching test fixture).
- Add a GitHub Actions workflow: install, lint, test, `npm run build`.
- Add `npm run lint` and `npm run test` scripts.

---

## Docs to update at the end

- `README.md`: new environment variables (`GAS_URL`, `EDGE_SHARED_SECRET`), Script Properties to set (`FOLDER_ID`, `EDGE_SHARED_SECRET`, `PIN_SALT`), sheet migration steps (new columns, new `Reports` and `Logs` sheets), the new triggers, how to run `setup()` again, and a short security notes section.
- `.env.example`: add the new variables with comments.
- `worklog.md`: add a Phase 4 entry describing this work; correct the statements that no longer apply or were wrong (`stale-while-revalidate`, "contact never exposed", PWA roadmap item, comments sync).

## Definition of done

1. `/api/list` responses contain no phone numbers, and phone numbers are fetched only on explicit WhatsApp click through a rate-limited endpoint.
2. Free-text input beginning with `=`, `+`, `-` or `@` is stored and displayed as plain text.
3. Strangers cannot close cases; owners can, with their PIN.
4. Direct calls to the Apps Script URL without the shared secret are rejected; rate limits cannot be bypassed by changing `clientId`.
5. Errors from Apps Script are never cached at the edge; a user sees their own new report immediately.
6. The offline queue never loses or duplicates reports, and reports clear permanent errors visibly.
7. Comments from other users are visible after opening a card's comment tray.
8. The map no longer jumps when bookmarking, and the selected pin highlight updates.
9. `npm run lint`, `npm run test` and `npm run build` all pass with no warnings.
10. The final message to the owner contains: what changed per phase, every **VERIFY** item with the result, the manual steps the owner must do (Script Properties, sheet columns, EdgeOne environment variables, redeploying the Apps Script web app as a new version), and anything you skipped and why.

## Out of scope for this task

Migrating to Cloudflare R2/D1 or Supabase, new features, visual redesign.
