# Task: Build "Street Paws", a pet rescue and adoption app

Build a simple, mobile-first web app that helps save street animals. The frontend is React (Vite). The database is a Google Sheet, accessed through a Google Apps Script web app (Code.gs). The frontend and a small edge proxy are deployed on Tencent EdgeOne Pages. Deliver the complete code, with the file tree first, then each file in full.

## Constraints
- Keep the code SIMPLE: few files, no heavy libraries. Allowed: react, react-dom, vite. No router needed (simple tab state). No UI frameworks; use plain CSS.
- Mobile-first (most users are on phones), with a bilingual UI (Arabic + English) and RTL support. Use a language toggle and a small `i18n.js` dictionary.
- Save Google Apps Script quota at every step (rules below).

## Visual style (CSS)
Use a glassmorphism look with vivid, eye-catching colors. Plain CSS only (no UI libraries), all in `styles.css`, driven by CSS variables on `:root`.

**Background**
- A static full-screen gradient: deep indigo to violet to hot pink (e.g. `#1e1b4b` -> `#6d28d9` -> `#ec4899`), fixed with `background-attachment: fixed`.
- Add 3 large blurred color blobs (coral `#ff6b6b`, cyan `#22d3ee`, lime `#a3e635`) using CSS-only pseudo-elements with `filter: blur(80px)` and low opacity. No background images, to save bandwidth.

**Glass surfaces** (cards, form panels, top bar, bottom navigation, modals)
- `background: rgba(255,255,255,0.14)`, `backdrop-filter: blur(14px) saturate(160%)` (include the `-webkit-` prefix).
- `border: 1px solid rgba(255,255,255,0.28)`, `border-radius: 20px`, a soft shadow `0 8px 32px rgba(0,0,0,0.25)`, and a subtle top inner highlight.
- Provide a fallback inside `@supports not (backdrop-filter: blur(1px))` using a more opaque solid background (`rgba(30,27,75,0.85)`).
- Keep blur at 14px or less, and do not nest glass inside glass, so scrolling stays smooth on low-end phones.

**Colors and accents**
- Primary action buttons: gradient coral to orange (`#ff6b6b` -> `#ffa94d`), white bold text, a glow shadow, and a slight lift on hover/press.
- Secondary buttons (Maps, WhatsApp): glass style; the WhatsApp button uses a green tint (`#25d366`).
- Condition badges as colored pills: injured = red, sick = amber, pregnant/with young = pink, healthy = green, not sure = grey.
- Focus rings: 2px cyan (`#22d3ee`) on all inputs and buttons.

**Text and readability**
- White text on glass, with a secondary text color of `rgba(255,255,255,0.78)`.
- Make sure body text keeps WCAG AA contrast against the glass over the brightest part of the gradient; add a darker tint to the card background if needed.
- Inputs: glass fields with white placeholder text at 60% opacity, 16px minimum font size (prevents iOS zoom), and tap targets of 44px or more.

**Layout and behavior**
- Mobile-first, a single column, max content width 520px centered on larger screens, and a glass bottom navigation bar fixed with `env(safe-area-inset-bottom)` padding.
- Use logical CSS properties (`margin-inline`, `padding-inline`, `inset-inline`) so RTL Arabic works with no extra overrides.
- Pet cards: a photo on top with rounded corners and `aspect-ratio: 4/3` and `object-fit: cover`, a blurred placeholder color while the image loads, then the glass info area below.
- Light motion only: 150-250ms transitions on hover/press and a fade-in for cards. Wrap animations in `@media (prefers-reduced-motion: no-preference)`.
- No heavy fonts: use the system font stack, plus `Cairo` from Google Fonts only for Arabic text, loaded with `display=swap`.

## Views
Two tabs/views in a bottom navigation bar. Both views stay mounted (hide the inactive one with CSS) or their state lives in App.jsx, so switching tabs never loses or refetches data.

### View 1: "Share a pet to save"
A form for people who find an animal on the street:
1. Photo: `<input type="file" accept="image/*" capture="environment">`. Compress on the CLIENT before upload using canvas: max 800px on the longest side, WebP (JPEG fallback), quality ~0.6, target under 80 KB. Show a preview and the final size. Send it as base64.
2. Location capture: a "Use my location" button using `navigator.geolocation` (high accuracy, 10 s timeout) that saves `lat` and `lng`. Show a clear error if permission is denied, and let the user continue by choosing the governorate and city manually.
3. Governorate: a dropdown with all 27 Egyptian governorates, stored as a static list in the frontend (Arabic + English names). City/Area: a free-text input with a placeholder.
4. Animal type (dog / cat / other), a condition dropdown (healthy / injured / sick / pregnant or with puppies or kittens / not sure), and a description textarea (max 300 chars, with a counter).
5. Optional contact: WhatsApp number of the reporter (digits only, with country code, e.g. 20xxxxxxxxxx). Show this privacy note under the field: "Your number is never displayed. Adopters will only see a WhatsApp button that opens a chat with you."
6. Submit button: disable it while sending, show success/error, and reset the form.
Validation: photo, governorate and city are required. Include a hidden honeypot field for bots.

