const { Influencer, InfluencerPricing, User, Country, State, District } = require('../models');
const { uploadBuffer } = require('../utils/r2');
const fs = require('fs');
const crypto = require('crypto');

exports.me = async (req, res) => {
  const infl = await Influencer.findOne({ where: { userId: req.user.id } });
  if (!infl) return res.status(404).json({ error: 'not found' });
  let countryName = null;
  let stateName = null;
  let districtName = null;
  let stateNames = [];
  try {
    if (infl.countryId) {
      const c = await Country.findByPk(infl.countryId);
      countryName = c?.name || null;
    }
    if (infl.stateId) {
      const s = await State.findByPk(infl.stateId);
      stateName = s?.name || null;
    }
    if (Array.isArray(infl.stateIds) && infl.stateIds.length) {
      const rows = await State.findAll({ where: { id: infl.stateIds } });
      stateNames = rows.map(r => r.name).filter(Boolean);
    }
    if (infl.districtId) {
      const d = await District.findByPk(infl.districtId);
      districtName = d?.name || null;
    }
  } catch (_) {}
  const response = {
    ...infl.toJSON(),
    idUlid: infl.ulid,
    location: {
      country: infl.countryId || null,
      countryName,
      state: infl.stateId || null,
      stateName,
      stateIds: infl.stateIds || [],
      stateNames,
      district: infl.districtId || null,
      districtName
    }
  };
  res.json(response);
};

exports.dashboard = async (req, res) => {
  const userId = req.user.id;
  try {
    const infl = await Influencer.findOne({ where: { userId } });
    if (!infl) return res.status(404).json({ error: 'not found' });

    // Lightweight aggregates; replace with real queries if models exist
    const metrics = {
      activeBriefs: 3,
      pendingApprovals: 2,
      earningsMonth: 1280,
      nextPayout: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    };

    const today = new Date();
    const days = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      return { date: iso, hasTask: i % 3 === 0 };
    });

    const items = [
      { campaign: 'Acme Fitness', type: 'TikTok + Stories', due: days[8].date, status: 'In progress' },
      { campaign: 'Glow Cosmetics', type: 'UGC video', due: days[3].date, status: 'Pending approval' },
      { campaign: 'Neo Tech', type: 'Instagram Reel', due: days[12].date, status: 'Assigned' }
    ];

    const payouts = {
      history: [
        { month: 'Nov', amount: 980, status: 'Paid' },
        { month: 'Oct', amount: 1120, status: 'Paid' },
        { month: 'Sep', amount: 870, status: 'Paid' }
      ],
      nextPayout: metrics.nextPayout
    };

    res.json({
      influencer: { id: infl.id, idUlid: infl.ulid, handle: infl.handle, verificationStatus: infl.verificationStatus, badges: infl.badges || [] },
      metrics,
      calendar: { days },
      briefs: { items },
      payouts
    });
  } catch (err) {
    res.status(500).json({ error: 'server_error' });
  }
};

exports.update = async (req, res) => {
  const infl = await Influencer.findOne({ where: { userId: req.user.id } });
  if (!infl) return res.status(404).json({ error: 'not found' });
  const body = { ...req.body };
  // Prefer stateIds over stateId/states to avoid duplication
  if (Array.isArray(body.stateIds) && body.stateIds.length > 0) {
    delete body.stateId;
    delete body.states;
  }
  Object.assign(infl, body);
  await infl.save();
  res.json({ ...infl.toJSON(), idUlid: infl.ulid });
};

// Admin can assign verification/badges to any influencer
exports.assignBadge = async (req, res) => {
  const { id } = req.params;
  const { verificationStatus, badges } = req.body;
  const infl = await Influencer.findByPk(id);
  if (!infl) return res.status(404).json({ error: 'not found' });
  if (verificationStatus) infl.verificationStatus = verificationStatus;
  if (Array.isArray(badges)) infl.badges = badges;
  await infl.save();
  res.json({ ...infl.toJSON(), idUlid: infl.ulid });
};

// Update current influencer's profile picture.
// Accepts either multipart file (field: file) or JSON { imageUrl } to set directly.
exports.updateProfilePic = async (req, res) => {
  try {
    const infl = await Influencer.findOne({ where: { userId: req.user.id } });
    if (!infl) return res.status(404).json({ error: 'not found' });
    let url = null;
    if (req.files && req.files.file) {
      const file = req.files.file;
      const id = crypto.randomUUID();
      const key = `uploads/${req.user.id}/image/profile-${id}-${file.name}`;
      const buffer = file.data && file.data.length ? file.data : await fs.promises.readFile(file.tempFilePath);
      const out = await uploadBuffer(key, buffer, file.mimetype || 'image/jpeg');
      url = out.url;
    } else if (req.body && req.body.imageUrl) {
      url = String(req.body.imageUrl);
    } else {
      return res.status(400).json({ error: 'Provide file or imageUrl' });
    }
    infl.profilePicUrl = url;
    await infl.save();
    res.json({ success: true, profilePicUrl: infl.profilePicUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get current influencer ad pricing (prefers pricing table, with fallbacks)
exports.getPricing = async (req, res) => {
  try {
    const infl = await Influencer.findOne({ where: { userId: req.user.id }, attributes: ['id', 'adPricing', 'rateCards'] });
    if (!infl) return res.status(404).json({ error: 'Influencer not found' });
    const pricingRow = await InfluencerPricing.findOne({ where: { influencerId: infl.id } });
    let pricing = (pricingRow && pricingRow.adPricing) || infl.adPricing || {};
    const rc = infl.rateCards;
    if (!pricing || Object.keys(pricing).length === 0) {
      if (rc && typeof rc === 'object' && rc.adPricing) pricing = rc.adPricing;
      else if (Array.isArray(rc) && rc.length > 0 && rc[0]?.adPricing) pricing = rc[0].adPricing;
    }
    return res.json({ adPricing: pricing || {} });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch pricing' });
  }
};

// Update current influencer ad pricing (upsert pricing table, mirror legacy)
exports.updatePricing = async (req, res) => {
  try {
    const infl = await Influencer.findOne({ where: { userId: req.user.id } });
    if (!infl) return res.status(404).json({ error: 'Influencer not found' });
    const incoming = (req.body && req.body.adPricing) || {};
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ error: 'adPricing object required' });
    }
    const [row, created] = await InfluencerPricing.findOrCreate({
      where: { influencerId: infl.id },
      defaults: { influencerId: infl.id, adPricing: incoming },
    });
    if (!created) {
      row.adPricing = incoming;
      await row.save();
    }
    infl.adPricing = incoming;
    let rc = infl.rateCards;
    if (!rc || typeof rc !== 'object' || Array.isArray(rc)) rc = {};
    rc.adPricing = incoming;
    infl.rateCards = rc;
    await infl.save();
    return res.json({ adPricing: row.adPricing || {} });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update pricing' });
  }
};
