const { Influencer, Post } = require('../models');
const { Op } = require('sequelize');

exports.createInfluencerAdPost = async (req, res) => {
  try {
    const { id } = req.params; // numeric id (existing routes use id)
    const infl = await Influencer.findByPk(id);
    if (!infl) return res.status(404).json({ error: 'influencer_not_found' });
    if (req.user.role !== 'admin' && infl.userId !== req.user.id) return res.status(403).json({ error: 'forbidden' });
    const { caption, media = [], categories = [], language, states = [], adId } = req.body;
    const post = await Post.create({ userId: infl.userId, influencerId: infl.id, type: 'external', caption, media, categories, language, states, adId: adId || null });
    res.json({ ...post.toJSON(), idUlid: post.ulid });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.influencerFeed = async (req, res) => {
  try {
    const { id } = req.params; // numeric id
    const infl = await Influencer.findByPk(id);
    if (!infl) return res.status(404).json({ error: 'influencer_not_found' });
    const { category, state, language, page = 1, limit = 20 } = req.query;
    const where = { influencerId: infl.id, status: 'active' };
    if (language) where.language = language;
    if (state) where.states = { [Op.contains]: [state] };
    if (category) where.categories = { [Op.contains]: [category] };
    const rows = await Post.findAll({ where, limit: Number(limit), offset: (page - 1) * limit, order: [['createdAt', 'DESC']] });
    res.json(rows.map(r => ({ ...r.toJSON(), idUlid: r.ulid })));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Public: get all influencer ads/posts related to ads
exports.publicAds = async (req, res) => {
  try {
    const { state, language, category, page = 1, limit = 20 } = req.query;
    const where = { status: 'active' };
    // Include both auto-created ad posts and influencer external posts tied to ads
    where.type = { [Op.in]: ['ad', 'external'] };

    if (language) where.language = language;
    if (state) where.states = { [Op.contains]: [state] };
    if (category) where.categories = { [Op.contains]: [category] };

    const rows = await Post.findAll({
      where,
      limit: Number(limit),
      offset: (page - 1) * limit,
      order: [['createdAt', 'DESC']],
    });

    res.json(rows.map(r => ({ ...r.toJSON(), idUlid: r.ulid })));
  } catch (err) { res.status(500).json({ error: err.message }); }
};