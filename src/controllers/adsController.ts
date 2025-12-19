const { Ad, Brand, BrandMember } = require('../models');
const { Op } = require('sequelize');

async function resolveTargetBrandForRequest(req, { allowOwnedBrandFallback = true } = {}) {
  const userId = req.user?.id;
  if (!userId) return null;

  const body = req.body || {};
  const brandUlid = body.brandUlid || body.brandIdUlid || req.query?.brandUlid || req.query?.brandIdUlid || null;
  const brandIdRaw = body.brandId || req.query?.brandId || null;
  const brandId = brandIdRaw != null ? parseInt(String(brandIdRaw), 10) : null;

  // Brand users: keep backward compatibility (brand inferred from owner userId)
  if (allowOwnedBrandFallback && !brandUlid && !brandId) {
    const owned = await Brand.findOne({ where: { userId } });
    if (owned) return owned;
  }

  const target = brandUlid
    ? await Brand.findOne({ where: { ulid: String(brandUlid) } })
    : (brandId ? await Brand.findByPk(brandId) : null);
  if (!target) return null;

  // Owner always allowed
  if (target.userId === userId) return target;

  // PR user (or any brand member) must be explicitly mapped
  const member = await BrandMember.findOne({ where: { brandId: target.id, userId, memberRole: 'pr' } });
  if (!member) return null;
  return target;
}

exports.createAd = async (req, res) => {
  try {
    const brand = await resolveTargetBrandForRequest(req);
    if (!brand) return res.status(403).json({ error: 'Forbidden' });
    const body = { ...req.body, brandId: brand.id, createdByUserId: req.user.id, updatedByUserId: req.user.id };
    delete body.brandUlid;
    delete body.brandIdUlid;
    const ad = await Ad.create(body);
    // Auto-create a Post of type 'ad' for feed visibility
    try {
      const { Post } = require('../models');
      const media = Array.isArray(req.body.media) ? req.body.media : [];
      const categories = Array.isArray(req.body.categories) ? req.body.categories : [];
      const states = Array.isArray(req.body.targetStates) ? req.body.targetStates : [];
      await Post.create({
        userId: req.user.id,
        influencerId: null,
        adId: ad.id,
        type: 'ad',
        caption: req.body.description || req.body.title || '',
        media,
        categories,
        language: req.body.language,
        states,
        status: 'active'
      });
    } catch (_) {}
    res.json({ ...ad.toJSON(), idUlid: ad.ulid });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.listAds = async (req, res) => {
  try {
    const { state, language, page=1, limit=20 } = req.query;
    const filter: any = { status: 'open' };
    if (state) filter.targetStates = { [Op.contains]: [state] };
    if (language) filter.language = language;
    const ads = await Ad.findAll({ where: filter, limit: Number(limit), offset: (page-1)*limit, order: [['createdAt','DESC']] });
    res.json(ads.map(a => ({ ...a.toJSON(), idUlid: a.ulid })));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateAd = async (req, res) => {
  try {
    const { id } = req.params;
    const ad = await Ad.findByPk(id);
    if (!ad) return res.status(404).json({ error: 'Ad not found' });
    const brand = await Brand.findOne({ where: { id: ad.brandId } });
    if (!brand) return res.status(404).json({ error: 'Brand not found' });
    const isOwner = brand.userId === req.user.id;
    const isPrMember = !isOwner
      ? await BrandMember.findOne({ where: { brandId: brand.id, userId: req.user.id, memberRole: 'pr' } })
      : null;
    if (!isOwner && !isPrMember) return res.status(403).json({ error: 'Forbidden' });
    const allowed = ['title','description','targetStates','language','payPerInfluencer','categories','deliverables','briefUrl','mediaRefs','timeline','budget'];
    const updates: any = {};
    for (const key of allowed) if (key in req.body) updates[key] = req.body[key];
    updates.updatedByUserId = req.user.id;
    await ad.update(updates);
    res.json({ ...ad.toJSON(), idUlid: ad.ulid });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Ads feed with filters and pagination
exports.feed = async (req, res) => {
  try {
    const {
      states,
      categories,
      adTypes,
      languages,
      budgetMin,
      budgetMax,
      brandUlid,
      onlyActive = true,
      limit = 25,
      offset = 0,
    } = req.body || {};

    const where: any = {};
    if (onlyActive) where.status = 'open';

    if (budgetMin != null || budgetMax != null) {
      where.budget = {} as any;
      if (budgetMin != null) where.budget[Op.gte] = Number(budgetMin);
      if (budgetMax != null) where.budget[Op.lte] = Number(budgetMax);
    }

    if (Array.isArray(states) && states.length) where.targetStates = { [Op.overlap]: states };
    if (Array.isArray(categories) && categories.length) where.categories = { [Op.overlap]: categories };
    if (Array.isArray(adTypes) && adTypes.length) where.adTypes = { [Op.overlap]: adTypes };
    if (Array.isArray(languages) && languages.length) where.language = { [Op.in]: languages };
    if (brandUlid) where.brandIdUlid = brandUlid;

    const pageLimit = Math.min(Number(limit) || 25, 100);
    const pageOffset = Number(offset) || 0;

    const { rows, count } = await Ad.findAndCountAll({
      where,
      include: [{ model: Brand, attributes: ['name', 'idUlid'] }],
      order: [['createdAt', 'DESC']],
      limit: pageLimit,
      offset: pageOffset,
    });

    res.json({ total: count, items: rows.map(a => ({ ...a.toJSON(), idUlid: a.ulid })), limit: pageLimit, offset: pageOffset });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.initiatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, currency = 'INR', notes } = req.body;
    if (!amount) return res.status(400).json({ error: 'amount required' });
    const ad = await Ad.findByPk(id);
    if (!ad) return res.status(404).json({ error: 'Ad not found' });
    const brand = await Brand.findOne({ where: { id: ad.brandId } });
    if (!brand) return res.status(404).json({ error: 'Brand not found' });
    const isOwner = brand.userId === req.user.id;
    const isPrMember = !isOwner
      ? await BrandMember.findOne({ where: { brandId: brand.id, userId: req.user.id, memberRole: 'pr' } })
      : null;
    if (!isOwner && !isPrMember) return res.status(403).json({ error: 'Forbidden' });
    const { createOrder } = require('../services/razorpay');
    const order = await createOrder({ amount, currency, notes: { ...(notes||{}), adId: id } });
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.confirmPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature, adId } = req.body;
    if (!orderId || !paymentId || !signature) return res.status(400).json({ error: 'orderId, paymentId, signature required' });
    const { verifySignature } = require('../services/razorpay');
    const valid = verifySignature({ orderId, paymentId, signature });
    if (!valid) return res.status(400).json({ error: 'Invalid signature' });
    const ad = await Ad.findByPk(adId);
    if (!ad) return res.status(404).json({ error: 'Ad not found' });
    // Persist a simple paid flag and transaction reference if model supports
    if (ad.set) {
      ad.budgetPaid = true;
      ad.transactionId = paymentId;
      await ad.save();
    }
    res.json({ success: true, adBudgetPaid: true, transactionId: paymentId });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
