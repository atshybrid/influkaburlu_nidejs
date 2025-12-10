const { Ad, Brand } = require('../models');
const { Op } = require('sequelize');

exports.createAd = async (req, res) => {
  try {
    const brand = await Brand.findOne({ where: { userId: req.user.id } });
    if (!brand) return res.status(400).json({ error: 'Brand not found' });
    const body = { ...req.body, brandId: brand.id };
    const ad = await Ad.create(body);
    res.json(ad);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.listAds = async (req, res) => {
  try {
    const { state, language, page=1, limit=20 } = req.query;
    const filter = { status: 'open' };
    if (state) filter.targetStates = { [Op.contains]: [state] };
    if (language) filter.language = language;
    const ads = await Ad.findAll({ where: filter, limit: Number(limit), offset: (page-1)*limit, order: [['createdAt','DESC']] });
    res.json(ads);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
