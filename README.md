# Street Pets

A mobile-first, bilingual (Arabic RTL + English LTR) web application for reporting, rescuing, and adopting street animals across all 27 governorates of Egypt.

Built with **React + Vite**, plain **Glassmorphism CSS**, **Tencent EdgeOne Pages Edge Functions** (`/api/list` & `/api/post`), and a quota-optimized **Google Sheets + Google Drive Apps Script (`Code.gs`)** backend.

---

## Project Structure

```text
.
├── .env.example
├── .gitignore
├── Code.gs
├── README.md
├── index.html
├── package.json
├── vite.config.js
├── edge-functions/
│   └── api/
│       ├── list.js
│       └── post.js
└── src/
    ├── AdoptView.jsx
    ├── App.jsx
    ├── PetCard.jsx
    ├── ShareView.jsx
    ├── api.js
    ├── governorates.js
    ├── i18n.js
    ├── imageCompress.js
    ├── main.jsx
    └── styles.css
```

---

## Setup & Deployment Steps

### 1. Create the Google Sheet & Apps Script
1. Create a new Google Sheet in your Google account.
2. Open **Extensions > Apps Script**.
3. Replace the default code in `Code.gs` with the contents of [`Code.gs`](./Code.gs) from this repository.

### 2. Configure the Google Drive Photo Folder
1. Create a new folder in Google Drive to store pet photos.
2. Right-click the folder > **Share** > set General Access to **"Anyone with the link" -> "Viewer"** (so uploaded photos automatically inherit view access without consuming per-file `setSharing` quota).
3. Copy the Folder ID from its URL (`https://drive.google.com/drive/folders/<FOLDER_ID>`) and paste it into `FOLDER_ID` at the top of `Code.gs`.

### 3. Run `setup()` Once
1. In the Apps Script editor toolbar, select the `setup` function from the dropdown and click **Run**.
2. Grant the requested permissions when prompted.
3. This automatically:
   - Creates the `Pets` and `Archive` sheets with their 12 column headers (`id | created_at | governorate | city | lat | lng | animal_type | condition | description | photo_id | contact | status`).
   - Installs the monthly time-driven trigger (`archiveOld`) on day 1 of each month at 03:00 without creating duplicate triggers.

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
   - **Node.js version**: `18+`
   - EdgeOne Pages automatically detects and deploys the edge functions inside `./edge-functions/api/list.js` (`GET /api/list`) and `./edge-functions/api/post.js` (`POST /api/post`).
3. In the EdgeOne Pages project settings, add the server-side environment variable:
   - **`GAS_URL`** = `https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec`
   *(Never prefix `GAS_URL` with `VITE_` in production so the Apps Script URL stays private on the edge).*
4. Trigger a deployment.

### 6. Updating `Code.gs` Later
Whenever you make changes to `Code.gs` in the Apps Script editor, click **Deploy > Manage deployments > Edit (pencil icon) > Version: New version > Deploy** so your live `/exec` endpoint runs the updated code.

---

## Local Development

1. Copy `.env.example` to `.env.local` and set `VITE_GAS_URL` to your `/exec` URL if testing directly with Vite (`npm run dev`).
2. Install dependencies and start the dev server:
   ```bash
   npm install
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```

---

## Known Limits & Future Upgrades

### Known Limits
1. **Apps Script Daily Quotas**: Consumer Google accounts have daily quotas on Apps Script URL Fetch / Drive / Trigger runtime and concurrent executions (~30 simultaneous executions).
2. **Google Drive Storage**: Photos are compressed client-side to `<80 KB` WebP/JPEG, but they still count against the owner's 15 GB Google Drive storage until old files are manually cleaned up.
3. **Up to 5 Minutes of Stale Data**: Because `GET /api/list` uses a 300-second `s-maxage` EdgeOne cache and a 300-second Apps Script `CacheService` TTL, newly added or adopted pets may take up to 5 minutes to appear/disappear for other users in the same governorate.
4. **Last 300 Reports Window**: To keep sheet reads fast and quota-friendly, `Code.gs` reads only the most recent 300 rows from the `Pets` sheet (and caps each governorate response at 100 items).
5. **Unauthenticated `markAdopted`**: Any visitor can mark a pet as rescued/adopted; while protected by a two-tap confirmation in the UI, there is no reporter PIN or ownership check.

### Suggestions for Future Upgrades
- **Cloudflare R2 / Tencent COS Image Storage**: Move image uploads from Google Drive to an object storage bucket with pre-signed URLs and a lifecycle policy to auto-delete photos of archived pets after 60 days.
- **Serverless SQLite / D1 / Supabase Database**: Replace Google Sheets with a lightweight edge database for indexed geospatial queries ("pets within 5 km of me") and instant cache invalidation.
- **Reporter Secret Code / WhatsApp Bot Verification**: Issue a short 4-digit PIN when submitting a report (or verify via WhatsApp webhook) before allowing a report to be marked as adopted.
- **PWA Offline Queue**: Add a Service Worker (`manifest.json` + IndexedDB queue) so users in low-signal streets can snap a photo and queue the report to auto-send when back online.
