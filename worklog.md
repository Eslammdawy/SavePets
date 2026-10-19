# Street Pets Egypt (SavePets) — Project Worklog

**Project:** Street Pets Egypt (`SavePets`)  
**Repository:** [https://github.com/Eslammdawy/SavePets.git](https://github.com/Eslammdawy/SavePets.git)  
**Lead Developer:** Islam Dawy (Eslam Eldawy)  
**Tech Stack:** React 18, Vite 5, Vanilla Glassmorphism CSS, Google Apps Script (`Code.gs`), Google Drive & Sheets API, Tencent EdgeOne Pages (Edge Functions), Leaflet.js  

---

## 📌 Executive Summary

**Street Pets Egypt** is a lightweight, mobile-first, bilingual (Arabic RTL & English LTR) web application designed to empower citizens, rescuers, veterinarians, and animal shelters across all 27 governorates of Egypt to report, rescue, track, and adopt street animals in need.

The application is engineered with extreme performance and quota discipline:
- Zero heavy frontend UI frameworks (pure vanilla CSS glassmorphism).
- Client-side Canvas photo compression targetting `< 80 KB` to preserve bandwidth and storage.
- Multi-tier caching (in-memory Map, `sessionStorage`, Edge CDN cache, and Google Apps Script chunked cache).
- Secure edge proxy masking backend credentials.
- Zero-cost, serverless backend operating entirely within Google Workspace free-tier quotas and Tencent EdgeOne Pages.

---

## 🛠️ Architecture & Data Flow

```text
[ Citizen / Rescuer (Mobile Browser) ]
               │
               ├── Client-side Canvas Image Compression (<80KB WebP/JPEG)
               ├── GPS Geolocation & Haversine Distance Calculation
               ├── Offline Queueing & LocalStorage Bookmarks / Comments
               │
               ▼
[ Tencent EdgeOne Pages (Edge Layer) ]
        ├── /api/list  --> Edge Cache (s-maxage: 300s) + Secret GAS_URL Proxy
        └── /api/post  --> Direct Proxy (No CORS preflight, plain text JSON)
               │
               ▼
[ Google Apps Script Web App (Code.gs) ]
        ├── CacheService: 30K-char chunked cache (300s TTL)
        ├── LockService: Concurrency control for write safety
        ├── DriveApp: Single shared folder photo ingestion (photo_id)
        └── SpreadsheetApp:
                 ├── 'Pets' Sheet (Last 300 rows scanned, TextFinder status updates)
                 ├── 'Comments' Sheet (Community follow-ups & updates)
                 └── 'Archive' Sheet (Monthly auto-archival trigger > 60 days)
```

---

## 📅 Chronological Development Worklog

### Phase 1: Core Foundation & MVP Architecture (October 18, 2026)

#### 1. Project Initialization & Setup
- Initialized React 18 + Vite 5 single-page application structure.
- Configured `.gitignore`, `package.json`, and `.env.example` defining `GAS_URL` and `VITE_GAS_URL`.
- Enforced mobile-first responsive viewport settings in `index.html` with iOS zoom prevention (minimum 16px input font size, 44px+ tap targets).
- Integrated Google Font **Cairo** for Arabic typography with `display=swap`.

#### 2. Bilingual i18n & Egyptian Governorates Engine
- Created `src/i18n.js` with comprehensive Arabic/English dictionaries, dynamic RTL/LTR root class synchronization, relative timestamp formatting (`formatTimeAgo`), and localized summary builders.
- Created `src/governorates.js` containing all 27 Egyptian governorates with GPS center coordinates, ISO 3166-2 codes, English and Arabic names, and fuzzy alias matching (`matchGovernorateId`).
- Implemented Haversine formula calculation for calculating exact kilometer distances between user coordinates and reported animals.

#### 3. Client-Side Image Compression
- Created `src/imageCompress.js` using HTML5 Canvas to scale camera captures/files down to a maximum of 800px on the longest dimension at ~0.6 quality (WebP with JPEG fallback).
- Achieved target file sizes under 80 KB, returning clean Base64 data strings without requiring external image processing libraries.

#### 4. Google Apps Script Backend (`Code.gs`)
- Engineered Google Sheets schema with 12 structured fields:
  `id | created_at | governorate | city | lat | lng | animal_type | condition | description | photo_id | contact | status`
- Built single-folder Google Drive upload handler: Decodes base64 payload into a file blob, stores it in a pre-shared public folder (`FOLDER_ID`), and saves only `photo_id` to Google Sheets.
- Built thumbnail URL constructor (`https://drive.google.com/thumbnail?id=<id>&sz=w400`) to completely eliminate heavy base64 transmission to clients.
- Enforced strict quota-saving backend optimizations:
  - Bounded data reads: fetches only the last 300 rows using `getLastRow()` and one `getRange()`.
  - Fast status updates using `createTextFinder(id).matchEntireCell(true).findNext().offset(0, 11).setValue('adopted')`.
  - Multi-key chunked script caching (`all_meta`, `all_0`...`all_5`) in `CacheService` to handle multi-byte Arabic character limits.
  - Automatic monthly cleanup trigger (`archiveOld`) moving records older than 60 days to the `Archive` sheet.
  - IP/Client rate limiting (maximum 5 submissions per hour per client).

#### 5. Edge Functions Proxy
- Built Tencent EdgeOne Pages serverless functions:
  - `edge-functions/api/list.js`: Handles `GET` requests, forwards to private `GAS_URL`, strips origin headers, and enforces `s-maxage=300, stale-while-revalidate=60`.
  - `edge-functions/api/post.js`: Proxies `POST` write requests with robust error reporting and status propagation.

#### 6. Dual-View Interface & Glassmorphism Design
- Built `src/ShareView.jsx`: Report submission with live camera capture, automatic geolocation detection, governorate picker, condition badges, 300-character description counter, and hidden honeypot bot trap.
- Built `src/AdoptView.jsx`: Filterable feed by governorate, city/area text search, animal type (dog/cat), client-side pagination (12 cards/page), and condition tags.
- Built `src/PetCard.jsx`: Glass card with lazy-loaded thumbnails, dynamic condition pill tags, expandable descriptions, WhatsApp direct messaging link, and one-tap Google Maps directions.
- Privacy guardrail: Ensured reporter contact numbers are never displayed in raw text or tooltips; only accessible via pre-filled WhatsApp action buttons.
- Designed `src/styles.css`: Pure CSS glassmorphism (`backdrop-filter: blur(14px)`), CSS variables, fluid safe-area insets, and accessibility contrast compliance.

---

### Phase 2: Offline Resilience & Emergency Rescue Extensions (October 18, 2026)

#### 1. Offline Storage & Background Sync Queue
- Created `src/offlineQueue.js`:
  - Automatically captures reports to `localStorage` when network connectivity fails or device is offline.
  - Listens for `online` window events and provides manual sync controls.
  - Sequentially flushes queued reports to the backend upon reconnection with visual progress toast indicators.

#### 2. Bookmarks & Local Case Favorites
- Created `src/bookmarks.js`:
  - Allows users to star/bookmark cases for follow-up without creating user accounts.
  - Persists saved cases across sessions in `localStorage`.
  - Adds a dedicated "Saved Pets" filter tab inside `AdoptView.jsx`.

#### 3. Interactive Leaflet Map View
- Created `src/PetMapView.jsx`:
  - Dynamically loads Leaflet CSS & JS from CDN only when the user toggles map view (saving initial bundle size).
  - Centers map dynamically on selected governorate or user's GPS position.
  - Renders color-coded map markers reflecting urgency (red = injured/sick, pink = pregnant/nursing, green = healthy).
  - Displays interactive popup previews with direct navigation buttons.

#### 4. Canvas-Powered Rescue Poster Generator
- Created `src/RescuePosterModal.jsx`:
  - Client-side Canvas generator that composites the pet photo, urgent condition banner, location details, summary text, and branding into an exportable high-resolution poster.
  - Direct integration with the native Web Share API (`navigator.share`) for instant WhatsApp and social media sharing.
  - One-click image download for offline printing and posting in local neighborhoods.

#### 5. Emergency First-Aid & Shelter Directory Modal
- Created `src/FirstAidModal.jsx`:
  - Emergency field triage guides for road accidents/bleeding, suspected poisoning, heatstroke/dehydration, and orphaned neonates.
  - Critical safety warnings (e.g. human painkiller toxicity warnings in cats and dogs).
  - Verified directory of Egyptian animal welfare shelters, emergency numbers, and vet contact hotlines.

---

### Phase 3: Community Updates, Backend Sync & Stabilization (October 19, 2026)

#### 1. Pet Case Follow-Up Comments
- Extended backend `Code.gs` with a dedicated `Comments` sheet and `addComment`/`getComments` API actions.
- Created `src/comments.js`:
  - Real-time comment submission and multi-card synchronization via custom browser events (`sp-comments-changed`).
  - Optimistic local updates with background backend persistence.
  - Expandable comment tray on individual pet cards allowing rescuers to post condition updates ("Vet visited", "Fostered temporarily").

#### 2. Git Synchronization & Merge Conflict Resolution
- Connected local repository with remote `https://github.com/Eslammdawy/SavePets.git`.
- Resolved merge conflict in `Code.gs` unifying sheet headers, comment structures, and folder IDs.
- Verified production build compatibility: `npm run build` generates optimized assets under `dist/` with zero warnings.

---

## 📁 Repository File Map

| Path | Purpose |
| :--- | :--- |
| `index.html` | Application shell, viewport configurations, Cairo font preloads |
| `vite.config.js` | Vite build and dev server configuration |
| `package.json` | Dependencies (`react`, `react-dom`) and dev tools (`vite`, `@vitejs/plugin-react`) |
| `Code.gs` | Google Apps Script backend (Drive photo storage, Sheets database, CacheService, LockService) |
| `.env.example` | Environment variable template for EdgeOne Pages (`GAS_URL`) and local Vite dev (`VITE_GAS_URL`) |
| `.env.local` | Local development environment configuration |
| `edge-functions/api/list.js` | Tencent EdgeOne edge function proxying and caching pet lists |
| `edge-functions/api/post.js` | Tencent EdgeOne edge function proxying post/comment submissions |
| `src/main.jsx` | React root mounting point |
| `src/App.jsx` | Root state, navigation tabs, offline queue monitor, language switcher |
| `src/ShareView.jsx` | Form view for reporting found animals with photo compression and geolocation |
| `src/AdoptView.jsx` | Search and feed view with governorate filtering, bookmarks, and map toggle |
| `src/PetCard.jsx` | Individual pet card with image lazy loading, comments, map links, and WhatsApp triggers |
| `src/PetMapView.jsx` | Interactive Leaflet map visualizing pet coordinates across Egypt |
| `src/RescuePosterModal.jsx` | HTML5 Canvas poster creator and Web Share API dispatcher |
| `src/FirstAidModal.jsx` | Emergency veterinary triage guide and shelter hotline directory |
| `src/api.js` | Networking layer with 2-level client caching (Memory + SessionStorage) |
| `src/governorates.js` | 27 Egyptian governorates database, GPS coordinates, and Haversine distance calculator |
| `src/i18n.js` | Bilingual translation strings (Arabic/English), relative date and summary generators |
| `src/imageCompress.js` | Client-side Canvas image resizer and WebP/JPEG compressor |
| `src/bookmarks.js` | Local storage manager for user-bookmarked pet cases |
| `src/comments.js` | Local and remote comment synchronization manager |
| `src/offlineQueue.js` | Network connectivity detector and offline submission queue |
| `src/styles.css` | Glassmorphic visual styles, layout variables, animations, and RTL support |
| `README.md` | Deployment guides, Apps Script setup instructions, and architecture notes |
| `worklog.md` | Detailed chronological history, technical decisions, and roadmap |

---

## 🔒 Security, Privacy & Performance Safeguards

1. **Reporter Privacy**:
   - Phone numbers are never exposed in HTML attributes, visible labels, or tooltips.
   - Only encoded into direct `https://wa.me/` URLs activated by explicit user action.

2. **Spam & Abuse Prevention**:
   - Invisible honeypot field (`website_hp`) in `ShareView.jsx` silently drops automated submissions.
   - Client-side rate limiting and server-side tracking (maximum 5 additions/hour per client ID).

3. **Quota Preservation**:
   - Google Sheets reads are capped at the last 300 rows.
   - Drive photos inherit folder permissions; zero `setSharing` API calls per upload.
   - 300-second edge cache on Tencent EdgeOne Pages absorbs repetitive read traffic.
   - Two-level client cache (`Map` + `sessionStorage`) prevents refetching during session navigation.

---

## 🚀 Future Roadmap & Enhancements

- [ ] **Object Storage Migration**: Transition image storage from Google Drive to Cloudflare R2 or Tencent Cloud COS with automated 60-day lifecycle expiration.
- [ ] **Geospatial Edge Database**: Upgrade Google Sheets to Cloudflare D1 or Supabase for indexed spatial radius queries (e.g. "Find pets within 5 km of my current location").
- [ ] **PWA & Service Worker**: Add `manifest.json` and a Service Worker for offline app shell caching and background sync capabilities.
- [ ] **Reporter Verification PIN**: Issue an automated 4-digit PIN upon submission to prevent unauthorized closing of open rescue cases.
