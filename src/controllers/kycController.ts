const { Influencer, InfluencerKyc } = require('../models');
const bcrypt = require('bcryptjs');

function normalizeKycStatus(input) {
  if (input === undefined || input === null) return null;
  const s = String(input).trim().toLowerCase();
  if (!s) return null;
  if (['verified', 'verify', 'approve', 'approved', 'approveed', 'accept', 'accepted', 'ok'].includes(s)) return 'verified';
  if (['rejected', 'reject', 'deny', 'denied', 'decline', 'declined'].includes(s)) return 'rejected';
  if (['pending', 'hold', 'inreview', 'in_review', 'in review', 'review'].includes(s)) return 'pending';
  return null;
}

function maskPan(pan) {
  if (!pan) return null;
  return pan.replace(/.(?=.{4})/g, '*');
}

function isKycComplete(kyc) {
  if (!kyc) return false;
  const required = ['fullName','dob','pan','addressLine1','postalCode','city','state','country'];
  for (const f of required) {
    const v = kyc[f];
    if (!v || (typeof v === 'string' && !v.trim())) return false;
  }
  if (!kyc.consentTs) return false;
  return true;
}

exports.getMe = async (req, res) => {
  try {
    const infl = await Influencer.findOne({ where: { userId: req.user.id } });
    if (!infl) return res.status(404).json({ error: 'not found' });
    const kyc = await InfluencerKyc.findOne({ where: { influencerId: infl.id } });
    if (!kyc) return res.json({ status: 'none', kyc: {}, meta: { isComplete: false, askKyc: true } });
    const data = kyc.toJSON();
    const complete = isKycComplete(data);
    data.pan = maskPan(data.pan);
    res.json({ status: data.status, kyc: data, meta: { isComplete: complete, askKyc: !complete } });
  } catch (err) {
    res.status(500).json({ error: 'server_error' });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const infl = await Influencer.findOne({ where: { userId: req.user.id } });
    if (!infl) return res.status(404).json({ error: 'not found' });
    const body = req.body || {};
    const defaults = { influencerId: infl.id };
    const [kyc, created] = await InfluencerKyc.findOrCreate({ where: { influencerId: infl.id }, defaults });
    const originalStatus = kyc.status || 'pending';
    const fields = ['fullName','dob','pan','addressLine1','addressLine2','postalCode','city','state','country','documents'];
    for (const f of fields) {
      if (body[f] !== undefined) {
        // If verified, do not override PAN
        if (originalStatus === 'verified' && f === 'pan') continue;
        kyc[f] = body[f];
      }
    }
    // Aadhaar handling: store hash + last4 only
    if (body.aadhaarNumber && originalStatus !== 'verified') {
      const aad = String(body.aadhaarNumber).replace(/\D/g, '');
      if (aad.length < 8) return res.status(400).json({ error: 'invalid_aadhaar' });
      const salt = await bcrypt.genSalt(10);
      kyc.aadhaarHash = await bcrypt.hash(aad, salt);
      kyc.aadhaarLast4 = aad.slice(-4);
    }
    // Merge document URLs if provided shorthand fields
    const docs = Object.assign({}, kyc.documents || {});
    if (body.photoUrl) docs.photoUrl = body.photoUrl;
    if (body.panPhotoUrl) docs.panPhotoUrl = body.panPhotoUrl;
    if (body.aadhaarPhotoUrl) docs.aadhaarPhotoUrl = body.aadhaarPhotoUrl;
    if (Object.keys(docs).length) kyc.documents = docs;
    if (typeof body.consent === 'boolean' && body.consent) kyc.consentTs = new Date();
    // Preserve verified status; otherwise keep or set to pending
    kyc.status = originalStatus === 'verified' ? 'verified' : 'pending';
    await kyc.save();
    const out = kyc.toJSON();
    const complete = isKycComplete(out);
    out.pan = maskPan(out.pan);
    delete out.aadhaarHash;
    res.json({ status: out.status, kyc: out, meta: { isComplete: complete, askKyc: !complete } });
  } catch (err) {
    res.status(500).json({ error: 'server_error' });
  }
};

// Admin: list KYC by status
exports.adminList = async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const normalized = status ? normalizeKycStatus(status) : null;
    if (status && !normalized) return res.status(400).json({ error: 'invalid_status', allowed: ['verified', 'rejected', 'pending'] });
    const where = normalized ? { status: normalized } : {};
    const rows = await InfluencerKyc.findAll({ where, order: [['updatedAt','DESC']], limit: parseInt(limit,10), offset: parseInt(offset,10) });
    const items = rows.map(r => { const o = r.toJSON(); o.pan = maskPan(o.pan); delete o.aadhaarHash; return o; });
    res.json({ items });
  } catch (e) { res.status(500).json({ error: 'server_error' }); }
};

// Admin: get one KYC
exports.adminGet = async (req, res) => {
  try {
    const row = await InfluencerKyc.findOne({ where: { influencerId: req.params.influencerId } });
    if (!row) return res.status(404).json({ error: 'not_found' });
    const o = row.toJSON(); o.pan = maskPan(o.pan); delete o.aadhaarHash; res.json(o);
  } catch (e) { res.status(500).json({ error: 'server_error' }); }
};

// Admin: set KYC status
exports.adminSetStatus = async (req, res) => {
  try {
    const { influencerId } = req.params;
    const { status, reason } = req.body || {};
    const normalized = normalizeKycStatus(status);
    if (!normalized) return res.status(400).json({ error: 'invalid_status', allowed: ['verified', 'rejected', 'pending'] });
    const row = await InfluencerKyc.findOne({ where: { influencerId } });
    if (!row) return res.status(404).json({ error: 'not_found' });
    row.status = normalized;
    row.verifiedAt = normalized === 'verified' ? new Date() : null;
    const docs = Object.assign({}, row.documents||{});
    if (reason) docs.adminReason = reason;
    row.documents = docs;
    await row.save();
    const o = row.toJSON(); o.pan = maskPan(o.pan); delete o.aadhaarHash; res.json(o);
  } catch (e) { res.status(500).json({ error: 'server_error' }); }
};
