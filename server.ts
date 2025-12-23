try {
  // Optional: Render/hosting environments often provide env vars directly.
  // Don't crash the server if dotenv isn't installed.
  require('dotenv').config();
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('dotenv not available; continuing with process.env only');
}
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const db = require('./src/models');
const routes = require('./src/routes');
const swaggerUi = require('swagger-ui-express');
let openapi;
try {
  openapi = require('./src/openapi.json');
} catch (e) {
  console.warn('Warning: openapi.json failed to load. Falling back to minimal spec. Error:', e.message);
  openapi = { openapi: '3.0.3', info: { title: 'Kaburlu Backend API', version: '1.0.0' }, servers: [{ url: `http://localhost:${process.env.PORT||4000}` }], paths: {} };
}

const app = express();
// Enable CORS for local dev and Swagger
app.use(cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Capture raw body for webhook signature verification (Meta sends X-Hub-Signature-256)
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));
// NOTE: Do NOT register express-fileupload globally.
// We also use multer for some endpoints (e.g. influencer video upload), and double-parsing
// multipart bodies will frequently cause "Unexpected end of form".
// express-fileupload is mounted only on the specific routes that need req.files.

function safeTimingEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyMetaSignature(req) {
  const appSecret = process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET;
  if (!appSecret) {
    console.warn('WhatsApp webhook: WHATSAPP_APP_SECRET not set; skipping signature verification');
    return true;
  }

  const signature = req.get('x-hub-signature-256');
  if (!signature) return false;

  const raw = req.rawBody;
  const bodyToSign = Buffer.isBuffer(raw) ? raw : Buffer.from(JSON.stringify(req.body ?? {}));
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(bodyToSign).digest('hex');
  return safeTimingEqual(signature, expected);
}

app.use('/api', routes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi));

// Expose the raw OpenAPI spec (useful for Swagger tooling / Postman import)
app.get('/openapi.json', (req, res) => {
  res.json(openapi);
});

// SEO: robots.txt
app.get('/robots.txt', (req, res) => {
  const base = String(process.env.BASE_URL || '').trim().replace(/\/$/, '');
  const sitemapUrl = base ? `${base}/sitemap.xml` : '/sitemap.xml';
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${sitemapUrl}\n`);
});

// SEO: sitemap.xml
app.get('/sitemap.xml', async (req, res) => {
  try {
    const base = String(process.env.BASE_URL || '').trim().replace(/\/$/, '');
    const hostname = base || `${req.protocol}://${req.get('host')}`;
    const { SitemapStream, streamToPromise } = require('sitemap');
    const { Influencer } = require('./src/models');

    const rows = await Influencer.findAll({ attributes: ['slug', 'updatedAt'] });
    const smStream = new SitemapStream({ hostname });

    for (const i of rows) {
      if (!i.slug) continue;
      smStream.write({
        url: `/influencer/${i.slug}`,
        changefreq: 'weekly',
        priority: 0.9,
        lastmod: i.updatedAt ? new Date(i.updatedAt).toISOString() : undefined,
      });
    }
    smStream.end();

    const xml = await streamToPromise(smStream).then((d) => d.toString());
    res.type('application/xml');
    res.send(xml);
  } catch (err) {
    res.status(500).json({ error: 'server_error', details: err.message });
  }
});

// ===============================
// WhatsApp Webhook Verification
// ===============================
app.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ WhatsApp Webhook verified');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ===============================
// WhatsApp Message Status Webhook
// ===============================
app.post('/webhook/whatsapp', (req, res) => {
  if (!verifyMetaSignature(req)) {
    return res.sendStatus(403);
  }

  const entry = req.body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  // DELIVERY STATUS
  if (Array.isArray(value?.statuses)) {
    value.statuses.forEach((status) => {
      console.log('📩 Message ID:', status.id);
      console.log('📱 To:', status.recipient_id);
      console.log('📌 Status:', status.status);
      console.log('🕒 Timestamp:', status.timestamp);

      if (status.errors) {
        console.log('❌ Error:', status.errors);
      }

      /*
        TODO:
        Save status to DB
        update message_logs set status='delivered/read/failed'
      */
    });
  }

  // Incoming messages (optional)
  if (Array.isArray(value?.messages)) {
    console.log('📨 Incoming message:', JSON.stringify(value.messages, null, 2));
  }

  res.sendStatus(200);
});