### View 2: "Save and adopt a pet"
1. Filters: governorate dropdown (required), area/city text (optional, partial match, case-insensitive), and an optional animal type filter.
2. Search button. Pressing it fetches the governorate's list ONLY if it is not already in memory/sessionStorage and fresh (see Frontend networking). The city and animal type filters are applied in the browser on the already-loaded list, so changing city or type and pressing Search again costs zero backend calls.
3. Results as cards, newest first. Each card shows:
   - the photo (lazy-loaded thumbnail)
   - governorate and city
   - animal type and condition badge
   - an auto-generated summary line, for example: "Injured dog spotted in Maadi, Cairo, 2 days ago. Needs help. Contact via WhatsApp."
   - the user's description (truncated, with "read more")
   - an "Open in Google Maps" button (`https://www.google.com/maps?q=lat,lng`)
   - an "Open WhatsApp" button (only if a contact exists) linking to `https://wa.me/<number>?text=<prefilled message mentioning the pet's city and animal type>`
   - a "Mark as adopted/rescued" button: remove the card from local state and from the cached list immediately (memory + sessionStorage), then send the `markAdopted` POST in the background.
   PRIVACY RULE: never render the raw phone number anywhere in the UI (not in text, not in tooltips, not as link text). Use only the wa.me link on the button.
4. Empty state: "No pets reported in this area yet."
5. Show a "Load more" button (paginate client-side, 12 cards per page) so the DOM stays light.

## Google Sheet schema
Sheet `Pets`, row 1 = headers:
`id | created_at | governorate | city | lat | lng | animal_type | condition | description | photo_id | contact | status`
- `id`: `Utilities.getUuid()`.
- `created_at`: epoch milliseconds (number), so comparisons and sorting are cheap.
- `status`: `available` | `adopted`.
Sheet `Archive`: same headers, created automatically.
`setup()` runs once: creates both sheets and headers if missing, and installs the monthly archive trigger (see rule 11) without creating duplicate triggers.

## Backend: Code.gs (Apps Script web app)
Deploy as a web app: Execute as "Me", Access "Anyone". Provide:
- `doGet(e)`: action `list`, param `gov` only (city and type are filtered in the browser). Returns compact JSON.
- `doPost(e)`: parse `JSON.parse(e.postData.contents)`. Actions: `add` and `markAdopted`.
- Photos: decode the base64 with `Utilities.base64Decode`, create the file in ONE Drive folder (constant `FOLDER_ID`) with `DriveApp.getFolderById(FOLDER_ID).createFile(blob)`, and store only `photo_id` in the sheet. The Drive folder is pre-shared once manually as "Anyone with the link can view", so files inherit access. Do NOT call `setSharing` per file. The frontend builds the image URL as `https://drive.google.com/thumbnail?id=PHOTO_ID&sz=w400`. Never return base64 images from the backend.
- Contact: sanitize to digits only on the server (strip spaces, +, dashes), validate length 8 to 15 digits, store in the `contact` column. The list response includes it only so the frontend can build the wa.me link; the frontend must never display it.

### Compact list response
Return `{ok:true, h:[...], r:[[...], ...]}`:
- `h` is the header sent once: `["id","t","gov","city","lat","lng","type","cond","desc","photo","contact"]`.
- `r` is an array of row arrays in that order, newest first, available pets only, max 100 rows for the requested governorate. No `status` field (all rows are available).
- Shrink each row: `t` in epoch seconds, lat/lng rounded to 5 decimals, description trimmed to 300 chars.
- The frontend rebuilds objects from `h` and `r`.

