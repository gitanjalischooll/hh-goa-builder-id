# 🏝️ Hacker House Goa 2026 — Builder ID Card Generator (Backend)

**Where code meets the coast. Ship products, not just hacks.**

[![Node](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express.js-4.x-000000?logo=express&logoColor=white)](https://expressjs.com)
[![Sharp](https://img.shields.io/badge/Sharp-image%20processing-99CC00?logo=sharp&logoColor=white)](https://sharp.pixelplumbing.com)
[![PDFKit](https://img.shields.io/badge/PDFKit-PDF%20generation-red)](http://pdfkit.org)
[![License](https://img.shields.io/badge/License-MIT-blue)](#license)

**Repository:** `HackerHouse_GOA`
**Author / Backend Lead:** Akshat
**Event:** Hacker House Goa 2026 · `#FRAMEINGOA` · `#BUILDINPARADISE`

---

## 📖 Summary

This service is the API backend for the **HH Goa 2026 Builder ID Card Generator** — a mobile-first web app that lets every attendee generate their own double-sided, high-resolution "Builder ID" badge in seconds.

The frontend (built by Prajusha) captures a photo, name, tech stack, and builder title, then hands off to this backend for everything that needs real image/PDF processing:

- Fixing sideways/upside-down mobile camera photos and cropping them to a clean square
- Generating a dynamic, on-brand neon QR code that points to `hhgoa.com`
- Compiling the finished Front + Back card into a single print-ready, 2-page PDF
- Producing a shareable link with proper OpenGraph/Twitter meta tags, so hitting **"Share on X"** unfurls a real image card in the timeline instead of a bare link

---

## 🏗️ Architecture & Key Features

| Feature | Details |
|---|---|
| **EXIF-safe photo processing** | `sharp().rotate()` reads the image's EXIF `Orientation` tag and auto-corrects it before cropping — fixes the classic "photo comes out sideways" mobile camera bug. |
| **1:1 square crop** | Photos are cropped to **600×600px** using `cover` fit (centered), so any aspect ratio photo fills the badge photo slot cleanly with no letterboxing. |
| **Dynamic neon QR codes** | Server-generates a QR PNG (via the `qrcode` package) styled with a neon mint foreground on a transparent background, pointing at `https://hhgoa.com` by default — matches the tropical/neon tech template aesthetic. |
| **2-page edge-to-edge PDF** | `pdfkit` compiles Front + Back into a single PDF at **432 × 540pt** per page (a 4:5 ratio, matching the 1080×1350px Canva templates), images rendered with zero margin. |
| **Ephemeral share links** | Card image buffers are cached in an in-memory `Map` keyed by an 8-character `cardId`, with a **2-hour TTL** and a background sweep every **15 minutes** that purges expired entries. |
| **X (Twitter)-optimized unfurl page** | `GET /share/:cardId` renders a server-side HTML page with `og:image`, `twitter:card=summary_large_image`, and a direct tweet-intent link, so shared cards render as a large image preview on X. |
| **Mobile-first upload handling** | `multer` memory storage (no disk writes) with a 10MB cap, accepting either a multipart file or a raw base64 string — covers both native camera-capture and drag/drop upload flows. |

### Request flow at a glance

```
 Frontend (Prajusha's UI)
        │
        ├─ POST /api/process-image      → cropped, upright square photo (base64)
        ├─ POST /api/generate-qr        → neon QR PNG (base64)
        │        (frontend composites photo + QR + text onto canvas templates)
        │
        ├─ POST /api/generate-pdf       → downloadable 2-page PDF
        └─ POST /api/create-share-link  → { cardId, shareUrl }
                     │
                     ▼
          GET /share/:cardId  ──►  X (Twitter) crawler reads OG tags
                     │                        │
                     ▼                        ▼
          GET /api/card-image/:cardId  (og:image / twitter:image source)
```

---

## 📂 Folder & File Structure

```
HackerHouse_GOA/
├── server.js            # Express app — all routes, middleware, error handling
├── package.json          # Dependencies & npm scripts
├── .env                   # Local environment config (NOT committed — see .env.example)
├── .env.example          # Template documenting required env vars
├── .gitignore             # Should exclude node_modules/, .env
└── README.md              # You are here
```

> This backend is intentionally single-file (`server.js`) for simplicity during the hackathon build. If it grows, a natural next split is `routes/`, `services/` (sharp/pdfkit/qrcode logic), and `cache/` (share-link store).

---

## ✅ Prerequisites

| Requirement | Version | Why |
|---|---|---|
| **Node.js** | `>=18.0.0` (LTS recommended) | `sharp` v0.33+ ships prebuilt binaries targeting modern Node ABI versions; Node 18+ avoids the fallback-to-source-build path that fails on many networks. |
| **npm** | `>=9.x` (ships with Node 18) | Standard package management. |
| A registered `.env` file | — | See below. |

Check your version before installing:

```bash
node -v   # should print v18.x.x or higher
npm -v
```

### `.env` Configuration

Create a `.env` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (defaults to `3000`) | Port the Express server listens on. |
| `BASE_URL` | **Recommended in production** | The publicly reachable base URL of this deployed service, e.g. `https://hhgoa-backend.onrender.com` (no trailing slash). Used to build absolute `shareUrl` and `og:image` links. If omitted, it's derived per-request from the incoming `Host` header — fine for local dev, but **set this explicitly once deployed** so share links don't leak internal hostnames. |

```env
# .env
PORT=3000
BASE_URL=https://hhgoa-backend.onrender.com
```

---

## 🚀 Quickstart & Installation

```bash
# 1. Clone the repository
git clone https://github.com/<your-org>/HackerHouse_GOA.git
cd HackerHouse_GOA

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# → edit .env and fill in PORT / BASE_URL as needed

# 4. Start the server
npm start

# (Optional) run with auto-reload during development
npm run dev
```

On success, you should see:

```
🏝️  HH Goa 2026 Builder ID backend running on port 3000
    Base URL: (derived per-request from Host header)
```

Verify it's alive:

```bash
curl http://localhost:3000/api/health
# → {"status":"healthy","uptime":1.23,"cachedCards":0,"timestamp":"..."}
```

---

## 🛠️ Troubleshooting & Common Issues

### 1. `npm warn EBADENGINE` — Node version mismatch

If you're on **Node 16**, you'll see an engine warning like:

```
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'hhgoa-2026-builder-id-backend@2.0.0',
npm warn EBADENGINE   required: { node: '>=18.0.0' },
npm warn EBADENGINE   current: { node: 'v16.20.0', npm: '8.19.4' }
npm warn EBADENGINE }
```

**Fix:** Upgrade Node via [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install 18
nvm use 18
```

Running on Node 16 anyway *may* work for the pure-JS dependencies, but `sharp` prebuilt binaries are only reliably published for Node 18+, so image processing is the most likely thing to break.

### 2. `sharp` install fails / hangs on restricted networks (college Wi-Fi, corporate proxies)

`sharp` downloads a prebuilt native binary (`libvips`) during `npm install`. Campus/office networks that block binary downloads over HTTPS or intercept traffic via a proxy often cause this to hang or fail with `ETIMEDOUT` / `EAI_AGAIN` errors.

**Option A — Retry with a direct/mobile hotspot connection**, then reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

**Option B — Force a compatible platform build explicitly** (useful on flaky networks or when switching between machines with different OS/arch):

```bash
npm install --platform=linux --arch=x64 sharp
# macOS Apple Silicon:
npm install --platform=darwin --arch=arm64 sharp
```

**Option C — Point `sharp` at a mirror**, if your network blocks GitHub Releases directly:

```bash
npm install --sharp-libvips-binary-host=https://npmmirror.com/mirrors/sharp-libvips sharp
```

**Option D — Fallback to `jimp` (pure JavaScript, no native binary)**

If `sharp` genuinely cannot be installed on your network (e.g., locked-down hackathon venue Wi-Fi with no way around it), swap it for [`jimp`](https://www.npmjs.com/package/jimp), which is pure JS and has zero native/binary dependencies:

```bash
npm uninstall sharp
npm install jimp
```

Then replace the `sharp` pipeline in `/api/process-image` with the `jimp` equivalent:

```js
const Jimp = require('jimp');

const image = await Jimp.read(inputBuffer);
image.autoRotate(); // EXIF-based auto-rotation (async in some Jimp versions — check your installed API)
image.cover(600, 600); // square crop, cover fit
const processedBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
```

> ⚠️ **Trade-off:** `jimp` is slower and has a smaller feature set than `sharp` (notably weaker HEIC support, which matters for iPhone camera uploads). Treat it as an emergency fallback for getting the demo running on-site, not a permanent swap — re-install `sharp` once you're back on a normal connection.

### 3. `EADDRINUSE: address already in use :::3000`

Another process is already bound to the port.

```bash
# Find and kill whatever's using port 3000
lsof -i :3000
kill -9 <PID>

# ...or just run on a different port
PORT=4000 npm start
```

### 4. CORS errors from the frontend (`blocked by CORS policy`)

The backend only allows `localhost`, `*.vercel.app`, `*.netlify.app`, and `*.onrender.com` origins by default. If your frontend is deployed elsewhere, add its origin pattern to the `ALLOWED_ORIGIN_PATTERNS` array in `server.js`.

### 5. Share link image doesn't unfurl on X

- Confirm `BASE_URL` is set to your **public** deployed URL, not `localhost` — X's crawler can't reach your machine.
- X caches link previews aggressively. Use the [Card Validator](https://cards-dev.twitter.com/validator) (or just post a fresh tweet-intent link with a new `cardId`) to force a re-fetch.
- Card links expire after 2 hours (TTL) — a stale `cardId` will 404.

---

## 📡 API Reference

Base URL (local): `http://localhost:3000`

### `POST /api/process-image`

Auto-rotates (EXIF-safe) and square-crops an uploaded builder photo.

**Request** — either:
- `multipart/form-data` with a `photo` file field, **or**
- `application/json`:

```json
{ "photoBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRg..." }
```

**Response — `200 OK`**

```json
{
  "success": true,
  "base64Photo": "data:image/png;base64,iVBORw0KGgoAAAANSU..."
}
```

| Status | Meaning |
|---|---|
| `400` | No `photo` file or `photoBase64` provided |
| `413` | File exceeds the 10MB limit |

---

### `POST /api/generate-qr`

Generates a dark-mode/neon-styled QR code.

**Request**

```json
{ "url": "https://hhgoa.com" }
```
*(`url` is optional — defaults to `https://hhgoa.com`)*

**Response — `200 OK`**

```json
{
  "success": true,
  "qrCodeBase64": "data:image/png;base64,iVBORw0KGgoAAAANSU..."
}
```

---

### `POST /api/generate-pdf`

Compiles the Front + Back card images into a 2-page, print-ready PDF and streams it back as a file download.

**Request**

```json
{
  "frontImageBase64": "data:image/png;base64,...",
  "backImageBase64": "data:image/png;base64,...",
  "filename": "HH_Goa_2026_Builder_ID.pdf"
}
```

**Response — `200 OK`**
Binary PDF stream.

| Header | Value |
|---|---|
| `Content-Type` | `application/pdf` |
| `Content-Disposition` | `attachment; filename="HH_Goa_2026_Builder_ID.pdf"` |

| Status | Meaning |
|---|---|
| `400` | Missing `frontImageBase64` or `backImageBase64` |

---

### `POST /api/create-share-link`

Caches the finished card images and returns a shareable link.

**Request**

```json
{
  "frontImageBase64": "data:image/png;base64,...",
  "backImageBase64": "data:image/png;base64,..."
}
```

**Response — `200 OK`**

```json
{
  "success": true,
  "cardId": "a1b2c3d4",
  "shareUrl": "https://hhgoa-backend.onrender.com/share/a1b2c3d4"
}
```

> ⏳ Cached entries expire after **2 hours** and are swept every **15 minutes**.

---

### `GET /share/:cardId`

Server-rendered HTML preview page with OpenGraph + Twitter Card meta tags, plus a "Share on X" button.

| Meta tag | Value |
|---|---|
| `og:title` | `My HH Goa 2026 Builder ID Card!` |
| `og:description` | `Check out my official double-sided Builder Badge for Hacker House Goa 2026. #FRAMEINGOA #BUILDINPARADISE` |
| `og:image` | `/api/card-image/:cardId?side=front` |
| `twitter:card` | `summary_large_image` |
| `twitter:image` | `/api/card-image/:cardId?side=front` |

| Status | Meaning |
|---|---|
| `200` | Renders the HTML preview page |
| `404` | `cardId` not found or expired |

---

### `GET /api/card-image/:cardId`

Serves the raw PNG buffer for a cached card side. Used both by the preview page above and by X's link-unfurl crawler.

**Query params**

| Param | Values | Default |
|---|---|---|
| `side` | `front` \| `back` | `front` |

**Response — `200 OK`**
Raw `image/png` binary.

| Status | Meaning |
|---|---|
| `400` | Invalid `side` value |
| `404` | `cardId` not found or expired |

---

### `GET /api/health`

Liveness check for uptime monitors / deploy platforms.

**Response — `200 OK`**

```json
{
  "status": "healthy",
  "uptime": 134.812,
  "cachedCards": 3,
  "timestamp": "2026-08-11T10:32:00.000Z"
}
```

---

## ☁️ Deployment

### Deploying on Render

1. Push this repo to GitHub.
2. In the Render dashboard: **New → Web Service**, connect the `HackerHouse_GOA` repo.
3. Configure:
   | Setting | Value |
   |---|---|
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Node Version | `18` (set via `Environment` tab or a `.node-version` file) |
4. Add environment variables under **Environment → Environment Variables**:
   | Key | Value |
   |---|---|
   | `PORT` | `10000` *(Render injects its own `PORT` — read `process.env.PORT`, which the app already does)* |
   | `BASE_URL` | `https://<your-service-name>.onrender.com` |
5. Deploy. Render will build and boot the service; watch the logs for the `🏝️ HH Goa 2026 Builder ID backend running on port ...` line.
6. Once live, hit `https://<your-service-name>.onrender.com/api/health` to confirm.

> **Note:** Render's free tier spins down idle services. The in-memory share-link cache is wiped on every cold start/restart — acceptable for a 2-hour-TTL cache, but don't rely on links surviving a redeploy.

### Deploying on Railway

1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo**, select `HackerHouse_GOA`.
3. Railway auto-detects Node.js and runs `npm install && npm start` by default — no build command changes needed.
4. Under **Variables**, add:
   | Key | Value |
   |---|---|
   | `BASE_URL` | `https://<your-service>.up.railway.app` |
   *(`PORT` is injected automatically by Railway — the app already reads `process.env.PORT`.)*
5. Under **Settings → Networking**, generate a public domain if one isn't assigned automatically.
6. Redeploy, then verify via `/api/health`.

### General deployment checklist

- [ ] `BASE_URL` set to the **public** HTTPS URL (required for X link unfurls to work)
- [ ] Node version pinned to `>=18` on the platform
- [ ] CORS origin patterns updated if the frontend domain isn't `localhost`/Vercel/Netlify/Render
- [ ] `.env` is **not** committed (confirm `.gitignore` includes it)
- [ ] `/api/health` returns `200` post-deploy

---

## 📜 License

MIT © Akshat — Backend Lead, Hacker House Goa 2026

---

*Built for Hacker House Goa 2026 — where code meets the coast. Ship products, not just hacks.* 🌊
