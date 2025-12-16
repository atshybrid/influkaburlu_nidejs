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

function decodeJsonPointerSegment(seg) {
  return String(seg).replace(/~1/g, '/').replace(/~0/g, '~');
}

function getJsonPatchContainer(doc, pointerSegments, createMissing) {
  let current = doc;
  for (const seg of pointerSegments) {
    if (Array.isArray(current)) {
      const idx = Number(seg);
      if (!Number.isInteger(idx) || idx < 0 || idx >= current.length) {
        return { ok: false, error: 'invalid_path' };
      }
      current = current[idx];
      continue;
    }

    if (!current || typeof current !== 'object') {
      return { ok: false, error: 'invalid_path' };
    }

    if (!Object.prototype.hasOwnProperty.call(current, seg)) {
      if (!createMissing) return { ok: false, error: 'invalid_path' };
      current[seg] = {};
    }
    current = current[seg];
  }
  return { ok: true, current };
}

function applyJsonPatch(doc, operations) {
  if (!Array.isArray(operations)) return { ok: false, error: 'invalid_patch' };

  for (const op of operations) {
    if (!op || typeof op !== 'object') return { ok: false, error: 'invalid_patch' };

    const type = op.op;
    const path = op.path;
    if (!type || typeof type !== 'string') return { ok: false, error: 'invalid_patch' };
    if (!path || typeof path !== 'string' || !path.startsWith('/')) return { ok: false, error: 'invalid_patch' };

    const parts = path
      .split('/')
      .slice(1)
      .map(decodeJsonPointerSegment);

    const last = parts.pop();
    if (typeof last !== 'string') return { ok: false, error: 'invalid_patch' };

    const containerRes = getJsonPatchContainer(doc, parts, type === 'add');
    if (!containerRes.ok) return { ok: false, error: containerRes.error || 'invalid_path' };
    const container = containerRes.current;

    if (type === 'add') {
      if (Array.isArray(container)) {
        if (last === '-') {
          container.push(op.value);
        } else {
          const idx = Number(last);
          if (!Number.isInteger(idx) || idx < 0 || idx > container.length) return { ok: false, error: 'invalid_path' };
          container.splice(idx, 0, op.value);
        }
      } else if (container && typeof container === 'object') {
        container[last] = op.value;
      } else {
        return { ok: false, error: 'invalid_path' };
      }
      continue;
    }

    if (type === 'replace') {
      if (Array.isArray(container)) {
        const idx = Number(last);
        if (!Number.isInteger(idx) || idx < 0 || idx >= container.length) return { ok: false, error: 'invalid_path' };
        container[idx] = op.value;
      } else if (container && typeof container === 'object') {
        if (!Object.prototype.hasOwnProperty.call(container, last)) return { ok: false, error: 'invalid_path' };
        container[last] = op.value;
      } else {
        return { ok: false, error: 'invalid_path' };
      }
      continue;
    }

    if (type === 'remove') {
      if (Array.isArray(container)) {
        const idx = Number(last);
        if (!Number.isInteger(idx) || idx < 0 || idx >= container.length) return { ok: false, error: 'invalid_path' };
        container.splice(idx, 1);
      } else if (container && typeof container === 'object') {
        if (!Object.prototype.hasOwnProperty.call(container, last)) return { ok: false, error: 'invalid_path' };
        delete container[last];
      } else {
        return { ok: false, error: 'invalid_path' };
      }
      continue;
    }

    return { ok: false, error: 'unsupported_op' };
  }

  return { ok: true, doc };
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

// Admin: create a new landing content key
exports.adminCreate = async (req, res) => {
  try {
    const { key, data } = req.body || {};
    if (!key || typeof key !== 'string') return res.status(400).json({ error: 'key_required' });
    if (!data || typeof data !== 'object') return res.status(400).json({ error: 'data_required' });

    const exists = await LandingContent.findOne({ where: { key } });
    if (exists) return res.status(409).json({ error: 'already_exists' });

    const created = await LandingContent.create({ key, data });
    return res.status(201).json({ ok: true, key: created.key, data: created.data, createdAt: created.createdAt });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

// Admin: create a landing content entry by key from URL (e.g. POST /api/admin/landing/trusted)
exports.adminCreateByKey = async (req, res) => {
  try {
    const { key } = req.params;
    if (!key || typeof key !== 'string') return res.status(400).json({ error: 'key_required' });

    const payload = req.body;
    const data = (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) ? payload.data : payload;
    if (!data || typeof data !== 'object') return res.status(400).json({ error: 'data_required' });

    const exists = await LandingContent.findOne({ where: { key } });
    if (exists) return res.status(409).json({ error: 'already_exists' });

    const created = await LandingContent.create({ key, data });
    return res.status(201).json({ ok: true, key: created.key, data: created.data, createdAt: created.createdAt });
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

// Admin: update existing landing content (shallow merge)
exports.adminPatch = async (req, res) => {
  try {
    const { key } = req.params;
    if (!key) return res.status(400).json({ error: 'key_required' });

    const payload = req.body;
    const patchData = (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) ? payload.data : payload;
    if (patchData === undefined || patchData === null) return res.status(400).json({ error: 'data_required' });

    const row = await LandingContent.findOne({ where: { key } });
    if (!row) return res.status(404).json({ error: 'not_found' });

    const base = (row.data && typeof row.data === 'object') ? row.data : {};

    if (Array.isArray(patchData)) {
      const doc = JSON.parse(JSON.stringify(base));
      const patched = applyJsonPatch(doc, patchData);
      if (!patched.ok) return res.status(400).json({ error: patched.error || 'invalid_patch' });
      row.data = patched.doc;
    } else {
      if (typeof patchData !== 'object') return res.status(400).json({ error: 'data_required' });
      row.data = Object.assign({}, base, patchData);
    }
    await row.save();

    return res.json({ ok: true, key: row.key, data: row.data, updatedAt: row.updatedAt });
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