### Quota-saving rules (follow strictly)
1. Read only recent rows: do not use `getDataRange()`. Use `getLastRow()` and ONE `getRange(startRow, 1, n, cols).getValues()` covering at most the last 300 data rows. Never call `getRange` or `getValue` inside loops. Filter in memory.
2. Single shared cache, in chunks: cache the whole compact list of available pets (all governorates, from the last 300 rows) under chunked keys in `CacheService.getScriptCache()` for 300 seconds. Split the JSON string into chunks of 30,000 characters (Arabic text is multi-byte, and each cache value is limited to 100 KB), store them with ONE `putAll` as `all_0 ... all_n`, plus `all_meta` holding the chunk count. Read them with ONE `getAll`. On a cache hit, join, parse, and filter by governorate in memory. On a miss, rebuild once from the Sheet (this single rebuild serves every governorate).
3. Invalidate on writes: after `add`, `markAdopted`, or archiving, remove `all_meta` and all chunk keys in ONE `removeAll`.
4. Writes: use a single `sheet.appendRow([...])` per submission. For `markAdopted`, find the row with ONE `createTextFinder(id).matchEntireCell(true).findNext()` on the id column (the row may be older than the last 300), then ONE `setValue('adopted')` on its status cell.
5. Drive: exactly one `createFile` call per submission and no other Drive calls except `getFolderById`.
6. Use `LockService.getScriptLock().waitLock(10000)` ONLY around write operations (and the archive job), and release it in `finally`.
7. Rate limiting: allow at most 5 `add` requests per client per hour, using a client ID sent by the frontend (a random ID in localStorage) and a counter in CacheService. Reject honeypot-filled submissions silently.
8. Validate on the server: required fields, max lengths, lat/lng range, an image size limit (reject over ~300 KB), allowed MIME types.
9. Return `ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)`.
10. Wrap everything in try/catch and return `{ok:false, error}`.
11. Monthly archive: a function `archiveOld()` run by a time-driven trigger once a month (`ScriptApp.newTrigger('archiveOld').timeBased().onMonthDay(1).atHour(3).create()`, created by `setup()` only if not already present). Under the script lock, read the Pets sheet once, split rows into keep and move (move = status `adopted` OR older than 60 days), append the moved rows to `Archive` with ONE `setValues`, rewrite Pets with `clearContent()` on the data area plus ONE `setValues` of the kept rows, then invalidate the cache (rule 3). Leave Drive photos untouched.

## Edge proxy (EdgeOne Pages function)
Add one small EdgeOne Pages edge function that sits between the browser and Apps Script. Check the current EdgeOne Pages documentation for the correct folder name, routing and handler syntax; do not guess.
- Routes: `GET /api/list?gov=...` and `POST /api/post`.
- The Apps Script URL is stored as a server-side environment variable `GAS_URL` (never exposed to the browser, never prefixed with VITE_).
- GET `/api/list`: forward to `GAS_URL?action=list&gov=...` (follow redirects; Apps Script answers through a redirect) and respond with `Cache-Control: public, max-age=0, s-maxage=300`, so EdgeOne serves repeated searches for the same governorate from its cache without touching Apps Script. Accept that data can be up to 5 minutes stale. Only forward valid `gov` values from the 27-governorate list; reject anything else with 400.
- POST `/api/post`: forward the body unchanged with `Content-Type: text/plain;charset=utf-8`, never cache it, and return the response.
- Benefit: this also removes CORS problems and helps in regions where script.google.com is hard to reach.

## Frontend networking
- Single `api.js` file. In production it calls `/api/list` and `/api/post`. For local development only, it falls back to `VITE_GAS_URL` directly.
- POST bodies use `Content-Type: text/plain;charset=utf-8` and `JSON.stringify(data)` (this avoids a CORS preflight, which Apps Script does not support).
- Two-level client cache for governorate lists, keyed by governorate only: (1) an in-memory `Map` with timestamps, (2) `sessionStorage` as backup. Entries are fresh for 5 minutes. Check memory first, then sessionStorage, then the network.
- Switching tabs or returning to a previous search never refetches (keep results, filters and page number in React state in App.jsx, or keep both views mounted).
- Pressing Search with a fresh cached list does zero network calls; city and type are filtered locally.
- After a successful `add` or `markAdopted`, drop the cached list for the affected governorate on the client.
- Search only when the user presses the Search button (no auto-search on input).

## Deployment on Tencent EdgeOne Pages
- Build command: `npm run build`. Output directory: `dist`. Node 18+.
- Environment variable: `GAS_URL` (the Apps Script web app URL ending in `/exec`), used by the edge function.
- Add a README with these steps:
  1. Create the Google Sheet, then Extensions > Apps Script, and paste Code.gs.
  2. Create the Drive folder, set its sharing to "Anyone with the link can view", then put its ID in `FOLDER_ID`.
  3. Run `setup()` once and authorize (this also creates the monthly archive trigger).
  4. Deploy > New deployment > Web app (Me / Anyone), then copy the `/exec` URL.
  5. Push the repo to GitHub, import it into EdgeOne Pages, set `GAS_URL`, and deploy.
  6. After any change to Code.gs, create a NEW deployment version.

## Deliverables
1. File tree.
2. `Code.gs` (complete, commented).
3. Edge proxy function file(s).
4. Frontend files: `index.html`, `main.jsx`, `App.jsx`, `ShareView.jsx`, `AdoptView.jsx`, `PetCard.jsx`, `api.js`, `imageCompress.js`, `governorates.js`, `i18n.js`, `styles.css` (following the Visual style section), `.env.example`.
5. README with setup and deployment steps.
6. A short list of known limits (Apps Script daily quotas, Drive storage, up to 5 minutes of stale data from edge caching, only the last 300 reports are searchable) and suggestions for future upgrades.

Write clean, readable code with short comments. Do not add features beyond this spec.
