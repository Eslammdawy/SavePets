# Street Pets

A mobile-first, bilingual (Arabic RTL + English LTR) web application for reporting, rescuing, and adopting street animals across all 27 governorates of Egypt.

Built with **React + Vite**, plain **Glassmorphism CSS**, **Tencent EdgeOne Pages Edge Functions** (`/api/list`, `/api/post`, `/api/contact`, `/api/comments`, `/api/img`), and a quota-optimized, hardened **Google Sheets + Google Drive Apps Script (`Code.gs`)** backend.

---

## Project Structure

```text
.
├── .env.example
├── .eslintrc.cjs
├── .gitignore
├── .prettierrc
├── Code.gs
├── README.md
├── index.html
├── package.json
├── vite.config.js
├── worklog.md
├── .github/
│   └── workflows/
│       └── ci.yml
├── edge-functions/
│   └── api/
│       ├── comments.js
│       ├── contact.js
│       ├── img.js
│       ├── list.js
│       └── post.js
├── public/
│   ├── fonts/
│   │   ├── cairo-arabic-wght-normal.woff2
│   │   └── cairo-latin-wght-normal.woff2
│   ├── icon.svg
│   ├── manifest.json
│   └── sw.js
└── src/
    ├── __tests__/
    │   └── app.test.js
    ├── AdoptView.jsx
    ├── App.jsx
    ├── ErrorBoundary.jsx
    ├── FirstAidInlineCard.jsx
    ├── FirstAidModal.jsx
    ├── PetCard.jsx
    ├── PetMapView.jsx
    ├── RescuePosterModal.jsx
    ├── ShareView.jsx
    ├── api.js
    ├── bookmarks.js
    ├── comments.js
    ├── governorates.js
    ├── i18n.js
    ├── imageCompress.js
    ├── main.jsx
    ├── offlineQueue.js
    ├── sanitize.js
    └── styles.css
```

---

## Setup & Deployment Steps

### 1. Create the Google Sheet & Apps Script
1. Create a new Google Sheet in your Google account.
2. Open **Extensions > Apps Script**.
3. Replace the default code in `Code.gs` with the contents of [`Code.gs`](./Code.gs) from this repository.

### 2. Configure the Google Drive Photo Folder & Script Properties
1. Create a new folder in Google Drive to store pet photos.
2. Right-click the folder > **Share** > set General Access to **"Anyone with the link" -> "Viewer"** (so uploaded photos automatically inherit view access without consuming per-file `setSharing` quota).
3. Copy the Folder ID from its URL (`https://drive.google.com/drive/folders/<FOLDER_ID>`).
4. In the Apps Script editor, open **Project Settings (gear icon) > Script Properties** and add:
   - **`FOLDER_ID`**: Your Google Drive Folder ID.
   - **`EDGE_SHARED_SECRET`**: A random secret string shared with your EdgeOne Pages project (used to authenticate edge proxy requests).
   - **`PIN_SALT`**: *(Optional — `setup()` auto-generates a random `PIN_SALT` if not already set).*

### 3. Run `setup()` Once
1. In the Apps Script editor toolbar, select the `setup` function from the dropdown and click **Run**.
2. Grant the requested permissions when prompted.
3. This automatically:
   - Creates the `Pets` (`13` columns including `pin_hash`), `Archive`, `Comments`, `Reports`, and `Logs` sheets with plain-text formatting (`@`) on user-text columns.
   - Ensures `FOLDER_ID` and `PIN_SALT` exist in `PropertiesService.getScriptProperties()`.
   - Installs a daily cleanup trigger (`archiveOld` at 03:00) and a 5-minute cache warmer trigger (`warmCaches`) without creating duplicate triggers.

### 4. Deploy the Apps Script Web App
1. In the Apps Script editor, click **Deploy > New deployment**.
2. Select type: **Web app**.
3. Set **Execute as**: `Me`.
4. Set **Who has access**: `Anyone`.
5. Click **Deploy** and copy the Web App URL ending in `/exec`.

### 5. Deploy to Tencent EdgeOne Pages
1. Push this repository to GitHub.
2. Import the GitHub repository into **Tencent EdgeOne Pages**:
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
   - **Node.js version**: `20+`
   - EdgeOne Pages automatically detects and deploys the edge functions inside `./edge-functions/api/`:
     - `GET /api/list` (governorate feed with edge Cache API + `stale-while-revalidate`)
     - `POST /api/post` (report submission, PIN-verified adoption, community adoption report, comment posting)
     - `GET /api/contact` (rate-limited, on-demand WhatsApp phone number lookup)
     - `GET /api/comments` (per-pet comments lookup)
     - `GET /api/img` (cached image proxy with `Access-Control-Allow-Origin: *` for Canvas rescue posters)
3. In the EdgeOne Pages project settings, add the server-side environment variables:
   - **`GAS_URL`** = `https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec`
   - **`EDGE_SHARED_SECRET`** = *(same secret configured in Apps Script Properties)*
   - **`RATE_LIMIT_SALT`** = *(a random salt string used to hash client IPs for rate limiting)*
   *(Never prefix these variables with `VITE_` in production so they stay private on the edge).*
4. Trigger a deployment.

### 6. Updating `Code.gs` Later
Whenever you make changes to `Code.gs` in the Apps Script editor, click **Deploy > Manage deployments > Edit (pencil icon) > Version: New version > Deploy** so your live `/exec` endpoint runs the updated code.

---

## Local Development & Testing

1. Copy `.env.example` to `.env.local` and set `VITE_GAS_URL` to your `/exec` URL if testing directly with Vite (`npm run dev`).
2. Install dependencies and start the dev server:
   ```bash
   npm install
   npm run dev
   ```
3. Run linter, unit tests, and production build:
   ```bash
   npm run lint
   npm run test
   npm run build
   ```

---

## Known Limits & Future Upgrades

### Known Limits
1. **Apps Script Daily Quotas**: Consumer Google accounts have daily quotas on Apps Script URL Fetch / Drive / Trigger runtime and concurrent executions (~30 simultaneous executions).
2. **Google Drive Storage**: Photos are compressed client-side to `<80 KB` WebP/JPEG and archived/adopted photos older than 60 days are automatically trashed by `archiveOld()`, but active photos still count against the owner's 15 GB Google Drive storage.
3. **1500-Row Active Window**: `Code.gs` scans up to the most recent 1,500 rows in the `Pets` sheet (automatically archiving older adopted rows when the sheet exceeds 1,500 rows) and caches per-governorate slices (`gov_<id>_*`) warmed every 5 minutes.
4. **Device-Bound Reporter PIN**: When a user submits a pet report, a 4-digit PIN is generated and stored in `localStorage` (`sp_my_pets_v1`) on the reporting device (`pin_hash` stored on the server). Only the reporting device sees the direct `"Mark as adopted"` button; other visitors see `"Report as adopted"`, which logs a community report to the `Reports` sheet for review.

### Suggestions for Future Upgrades
- **Cloudflare R2 / Tencent COS Image Storage**: Move image uploads from Google Drive to an object storage bucket with pre-signed URLs.
- **Serverless SQLite / D1 / Supabase Database**: Replace Google Sheets with a lightweight edge database for indexed geospatial queries ("pets within 5 km of me") and instant cache invalidation.
- **WhatsApp Bot Verification**: Allow reporters who clear browser storage or switch devices to re-verify ownership via an automated WhatsApp message.
