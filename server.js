/**
 * ============================================================================
 *  HACKER HOUSE GOA 2026 — BUILDER ID CARD GENERATOR
 *  Backend Service (Node.js + Express)
 * ----------------------------------------------------------------------------
 *  Owner: Akshat (Backend Lead)
 *
 *  Responsibilities:
 *   1. Process mobile camera photos (EXIF auto-rotate + square crop)
 *   2. Generate dynamic, dark-mode styled QR codes server-side
 *   3. Assemble a 2-page (Front + Back) print-ready PDF via PDFKit
 *   4. Create shareable card links with OpenGraph/Twitter meta tags so the
 *      compulsory "Share on X" button unfurls correctly in the X timeline
 *
 *  All in-memory state (the share-link cache) is intentionally ephemeral —
 *  see the cleanup job below. Swap the Map for Redis/S3 if this needs to
 *  survive process restarts or scale horizontally.
 * ============================================================================
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { TwitterApi } = require('twitter-api-v2');

const app = express();

// ----------------------------------------------------------------------------
// CONFIG
// ----------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
// BASE_URL should be the publicly reachable URL of this service (used to build
// absolute share links + OG image URLs). Falls back to req-derived host if unset.
const BASE_URL = process.env.BASE_URL || '';

const CARD_SIDE = { FRONT: 'front', BACK: 'back' };
const SHARE_LINK_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;   // 15 minutes
const PHOTO_SIZE_PX = 600;                    // square crop target (px)
const PDF_PAGE = { width: 432, height: 540 }; // pt — matches 1080x1350 (4:5) ratio

// ----------------------------------------------------------------------------
// MIDDLEWARE
// ----------------------------------------------------------------------------

// CORS — allow localhost (any port) plus Vercel / Netlify / Render preview
// and production domains, since the frontend may be deployed on any of these.
const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^https:\/\/([a-z0-9-]+\.)*vercel\.app$/,
  /^https:\/\/([a-z0-9-]+\.)*netlify\.app$/,
  /^https:\/\/([a-z0-9-]+\.)*onrender\.com$/,
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (curl, server-to-server, X's link-preview
      // crawler) that don't send an Origin header at all.
      if (!origin) return callback(null, true);

      const isAllowed = ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
      if (isAllowed) return callback(null, true);

      return callback(new Error(`CORS: origin "${origin}" not allowed`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: false,
  })
);

// JSON body parsing — generous limit since payloads carry base64 image data.
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Serve static frontend files from public/ directory
app.use(express.static(path.join(__dirname, 'public')));

// Multer — memory storage so we never touch disk for uploaded mobile photos.
// 10MB cap keeps large HEIC/JPEG camera captures in check.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ----------------------------------------------------------------------------
// IN-MEMORY SHARE-LINK CACHE
// ----------------------------------------------------------------------------
// cardId -> { frontBuffer, backBuffer, createdAt }
const cardCache = new Map();

/**
 * Periodically purges share-link entries older than SHARE_LINK_TTL_MS so the
 * process doesn't accumulate unbounded image buffers in memory.
 */
function cleanupExpiredCards() {
  const now = Date.now();
  let purged = 0;

  for (const [cardId, entry] of cardCache.entries()) {
    if (now - entry.createdAt > SHARE_LINK_TTL_MS) {
      cardCache.delete(cardId);
      purged += 1;
    }
  }

  if (purged > 0) {
    console.log(`[cleanup] purged ${purged} expired card(s); ${cardCache.size} remaining`);
  }
}

setInterval(cleanupExpiredCards, CLEANUP_INTERVAL_MS);

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

/**
 * Resolves the absolute base URL of this service, preferring the configured
 * BASE_URL env var (recommended in production) and falling back to values
 * derived from the incoming request (handy for local dev).
 */
function getBaseUrl(req) {
  if (BASE_URL) return BASE_URL.replace(/\/+$/, '');
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  return `${protocol}://${req.get('host')}`;
}

/**
 * Strips a "data:image/png;base64,...." prefix (if present) and returns a
 * raw Buffer. Accepts either a bare base64 string or a full data URL.
 */
function base64ToBuffer(base64String) {
  if (!base64String || typeof base64String !== 'string') {
    throw new Error('Expected a base64 string');
  }
  const commaIndex = base64String.indexOf(',');
  const rawBase64 = base64String.startsWith('data:') && commaIndex !== -1
    ? base64String.slice(commaIndex + 1)
    : base64String;
  return Buffer.from(rawBase64, 'base64');
}

