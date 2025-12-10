const { Application, Ad, Influencer, Payout } = require('../models');

exports.applyToAd = async (req, res) => {
  try {
    const adId = req.params.adId;
    const infl = await Influencer.findOne({ where: { userId: req.user.id } });
    if (!infl) return res.status(400).json({ error: 'Influencer profile required' });
    const app = await Application.create({ adId, influencerId: infl.id, state: req.body.state || (infl.states[0] || ''), applyMessage: req.body.message || '' });
    res.json(app);
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
    res.json(app);
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
    const commission = +(pay * 0.20).toFixed(2);
    const net = +(pay - commission).toFixed(2);
    await app.save();
    const payout = await Payout.create({ influencerId: app.influencerId, grossAmount: pay, commission, netAmount: net, state: app.state, status: 'completed' });
    res.json({ app, payout });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
