const { Application, Ad, Influencer, Payout, ReferralCommission, BrandMember, PrCommission } = require('../models');

function computeTierBadgeFromCompletedAdsCount(count) {
  const n = Math.max(parseInt(count || 0, 10) || 0, 0);
  if (n >= 50) return 'Elite';
  if (n >= 25) return 'Prime';
  if (n >= 10) return 'Pro';
  if (n >= 5) return 'Fit';
  return 'Ready';
}

async function maybeUpdateInfluencerBadgesAndCounts(influencerId) {
  const infl = await Influencer.findByPk(influencerId);
  if (!infl) return null;

  const prevCount = typeof infl.completedAdsCount === 'number' ? infl.completedAdsCount : parseInt(infl.completedAdsCount || '0', 10) || 0;
  const nextCount = prevCount + 1;
  infl.completedAdsCount = nextCount;

  const tier = computeTierBadgeFromCompletedAdsCount(nextCount);
  const badges = Array.isArray(infl.badges) ? infl.badges.filter(b => typeof b === 'string') : [];
  const allowed = new Set(['Ready', 'Fit', 'Pro', 'Prime', 'Elite']);
  const filtered = badges.filter(b => allowed.has(b));
  if (!filtered.includes(tier)) {
    // Keep other allowed badges, but ensure tier is present and first.
    infl.badges = [tier, ...filtered.filter(b => b !== tier)];
  } else {
    infl.badges = [tier, ...filtered.filter(b => b !== tier)];
  }

  await infl.save();
  return infl;
}

async function maybeCreateReferralCommission({ sourceInfluencerId, payout }) {
  try {
    const source = await Influencer.findByPk(sourceInfluencerId);
    const referrerId = source?.referredByInfluencerId;
    if (!referrerId) return null;

    // Best practice: keep referral reward independent from platform fee.
    // - Default behavior (backward compatible): share of platform commission.
    // - Optional: pay referral from gross (useful when PLATFORM_COMMISSION_RATE=0).
    const grossRate = Math.max(Math.min(parseFloat(process.env.REFERRAL_GROSS_RATE || '0') || 0, 1), 0);
    const commissionShareRate = Math.max(
      Math.min(parseFloat(process.env.REFERRAL_COMMISSION_RATE || '0.25') || 0, 1),
      0
    );

    const grossAmount = parseFloat(payout?.grossAmount || 0);
    const platformCommission = parseFloat(payout?.commission || 0);

    const amount = +(grossRate > 0
      ? (grossAmount * grossRate)
      : (platformCommission * commissionShareRate)
    ).toFixed(2);
    if (!amount || amount <= 0) return null;

    // Avoid duplicates if endpoint retried
    const existing = await ReferralCommission.findOne({ where: { referrerInfluencerId: referrerId, payoutId: payout.id } });
    if (existing) return existing;

    const row = await ReferralCommission.create({
      referrerInfluencerId: referrerId,
      sourceInfluencerId,
      payoutId: payout.id,
      amount,
      status: 'earned',
      meta: grossRate > 0
        ? { rate: grossRate, base: 'gross' }
        : { rate: commissionShareRate, base: 'platform_commission' },
    });
    return row;
  } catch (_) {
    return null;
  }
}

async function maybeCreatePrCommission({ ad, app, payout }) {
  try {
    const brandId = ad?.brandId;
    if (!brandId) return null;

    const primary = await BrandMember.findOne({ where: { brandId, memberRole: 'pr', isPrimary: true } });
    const member = primary || (await BrandMember.findOne({ where: { brandId, memberRole: 'pr' } }));
    const prUserId = member?.userId;
    if (!prUserId) return null;

    const grossRate = Math.max(Math.min(parseFloat(process.env.PR_GROSS_RATE || '0') || 0, 1), 0);
    const commissionShareRate = Math.max(Math.min(parseFloat(process.env.PR_COMMISSION_RATE || '0.10') || 0, 1), 0);

    const grossAmount = parseFloat(payout?.grossAmount || 0);
    const platformCommission = parseFloat(payout?.commission || 0);

    const amount = +(grossRate > 0
      ? (grossAmount * grossRate)
      : (platformCommission * commissionShareRate)
    ).toFixed(2);
    if (!amount || amount <= 0) return null;

    const existing = await PrCommission.findOne({ where: { prUserId, payoutId: payout.id } });
    if (existing) return existing;

    const row = await PrCommission.create({
      prUserId,
      brandId,
      adId: ad.id || null,
      applicationId: app.id || null,
      payoutId: payout.id,
      amount,
      status: 'earned',
      meta: {
        ...(grossRate > 0
          ? { rate: grossRate, base: 'gross' }
          : { rate: commissionShareRate, base: 'platform_commission' }),
        source: 'payout_completed',
      },
    });
    return row;
  } catch (_) {
    return null;
  }
}

exports.applyToAd = async (req, res) => {
  try {
    const adId = req.params.adId;
    const infl = await Influencer.findOne({ where: { userId: req.user.id } });
    if (!infl) return res.status(400).json({ error: 'Influencer profile required' });
    const app = await Application.create({ adId, influencerId: infl.id, state: req.body.state || (infl.states[0] || ''), applyMessage: req.body.message || '' });
    res.json({ ...app.toJSON(), adIdUlid: (await Ad.findByPk(adId))?.ulid || undefined, influencerIdUlid: infl.ulid });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.submitDeliverable = async (req, res) => {
  try {
    const id = req.params.appId;
    const app = await Application.findByPk(id);
    if (!app) return res.status(404).json({ error: 'application not found' });
    app.submission = { creativeUrl: req.body.creativeUrl, submittedAt: new Date() };
    app.status = 'delivered';
    await app.save();
    res.json({ ...app.toJSON(), adIdUlid: (await Ad.findByPk(app.adId))?.ulid || undefined });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.approveAndPayout = async (req, res) => {
  try {
    const id = req.params.appId;
    const app = await Application.findByPk(id, { include: [Ad] });
    if (!app) return res.status(404).json({ error: 'application not found' });
    app.status = 'paid';
    const ad = await Ad.findByPk(app.adId);
    const pay = parseFloat(ad.payPerInfluencer || 0);
    const platformRate = Math.max(Math.min(parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.20') || 0, 1), 0);
    const commission = +(pay * platformRate).toFixed(2);
    const net = +(pay - commission).toFixed(2);
    await app.save();
    const payout = await Payout.create({ influencerId: app.influencerId, grossAmount: pay, commission, netAmount: net, state: app.state, status: 'completed' });
    // Gamification: update completed ads count + badge tier (best-effort)
    try {
      await maybeUpdateInfluencerBadgesAndCounts(app.influencerId);
    } catch (_) {}
    // Referrals: create commission for referrer (best-effort)
    await maybeCreateReferralCommission({ sourceInfluencerId: app.influencerId, payout });
    // PR: commission for assigned PR of the brand (best-effort)
    await maybeCreatePrCommission({ ad, app, payout });
    res.json({ app: { ...app.toJSON(), adIdUlid: ad.ulid }, payout });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
