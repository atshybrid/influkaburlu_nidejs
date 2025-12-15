const { LandingContent } = require('../models');

function setLandingCacheHeaders(res) {
  // Cache in browsers for 5 minutes; allow CDN/proxy to cache longer.
  res.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
}

async function getByKey(key, fallback) {
  const row = await LandingContent.findOne({ where: { key } });
  if (row && row.data && typeof row.data === 'object') return row.data;
  return fallback;
}

// Public
exports.getLanding = async (req, res) => {
  try {
    setLandingCacheHeaders(res);
    const trusted = await getByKey('trusted', { logos: [], highlights: [], cases: [] });
    const results = await getByKey('case-studies', { items: [] });
    const testimonials = await getByKey('testimonials', { items: [] });
    return res.json({ trusted, results, testimonials });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.getTrusted = async (req, res) => {
  try {
    setLandingCacheHeaders(res);
    const data = await getByKey('trusted', { logos: [], highlights: [], cases: [] });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.getCaseStudies = async (req, res) => {
  try {
    setLandingCacheHeaders(res);
    const data = await getByKey('case-studies', { items: [] });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.getTestimonials = async (req, res) => {
  try {
    setLandingCacheHeaders(res);
    const data = await getByKey('testimonials', { items: [] });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

// Admin CRUD
exports.adminList = async (req, res) => {
  try {
    const rows = await LandingContent.findAll({
      attributes: ['key', 'ulid', 'updatedAt', 'createdAt'],
      order: [['key', 'ASC']],
    });
    return res.json({ items: rows });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.adminGet = async (req, res) => {
  try {
    const { key } = req.params;
    if (!key) return res.status(400).json({ error: 'key_required' });

    const row = await LandingContent.findOne({ where: { key } });
    if (!row) return res.status(404).json({ error: 'not_found' });

    return res.json({ key: row.key, data: row.data || {}, ulid: row.ulid, updatedAt: row.updatedAt, createdAt: row.createdAt });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.adminUpsert = async (req, res) => {
  try {
    const { key } = req.params;
    if (!key) return res.status(400).json({ error: 'key_required' });

    const payload = req.body;
    const data = (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) ? payload.data : payload;
    if (!data || typeof data !== 'object') return res.status(400).json({ error: 'data_required' });

    const existing = await LandingContent.findOne({ where: { key } });
    if (existing) {
      existing.data = data;
      await existing.save();
      return res.json({ ok: true, key, data: existing.data, updatedAt: existing.updatedAt });
    }

    const created = await LandingContent.create({ key, data });
    return res.status(201).json({ ok: true, key, data: created.data, createdAt: created.createdAt });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.adminDelete = async (req, res) => {
  try {
    const { key } = req.params;
    if (!key) return res.status(400).json({ error: 'key_required' });

    const row = await LandingContent.findOne({ where: { key } });
    if (!row) return res.status(404).json({ error: 'not_found' });

    await row.destroy();
    return res.json({ ok: true, key });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};
