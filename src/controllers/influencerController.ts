const { Influencer, InfluencerPricing, User, Country, State, District, InfluencerPaymentMethod, InfluencerAdMedia, Application, Ad, Brand, Payout, ReferralCommission } = require('../models');
const { Op } = require('sequelize');
const { uploadBuffer } = require('../utils/r2');
const fs = require('fs');
const crypto = require('crypto');
const { slugify } = require('../utils/slugify');
const sendWhatsappReferralInvite = require('../services/sendWhatsappReferralInvite');

const ALLOWED_BADGES = ['Ready', 'Fit', 'Pro', 'Prime', 'Elite'];

function makeReferralCode() {
  const buf = crypto.randomBytes(4); // 8 hex chars
  return buf.toString('hex').toUpperCase();
}

async function ensureReferralCode(infl) {
  if (infl.referralCode) return infl.referralCode;
  for (let i = 0; i < 10; i++) {
    const code = makeReferralCode();
    const exists = await Influencer.findOne({ where: { referralCode: code } });
    if (!exists) {
      infl.referralCode = code;
      await infl.save();
      return code;
    }
  }
  // Fallback (extremely unlikely)
  const code = (makeReferralCode() + makeReferralCode()).slice(0, 12);
  infl.referralCode = code;
  await infl.save();
  return code;
}

