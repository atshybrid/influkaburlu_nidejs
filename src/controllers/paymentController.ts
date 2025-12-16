const { Influencer, InfluencerPaymentMethod } = require('../models');

function normalizePaymentStatus(input) {
  if (input === undefined || input === null) return null;
  const s = String(input).trim().toLowerCase();
  if (!s) return null;
  if (['verified', 'verify', 'approve', 'approved', 'accept', 'accepted', 'ok'].includes(s)) return 'verified';
  if (['rejected', 'reject', 'deny', 'denied', 'decline', 'declined'].includes(s)) return 'rejected';
  if (['unverified', 'unverify', 'pending', 'hold', 'inreview', 'in_review', 'in review', 'review'].includes(s)) return 'unverified';
  return null;
}

function maskAccount(num) {
  if (!num) return null;
  const n = String(num);
  return n.length <= 4 ? '****' + n : '****' + n.slice(-4);
}
function maskUpi(id) {
  if (!id) return null;
  const parts = String(id).split('@');
  const name = parts[0] || '';
  const bank = parts[1] || '';
  const maskedName = name.length <= 2 ? name : name[0] + '***' + name.slice(-1);
  return maskedName + (bank ? '@' + bank : '');
}

exports.listMe = async (req, res) => {
  try {
    const infl = await Influencer.findOne({ where: { userId: req.user.id } });
    if (!infl) return res.status(404).json({ error: 'not found' });
    const methods = await InfluencerPaymentMethod.findAll({ where: { influencerId: infl.id }, order: [['isPreferred','DESC']] });
    const items = methods.map(m => {
      const obj = m.toJSON();
      obj.bankAccountNumberMasked = maskAccount(obj.bankAccountNumber);
      obj.upiIdMasked = maskUpi(obj.upiId);
      delete obj.bankAccountNumber;
      return obj;
    });
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: 'server_error' });
  }
};

exports.upsertMe = async (req, res) => {
  try {
    const infl = await Influencer.findOne({ where: { userId: req.user.id } });
    if (!infl) return res.status(404).json({ error: 'not found' });
    const body = req.body || {};
    const type = body.type === 'upi' ? 'upi' : 'bank';
    // Basic validation
    if (type === 'bank') {
      const required = ['accountHolderName','bankName','bankIfsc','bankAccountNumber'];
      for (const f of required) if (!body[f]) return res.status(400).json({ error: `Missing ${f}` });
      if (!/^\w{4}0\w{6}$/i.test(body.bankIfsc)) {
        return res.status(400).json({ error: 'Invalid IFSC format' });
      }
    } else if (type === 'upi') {
      if (!body.upiId || !/^[-\w.]{2,}@[\w-]{2,}$/i.test(body.upiId)) {
        return res.status(400).json({ error: 'Invalid UPI ID' });
      }
    }
    let method = await InfluencerPaymentMethod.findOne({ where: { influencerId: infl.id, type } });
    if (!method) {
      method = await InfluencerPaymentMethod.create({ influencerId: infl.id, type });
    }
    const fields = ['accountHolderName','bankName','bankIfsc','bankAccountNumber','upiId','isPreferred'];
    for (const f of fields) if (body[f] !== undefined) method[f] = body[f];
    method.status = 'unverified';
    await method.save();
    const obj = method.toJSON();
    obj.bankAccountNumberMasked = maskAccount(obj.bankAccountNumber);
    obj.upiIdMasked = maskUpi(obj.upiId);
    delete obj.bankAccountNumber;
    res.json({ method: obj });
  } catch (err) {
    res.status(500).json({ error: 'server_error' });
  }
};

exports.removeMe = async (req, res) => {
  try {
    const infl = await Influencer.findOne({ where: { userId: req.user.id } });
    if (!infl) return res.status(404).json({ error: 'not found' });
    const id = parseInt(req.params.id, 10);
    const row = await InfluencerPaymentMethod.findOne({ where: { id, influencerId: infl.id } });
    if (!row) return res.status(404).json({ error: 'not_found' });
    await row.destroy();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'server_error' }); }
};

exports.setPreferredMe = async (req, res) => {
  try {
    const infl = await Influencer.findOne({ where: { userId: req.user.id } });
    if (!infl) return res.status(404).json({ error: 'not found' });
    const id = parseInt(req.params.id, 10);
    const row = await InfluencerPaymentMethod.findOne({ where: { id, influencerId: infl.id } });
    if (!row) return res.status(404).json({ error: 'not_found' });
    await InfluencerPaymentMethod.update({ isPreferred: false }, { where: { influencerId: infl.id } });
    row.isPreferred = true;
    await row.save();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'server_error' }); }
};

// Admin: list all payment methods (optional filter by status)
exports.adminList = async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const where = status ? { status } : {};
    const rows = await InfluencerPaymentMethod.findAll({ where, order: [['updatedAt','DESC']], limit: parseInt(limit,10), offset: parseInt(offset,10) });
    const items = rows.map(m => {
      const obj = m.toJSON();
      obj.bankAccountNumberMasked = maskAccount(obj.bankAccountNumber);
      obj.upiIdMasked = maskUpi(obj.upiId);
      delete obj.bankAccountNumber;
      return obj;
    });
    res.json({ items });
  } catch (e) { res.status(500).json({ error: 'server_error' }); }
};

// Admin: set status (e.g., verified/rejected)
exports.adminSetStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const normalized = normalizePaymentStatus(status);
    if (!normalized) return res.status(400).json({ error: 'invalid_status', allowed: ['unverified', 'verified', 'rejected'] });
    const row = await InfluencerPaymentMethod.findByPk(id);
    if (!row) return res.status(404).json({ error: 'not_found' });
    row.status = normalized;
    await row.save();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'server_error' }); }
};
