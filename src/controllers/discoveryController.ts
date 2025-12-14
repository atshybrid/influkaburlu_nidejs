const { Influencer, Category, Payout, Sequelize } = require('../models');
const { Op } = require('sequelize');

// Rough scoring based on followers and recent payouts (if available)
function computeScore(infl, payoutAgg) {
  const followers = Number(infl.followers?.instagram || 0) + Number(infl.followers?.youtube || 0);
  const engagement = Number(infl.followers?.engagementRate || 0); // optional
  const payout = Number(payoutAgg?.total || 0);
  return (followers / 1000) + (engagement * 10) + (payout / 10000);
}

exports.searchInfluencers = async (req, res) => {
  try {
    const { budgetMin, budgetMax, categories, language, state, page = 1, limit = 20 } = req.query;
    const where: any = {};
    if (language) where.languages = { [Op.contains]: [language] };
    if (state) where.states = { [Op.contains]: [state] };
    // Category filter via join
    let include: any[] = [];
    if (categories) {
      const list = Array.isArray(categories) ? categories : String(categories).split(',').map(s => s.trim()).filter(Boolean);
      include.push({ model: Category, through: { attributes: [] }, where: { name: { [Op.in]: list } }, required: true });
    }
    const rows = await Influencer.findAll({ where, include, limit: Number(limit), offset: (page - 1) * limit });
    // Optional budget filter: compare against influencer rateCards/adPricing
    const filtered = rows.filter(r => {
      const pricing = r.adPricing || r.rateCards || {};
      const typical = Number(pricing.instagramReel || pricing.instagramPost || 0);
      const min = budgetMin ? Number(budgetMin) : 0;
      const max = budgetMax ? Number(budgetMax) : Infinity;
      return typical >= min && typical <= max;
    });
    // Aggregate payouts (basic): latest 90 days total per influencer
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const payload = [];
    for (const infl of filtered) {
      let payoutAgg = null;
      try {
        payoutAgg = await Payout.findOne({
          where: { influencerId: infl.id, createdAt: { [Op.gte]: since } },
          attributes: [[Sequelize.fn('SUM', Sequelize.col('netAmount')), 'total']]
        });
      } catch (_) {}
      const score = computeScore(infl, payoutAgg?.dataValues);
      payload.push({
        id: infl.id,
        idUlid: infl.ulid,
        handle: infl.handle,
        languages: infl.languages || [],
        states: infl.states || [],
        categories: infl.categories?.map?.(c => c.name) || [],
        pricing: infl.adPricing || infl.rateCards || {},
        score
      });
    }
    payload.sort((a, b) => b.score - a.score);
    res.json(payload);
  } catch (err) { res.status(500).json({ error: err.message }); }
};