// Centralized error handler (ensures API errors return JSON, not HTML)
// This is especially important for multipart/busboy/multer errors like "Unexpected end of form".
app.use((err, req, res, next) => {
  try {
    if (!err) return next();
    const isApi = String(req.originalUrl || '').startsWith('/api');
    if (!isApi) {
      return next(err);
    }
    const msg = err.message || 'Internal Server Error';
    // Common multipart parsing errors
    if (/Unexpected end of form/i.test(msg)) {
      return res.status(400).json({
        error: 'multipart_incomplete',
        details: msg,
        hint: 'Your multipart body is incomplete. If using curl, DO NOT set Content-Type manually (it must include a boundary). On Windows PowerShell use curl.exe and -F fields; avoid filenames with # or spaces while testing.'
      });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'file_too_large', details: msg });
    }
    return res.status(err.statusCode || err.status || 500).json({ error: 'server_error', details: msg });
  } catch (_) {
    return res.status(500).json({ error: 'server_error' });
  }
});

// Simple health endpoint for connectivity checks
app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

const PORT = process.env.PORT || 4000;

async function connectWithRetry(retries = 8, delayMs = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      await db.sequelize.authenticate();

    // Ensure schema patches that may have failed during module load.
    try {
      if (typeof db.ensureUserAuthColumns === 'function') {
        await db.ensureUserAuthColumns();
      }
    } catch (e) {
      console.warn('Warning: ensureUserAuthColumns failed:', e?.message || e);
    }

    try {
      if (typeof db.ensureInfluencerUlidColumn === 'function') {
        await db.ensureInfluencerUlidColumn();
      }
    } catch (e) {
      console.warn('Warning: ensureInfluencerUlidColumn failed:', e?.message || e);
    }

      await db.sequelize.sync();
      console.log('Database connected and synced');
      return;
    } catch (err) {
      console.error(`DB connect failed (attempt ${i + 1}/${retries}):`, err?.original?.code || err.message);
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delayMs * Math.pow(1.5, i))); // backoff
    }
  }
}

connectWithRetry()
  .then(() => {
    app.listen(PORT, () => {
      const hasRazorpay = !!process.env.RAZORPAY_KEY_ID && (!!process.env.RAZORPAY_SECRET || !!process.env.RAZORPAY_KEY_SECRET);
      const env = process.env.NODE_ENV || 'development';
      const keyId = process.env.RAZORPAY_KEY_ID || '';
      const looksLiveKey = keyId.startsWith('rzp_live_');
      if (!hasRazorpay) {
        console.warn('Warning: Razorpay keys not set. Set RAZORPAY_KEY_ID and RAZORPAY_SECRET (or RAZORPAY_KEY_SECRET) in .env');
      } else {
        const maskedId = keyId ? keyId.slice(0, 6) + '...' + keyId.slice(-4) : 'unset';
        console.log(`Razorpay key configured: ${maskedId}`);
        if (env === 'development' && looksLiveKey) {
          console.error('Blocked: LIVE Razorpay key detected in development. Switch to test keys (rzp_test_...) or set NODE_ENV=production for live.');
          process.exit(1);
        }
      }
      // Masked presence logs for other sensitive keys
      const openaiKey = process.env.OPENAI_API_KEY || '';
      if (openaiKey) {
        const maskedOpenAI = openaiKey.slice(0, 7) + '...' + openaiKey.slice(-5);
        console.log(`OpenAI key present: ${maskedOpenAI}`);
      }
      const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
      const r2Secret = process.env.R2_SECRET_ACCESS_KEY || '';
      if (r2AccessKeyId && r2Secret) {
        const maskedR2Id = r2AccessKeyId.slice(0, 6) + '...' + r2AccessKeyId.slice(-4);
        const maskedR2Secret = r2Secret.slice(0, 6) + '...' + r2Secret.slice(-4);
        console.log(`Cloudflare R2 keys present: ${maskedR2Id} / ${maskedR2Secret}`);
      }
      console.log('Server running on port', PORT);
      console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
    });
    // Cleanup expired refresh tokens periodically
    const { RefreshToken } = require('./src/models');
    const intervalMs = parseInt(process.env.REFRESH_CLEANUP_INTERVAL_MS || '3600000', 10); // 1h
    setInterval(async () => {
      try {
        const n = await RefreshToken.destroy({ where: { expiresAt: { [db.sequelize.Op.lt]: new Date() } } });
        if (n) console.log(`Refresh cleanup removed ${n} expired tokens`);
      } catch (e) { console.warn('Refresh cleanup error', e.message); }
    }, intervalMs);
    // Start media status cron if enabled
    if (process.env.ENABLE_MEDIA_STATUS_CRON === 'true') {
      const { startMediaStatusCron } = require('./src/jobs/mediaStatusCron');
      startMediaStatusCron();
    }
  })
  .catch(err => {
    console.error('Unable to connect to DB:', err);
  });