/** Wraps a Buffer as a `data:image/png;base64,...` string for JSON responses. */
function bufferToDataUrl(buffer, mime = 'image/png') {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

/** Generates a short, URL-safe 8-character card ID from a UUID v4. */
function generateCardId() {
  return uuidv4().replace(/-/g, '').slice(0, 8);
}

/** Escapes text for safe interpolation into HTML meta tags. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Wraps an async route handler so rejected promises reach the error middleware. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ============================================================================
// A. POST /api/process-image
//    Auto-rotates (EXIF-safe), square-crops (600x600, cover fit), and
//    compresses an uploaded builder photo. Accepts either a multipart
//    "photo" file or a JSON { photoBase64 } string — handy since the mobile
//    camera-capture flow and the base64 fallback flow both need to work.
// ============================================================================
app.post(
  '/api/process-image',
  upload.single('photo'), // no-ops automatically when request isn't multipart
  asyncHandler(async (req, res) => {
    let inputBuffer;

    if (req.file && req.file.buffer) {
      inputBuffer = req.file.buffer;
    } else if (req.body && req.body.photoBase64) {
      inputBuffer = base64ToBuffer(req.body.photoBase64);
    } else {
      return res.status(400).json({
        success: false,
        error: 'No photo provided. Send multipart field "photo" or JSON "photoBase64".',
      });
    }

    // .rotate() with no args reads the EXIF Orientation tag and auto-corrects
    // it — this is what fixes upside-down / sideways mobile camera captures.
    const processedBuffer = await sharp(inputBuffer)
      .rotate()
      .resize(PHOTO_SIZE_PX, PHOTO_SIZE_PX, { fit: 'cover', position: 'centre' })
      .png({ quality: 90, compressionLevel: 8 })
      .toBuffer();

    return res.json({
      success: true,
      base64Photo: bufferToDataUrl(processedBuffer, 'image/png'),
    });
  })
);

// ============================================================================
// B. POST /api/generate-qr
//    Renders a dark-mode styled QR code (light dots on a transparent/dark
//    backdrop-friendly palette) pointing at the event site by default.
// ============================================================================
app.post(
  '/api/generate-qr',
  asyncHandler(async (req, res) => {
    const targetUrl = (req.body && req.body.url) || 'https://hhgoa.com';

    const qrBuffer = await QRCode.toBuffer(targetUrl, {
      type: 'png',
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 512,
      color: {
        dark: '#0BFFC0',  // neon mint — matches the tropical/neon tech aesthetic
        light: '#00000000', // transparent background so it drops onto the template cleanly
      },
    });

    return res.json({
      success: true,
      qrCodeBase64: bufferToDataUrl(qrBuffer, 'image/png'),
    });
  })
);

// ============================================================================
// C. POST /api/generate-pdf
//    Assembles the finished Front + Back card images into a single 2-page,
//    print-ready PDF (432x540pt pages, matching the 1080x1350 4:5 ratio) and
//    streams it back as a downloadable attachment.
// ============================================================================
app.post(
  '/api/generate-pdf',
  asyncHandler(async (req, res) => {
    const { frontImageBase64, backImageBase64, filename } = req.body || {};

    if (!frontImageBase64 || !backImageBase64) {
      return res.status(400).json({
        success: false,
        error: 'Both "frontImageBase64" and "backImageBase64" are required.',
      });
    }

    const frontBuffer = base64ToBuffer(frontImageBase64);
    const backBuffer = base64ToBuffer(backImageBase64);
    const outFilename = filename || 'HH_Goa_2026_Builder_ID.pdf';

    const doc = new PDFDocument({
      size: [PDF_PAGE.width, PDF_PAGE.height],
      margin: 0,
      autoFirstPage: false,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${outFilename}"`);

    doc.pipe(res);

    // Page 1 — Front of card, rendered edge-to-edge (no margins).
    doc.addPage({ size: [PDF_PAGE.width, PDF_PAGE.height], margin: 0 });
    doc.image(frontBuffer, 0, 0, { width: PDF_PAGE.width, height: PDF_PAGE.height });

    // Page 2 — Back of card, rendered edge-to-edge.
    doc.addPage({ size: [PDF_PAGE.width, PDF_PAGE.height], margin: 0 });
    doc.image(backBuffer, 0, 0, { width: PDF_PAGE.width, height: PDF_PAGE.height });

    doc.end();
  })
);

// ============================================================================
// D. POST /api/create-share-link
//    Caches the finished card images in memory under a short cardId and
//    returns a shareable URL that resolves to the OG-tagged preview page
//    below (GET /share/:cardId).
// ============================================================================
app.post(
  '/api/create-share-link',
  asyncHandler(async (req, res) => {
    const { frontImageBase64, backImageBase64 } = req.body || {};

    if (!frontImageBase64 || !backImageBase64) {
      return res.status(400).json({
        success: false,
        error: 'Both "frontImageBase64" and "backImageBase64" are required.',
      });
    }

    const frontBuffer = base64ToBuffer(frontImageBase64);
    const backBuffer = base64ToBuffer(backImageBase64);

    let cardId = generateCardId();
    while (cardCache.has(cardId)) cardId = generateCardId(); // guard rare collisions

    cardCache.set(cardId, {
      frontBuffer,
      backBuffer,
      createdAt: Date.now(),
    });

    const baseUrl = getBaseUrl(req);

    return res.json({
      success: true,
      cardId,
      shareUrl: `${baseUrl}/share/${cardId}`,
    });
  })
);

// ============================================================================
// E. GET /share/:cardId
//    Server-rendered HTML preview page with OpenGraph + Twitter Card meta
//    tags so the compulsory "Share on X" flow unfurls a proper image card.
//    Also renders a human-friendly preview with a direct tweet-intent link.
// ============================================================================
app.get(
  '/share/:cardId',
  asyncHandler(async (req, res) => {
    const { cardId } = req.params;
    const entry = cardCache.get(cardId);

    if (!entry) {
      return res
        .status(404)
        .send('<h1>This Builder ID Card link has expired or does not exist.</h1>');
    }

    const baseUrl = getBaseUrl(req);
    const ogImageUrl = `${baseUrl}/api/card-image/${cardId}?side=front`;
    const pageUrl = `${baseUrl}/share/${cardId}`;

    const ogTitle = 'Hacker House Goa 2026 — Builder ID Card';
    const ogDescription = 'Just claimed my official Hacker House Goa 2026 Builder ID! #FrameInGOA';

    const tweetText = 'Just claimed my official Hacker House Goa 2026 Builder ID! #FrameInGOA';
    const tweetIntentUrl =
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}` +
      `&url=${encodeURIComponent(pageUrl)}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(ogTitle)}</title>

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(ogTitle)}" />
  <meta property="og:description" content="${escapeHtml(ogDescription)}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:url" content="${pageUrl}" />

  <!-- Twitter / X Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />
  <meta name="twitter:image" content="${ogImageUrl}" />

  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #071e13;
      color: #f5f5f5;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px 16px 48px;
    }
    h1 { font-size: 1.25rem; text-align: center; margin: 8px 0 4px; color: #f5ce38; }
    p.tagline { color: #e6ede8; text-align: center; margin: 0 0 24px; font-size: 0.9rem; }
    .cards { display: flex; justify-content: center; max-width: 480px; width: 100%; }
    .cards img {
      width: 100%;
      max-width: 420px;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      border: 1.5px solid rgba(245, 206, 56, 0.3);
    }
    .share-btn {
      margin-top: 28px;
      background: #ff2b70;
      color: #fff;
      border: none;
      padding: 12px 28px;
      border-radius: 999px;
      font-size: 1rem;
      font-weight: 700;
      text-decoration: none;
      display: inline-block;
    }
    .share-btn:hover { background: #ff4d88; }
  </style>
</head>
<body>
  <h1>${escapeHtml(ogTitle)}</h1>
  <p class="tagline">${escapeHtml(ogDescription)}</p>

  <div class="cards">
    <img src="${ogImageUrl}" alt="Builder ID Card — Front" />
  </div>

  <a class="share-btn" href="${tweetIntentUrl}" target="_blank" rel="noopener noreferrer">
    Share on X (Twitter)
  </a>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  })
);

// ============================================================================
// F. GET /api/card-image/:cardId
//    Serves the raw PNG buffer for a cached card side, consumed both by the
//    share preview page above and by X's/Slack's/etc. link-unfurl crawlers
//    (via the og:image / twitter:image URLs).
// ============================================================================
app.get(
  '/api/card-image/:cardId',
  asyncHandler(async (req, res) => {
    const { cardId } = req.params;
    const side = (req.query.side || CARD_SIDE.FRONT).toLowerCase();

    console.log('[Share Image] cardId:', cardId);

    const entry = cardCache.get(cardId);
    if (!entry) {
      console.log('[Share Image] photo available: false');
      console.log('[Share Image] photo data length: 0');
      return res.status(404).json({ success: false, error: 'Card not found or expired.' });
    }

    if (side !== CARD_SIDE.FRONT && side !== CARD_SIDE.BACK) {
      return res.status(400).json({ success: false, error: 'side must be "front" or "back".' });
    }

    const buffer = side === CARD_SIDE.BACK ? entry.backBuffer : entry.frontBuffer;

    console.log('[Share Image] photo available:', !!(buffer && buffer.length > 0));
    console.log('[Share Image] photo data length:', buffer ? buffer.length : 0);
    console.log('[Share Image] generating front card');
    console.log('[Share Image] final image generated');

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(buffer);
  })
);

// Helper to initialize TwitterApi client with OAuth 1.0a User Context
function getTwitterClient() {
  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
    return null;
  }
  return new TwitterApi({
    appKey: X_API_KEY,
    appSecret: X_API_SECRET,
    accessToken: X_ACCESS_TOKEN,
    accessSecret: X_ACCESS_SECRET,
  });
}

// ============================================================================
// H. POST /api/share-to-x
//    Uploads the FRONT ID card image directly to X using twitter-api-v2 and
//    creates a tweet with the image attached and hashtag #FrameInGOA.
// ============================================================================
app.post(
  '/api/share-to-x',
  asyncHandler(async (req, res) => {
    const { frontImageBase64, cardId } = req.body || {};

    if (!frontImageBase64) {
      return res.status(400).json({
        success: false,
        error: 'Missing required "frontImageBase64" parameter.',
      });
    }

    const twitterClient = getTwitterClient();
    if (!twitterClient) {
      return res.status(503).json({
        success: false,
        error: 'X API credentials are not configured on the server.',
      });
    }

    const imageBuffer = base64ToBuffer(frontImageBase64);

    // 1. Upload media buffer to X via OAuth 1.0a
    console.log('[X API] Uploading FRONT ID card media buffer (size: %d bytes)...', imageBuffer.length);
    const mediaId = await twitterClient.v1.uploadMedia(imageBuffer, { mimeType: 'image/jpeg' });
    console.log('[X API] Media uploaded successfully, media_id:', mediaId);

    // 2. Build Tweet text with share link if available
    let tweetText = 'Just claimed my official Hacker House Goa 2026 Builder ID! #FrameInGOA';
    if (cardId) {
      const baseUrl = getBaseUrl(req);
      tweetText += `\n${baseUrl}/share/${cardId}`;
    }

    // 3. Post Tweet with attached media ID
    console.log('[X API] Posting Tweet with media attachment...');
    const tweet = await twitterClient.v2.tweet({
      text: tweetText,
      media: { media_ids: [mediaId] },
    });

    console.log('[X API] Tweet posted successfully! Tweet ID:', tweet.data.id);
    const tweetUrl = `https://twitter.com/i/status/${tweet.data.id}`;

    return res.json({
      success: true,
      tweetId: tweet.data.id,
      tweetUrl,
    });
  })
);

// ============================================================================
// G. GET /api/health
//    Basic liveness/sanity check for uptime monitors and deploy platforms.
// ============================================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    cachedCards: cardCache.size,
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------------------------------
// 404 fallback for unmatched routes
// ----------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ success: false, error: `No route for ${req.method} ${req.originalUrl}` });
});

// ----------------------------------------------------------------------------
// CENTRALIZED ERROR-HANDLING MIDDLEWARE
// ----------------------------------------------------------------------------
// Must be defined last, with all four params, so Express treats it as an
// error handler. Catches Multer errors (file-too-large, etc.), CORS
// rejections, Sharp/PDFKit/QRCode failures forwarded via asyncHandler, and
// any other synchronous throw.
app.use((err, req, res, next) => {
  console.error('[error]', err);

  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ success: false, error: `Upload error: ${err.message}` });
  }

  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ success: false, error: err.message });
  }

  const status = err.status || 500;
  return res.status(status).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// ----------------------------------------------------------------------------
// SERVER BOOTSTRAP
// ----------------------------------------------------------------------------
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏝️  HH Goa 2026 Builder ID backend running on 0.0.0.0:${PORT}`);
    console.log(`    Base URL: ${BASE_URL || '(derived per-request from Host header)'}`);
  });
}

module.exports = app;
