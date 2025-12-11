require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./src/models');
const routes = require('./src/routes');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./src/openapi.json');

const app = express();
// Enable CORS for local dev and Swagger
app.use(cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi));

// Simple health endpoint for connectivity checks
app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

const PORT = process.env.PORT || 4000;

async function connectWithRetry(retries = 8, delayMs = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      await db.sequelize.authenticate();
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
  })
  .catch(err => {
    console.error('Unable to connect to DB:', err);
  });