const referralInviteRate = new Map();
function rateLimitReferralInvite(key: string) {
  const windowMs = parseInt(process.env.REFERRAL_INVITE_RATE_WINDOW_MS || '600000', 10); // 10 min
  const max = parseInt(process.env.REFERRAL_INVITE_RATE_MAX || '5', 10);
  const now = Date.now();
  const entry = referralInviteRate.get(key);
  if (!entry || now > entry.resetAt) {
    referralInviteRate.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (entry.count >= max) return { allowed: false, retryAfterMs: entry.resetAt - now };
  entry.count += 1;
  return { allowed: true };
}

function buildReferralShareUrl(referralCode: string) {
  const base = (process.env.REFERRAL_INVITE_FRONTEND_URL || process.env.FRONTEND_URL || '').trim();
  if (!base) return null;
  const path = (process.env.REFERRAL_INVITE_PATH || '/referral').trim() || '/referral';
  const sep = path.includes('?') ? '&' : '?';
  const url = base.replace(/\/+$/, '') + (path.startsWith('/') ? path : '/' + path) + `${sep}code=${encodeURIComponent(referralCode)}`;
  return url;
}

exports.getMyReferral = async (req, res) => {
  try {
    const infl = await Influencer.findOne({ where: { userId: req.user.id } });
    if (!infl) return res.status(404).json({ error: 'not found' });

    const code = await ensureReferralCode(infl);

    const totalReferred = await Influencer.count({ where: { referredByInfluencerId: infl.id } });
    const totalEarnedRaw = await ReferralCommission.sum('amount', { where: { referrerInfluencerId: infl.id, status: 'earned' } });
    const totalEarned = Number(totalEarnedRaw || 0);
    const totalPaidRaw = await ReferralCommission.sum('amount', { where: { referrerInfluencerId: infl.id, status: 'paid' } });
    const totalPaid = Number(totalPaidRaw || 0);

    let referredBy = null;
    if (infl.referredByInfluencerId) {
      const ref = await Influencer.findByPk(infl.referredByInfluencerId, { include: [{ model: User, attributes: ['name'] }] });
      if (ref) {
        referredBy = {
          influencerIdUlid: ref.ulid,
          handle: ref.handle || null,
          name: ref.User?.name || null,
        };
      }
    }

    return res.json({
      referralCode: code,
      referredBy,
      referralLinkedAt: infl.referralLinkedAt || null,
      stats: {
        totalReferred,
        totalEarned,
        totalPaid,
      },
      // Useful for showing progress UI on frontend
      completedAdsCount: typeof infl.completedAdsCount === 'number' ? infl.completedAdsCount : Number(infl.completedAdsCount || 0),
      badges: Array.isArray(infl.badges) ? infl.badges : [],
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.applyReferralCode = async (req, res) => {
  try {
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'code_required' });
    if (code.length < 4 || code.length > 32) return res.status(400).json({ error: 'invalid_code' });

    const infl = await Influencer.findOne({ where: { userId: req.user.id } });
    if (!infl) return res.status(404).json({ error: 'not found' });
    if (infl.referredByInfluencerId) {
      return res.status(409).json({ error: 'already_referred' });
    }

    const ref = await Influencer.findOne({ where: { referralCode: code }, include: [{ model: User, attributes: ['name'] }] });
    if (!ref) return res.status(404).json({ error: 'referrer_not_found' });
    if (ref.id === infl.id) return res.status(400).json({ error: 'cannot_refer_self' });

    infl.referredByInfluencerId = ref.id;
    infl.referralLinkedAt = new Date();
    await infl.save();

    return res.json({
      ok: true,
      referredBy: {
        influencerIdUlid: ref.ulid,
        handle: ref.handle || null,
        name: ref.User?.name || null,
      },
      referralLinkedAt: infl.referralLinkedAt,
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.getMyReferralLedger = async (req, res) => {
  try {
    const infl = await Influencer.findOne({ where: { userId: req.user.id } });
    if (!infl) return res.status(404).json({ error: 'not found' });

    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);

    const total = await ReferralCommission.count({ where: { referrerInfluencerId: infl.id } });
    const rows = await ReferralCommission.findAll({
      where: { referrerInfluencerId: infl.id },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const sourceIds = Array.from(new Set(rows.map(r => r.sourceInfluencerId).filter(Boolean)));
    const sources = sourceIds.length
      ? await Influencer.findAll({ where: { id: sourceIds }, include: [{ model: User, attributes: ['name'] }] })
      : [];
    const sourceById = new Map(sources.map(s => [s.id, s]));

    const items = rows.map(r => {
      const src: any = sourceById.get(r.sourceInfluencerId) || null;
      return {
        id: r.id,
        amount: Number(r.amount || 0),
        status: r.status,
        payoutId: r.payoutId || null,
        createdAt: r.createdAt,
        sourceInfluencer: src
          ? {
              influencerIdUlid: src.ulid,
              handle: src.handle || null,
              name: src.User?.name || null,
            }
          : null,
      };
    });

    return res.json({ total, limit, offset, items });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

// Influencer: send referral invite via WhatsApp template
exports.sendMyReferralInvite = async (req, res) => {
  try {
    const infl = await Influencer.findOne({ where: { userId: req.user.id }, include: [{ model: User, attributes: ['name'] }] });
    if (!infl) return res.status(404).json({ error: 'not found' });

    const phone = String(req.body?.phone || '').trim();
    const receiverName = req.body?.receiverName != null ? String(req.body.receiverName).trim() : null;
    if (!phone) return res.status(400).json({ error: 'phone_required' });

    const rate = rateLimitReferralInvite(`u:${req.user.id}`);
    if (!rate.allowed) return res.status(429).json({ error: 'too many requests', retryAfterMs: rate.retryAfterMs });

    const referralCode = await ensureReferralCode(infl);
    const referrerName = (infl.User?.name || infl.handle || 'Influ Kaburlu').trim();
    const shareUrl = buildReferralShareUrl(referralCode);

    const result = await sendWhatsappReferralInvite({
      phone,
      receiverName,
      referrerName,
      referralCode,
      shareUrl
    });

    return res.json({
      ok: true,
      referralCode,
      shareUrl,
      whatsapp: result?.data || null
    });
  } catch (err) {
    const msg = err?.response?.data || err?.message || 'send_failed';
    return res.status(502).json({ error: 'whatsapp_send_failed', details: msg });
  }
};

function normalizeBadge(input: any) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const match = ALLOWED_BADGES.find(b => b.toLowerCase() === lower);
  return match || null;
}

function pickBadgeName(infl) {
  const badges = Array.isArray(infl?.badges) ? infl.badges : [];
  const first = badges.find(b => typeof b === 'string' && b.trim()) || null;
  if (first) return first;
  const status = infl?.verificationStatus;
  if (status && status !== 'none') return status;
  return null;
}

// Public landing page: list influencers with basic details + their videos
exports.publicLandingList = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '30', 10) || 30, 1), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);

    const total = await Influencer.count();
    const influencers = await Influencer.findAll({
      include: [{ model: User, attributes: ['name'] }],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const influencerIds = influencers.map(i => i.id);
    const mediaRows = influencerIds.length
      ? await InfluencerAdMedia.findAll({
          where: {
            influencerId: { [Op.in]: influencerIds },
            provider: 'bunny',
          },
          order: [['createdAt', 'DESC']],
        })
      : [];

    const videosByInfluencerId = new Map();
    for (const row of mediaRows) {
      const arr = videosByInfluencerId.get(row.influencerId) || [];
      arr.push(row);
      videosByInfluencerId.set(row.influencerId, arr);
    }

    const items = influencers.map(infl => {
      const userName = infl.User?.name || null;
      const handle = infl.handle || null;
      const handleDisplay = handle ? `@${handle}` : null;
      const badgeName = pickBadgeName(infl);
      const rows = videosByInfluencerId.get(infl.id) || [];
      const videos = rows
        .filter(r => !!r.playbackUrl)
        .map(r => ({
          guid: r.guid,
          playbackUrl: r.playbackUrl,
          thumbnailUrl: r.thumbnailUrl || null,
          status: r.status,
          createdAt: r.createdAt,
        }));

      const best = videos.find(v => v.status === 'ready') || videos[0] || null;

      return {
        idUlid: infl.ulid,
        name: userName,
        handle,
        handleDisplay,
        profilePicUrl: infl.profilePicUrl || null,
        verificationStatus: infl.verificationStatus || 'none',
        badges: Array.isArray(infl.badges) ? infl.badges : [],
        badgeName,
        bestVideo: best,
        videos,
      };
    });

    return res.json({ total, limit, offset, items });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

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
  // Include payment methods (masked sensitive fields)
  try {
    const methods = await InfluencerPaymentMethod.findAll({ where: { influencerId: infl.id }, order: [['isPreferred','DESC'], ['updatedAt','DESC']] });
    const items = methods.map(m => {
      const obj = m.toJSON();
      const num = obj.bankAccountNumber ? String(obj.bankAccountNumber) : null;
      obj.bankAccountNumberMasked = num ? (num.length <= 4 ? '****' + num : '****' + num.slice(-4)) : null;
      const upi = obj.upiId ? String(obj.upiId) : null;
      if (upi) {
        const parts = upi.split('@');
        const name = parts[0] || '';
        const bank = parts[1] || '';
        const maskedName = name.length <= 2 ? name : name[0] + '***' + name.slice(-1);
        obj.upiIdMasked = bank ? maskedName + '@' + bank : maskedName;
      } else {
        obj.upiIdMasked = null;
      }
      delete obj.bankAccountNumber;
      return obj;
    });
    response.paymentMethods = items;
  } catch (_) {}
  res.json(response);
};

exports.dashboard = async (req, res) => {
  const userId = req.user.id;
  try {
    const infl = await Influencer.findOne({ where: { userId } });
    if (!infl) return res.status(404).json({ error: 'not found' });

    // Real aggregates (no mocked/sample data)
    const activeBriefs = await Application.count({ where: { influencerId: infl.id, status: { [Op.ne]: 'paid' } } });
    const pendingApprovals = await Application.count({ where: { influencerId: infl.id, status: 'delivered' } });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const earningsMonthRaw = await Payout.sum('netAmount', { where: { influencerId: infl.id, status: 'completed', createdAt: { [Op.gte]: monthStart } } });
    const earningsMonth = Number(earningsMonthRaw || 0);

    const nextPendingPayout = await Payout.findOne({ where: { influencerId: infl.id, status: 'pending' }, order: [['createdAt', 'ASC']] });
    const nextPayout = nextPendingPayout ? new Date(nextPendingPayout.createdAt).toISOString().slice(0, 10) : null;

    const metrics = {
      activeBriefs,
      pendingApprovals,
      earningsMonth,
      nextPayout
    };

    // Briefs: derived from applications + their ad/brand
    const apps = await Application.findAll({
      where: { influencerId: infl.id },
      include: [{ model: Ad, include: [{ model: Brand, attributes: ['companyName'] }], attributes: ['title', 'deliverableType', 'deadline'] }],
      order: [['createdAt', 'DESC']],
      limit: 20,
    });

    const briefsItems = apps
      .slice(0, 10)
      .map(a => {
        const ad = a.Ad;
        const brand = ad?.Brand;
        const deadlineIso = ad?.deadline ? new Date(ad.deadline).toISOString().slice(0, 10) : null;
        return {
          campaign: brand?.companyName || ad?.title || null,
          type: ad?.deliverableType || null,
          due: deadlineIso,
          status: a.status || null
        };
      });

    // Calendar: 14-day lookahead; hasTask if any ad deadline hits that day
    const deadlineSet = new Set(
      apps
        .map(a => a.Ad?.deadline)
        .filter(Boolean)
        .map(d => new Date(d).toISOString().slice(0, 10))
    );
    const today = new Date();
    const days = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      return { date: iso, hasTask: deadlineSet.has(iso) };
    });

    // Payout history: latest completed payouts
    const payoutRows = await Payout.findAll({ where: { influencerId: infl.id, status: 'completed' }, order: [['createdAt', 'DESC']], limit: 12 });
    const payoutHistory = payoutRows.slice(0, 6).map(p => {
      const d = new Date(p.createdAt);
      const month = d.toLocaleString('en-US', { month: 'short' });
      return {
        month,
        amount: Number(p.netAmount || 0),
        status: 'Paid'
      };
    });

    const payouts = {
      history: payoutHistory,
      nextPayout
    };

    res.json({
      influencer: {
        // Note: JWT `id` is the User id; Influencer has its own primary key id.
        id: infl.id,
        influencerId: infl.id,
        userId: infl.userId,
        idUlid: infl.ulid,
        ulid: infl.ulid,
        handle: infl.handle,
        verificationStatus: infl.verificationStatus,
        badges: infl.badges || []
      },
      metrics,
      calendar: { days },
      briefs: { items: briefsItems },
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

  // Slug handling (SEO)
  if (body.slug != null) {
    const s = slugify(body.slug);
    if (!s) return res.status(400).json({ error: 'invalid_slug' });
    body.slug = s;
  }

  Object.assign(infl, body);

  // If slug not provided but handle exists, auto-generate once.
  if (!infl.slug && infl.handle) {
    infl.slug = slugify(String(infl.handle).replace(/^@/, ''));
  }

  await infl.save();
  res.json({ ...infl.toJSON(), idUlid: infl.ulid });
};

// Admin can assign verification/badges to any influencer
exports.assignBadge = async (req, res) => {
  const { id } = req.params;
  const { verificationStatus, badges } = req.body;

  const infl = /^\d+$/.test(String(id))
    ? await Influencer.findByPk(id)
    : await Influencer.findOne({ where: { ulid: String(id) } });

  if (!infl) return res.status(404).json({ error: 'not found' });
  if (verificationStatus) infl.verificationStatus = verificationStatus;

  if (Array.isArray(badges)) {
    const normalized = badges
      .map(normalizeBadge)
      .filter(Boolean);

    // If client provided non-empty array but none valid => invalid
    if (badges.length > 0 && normalized.length === 0) {
      return res.status(400).json({
        error: 'invalid_badge',
        message: 'Badges must be one of the allowed values',
        allowed: ALLOWED_BADGES,
      });
    }

    // If any invalid values exist, reject (helps clients catch typos)
    const invalid = badges.filter(b => normalizeBadge(b) === null);
    if (invalid.length > 0) {
      return res.status(400).json({
        error: 'invalid_badge',
        message: 'Badges must be one of the allowed values',
        invalid,
        allowed: ALLOWED_BADGES,
      });
    }

    infl.badges = Array.from(new Set(normalized));
  }
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
