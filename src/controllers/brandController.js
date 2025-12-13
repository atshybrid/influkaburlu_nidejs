const { Ad, Application, Payout, Influencer, Brand } = require('../models');

async function brandDashboard(req, res) {
  try {
    const brandId = req.user && req.user.brandId ? req.user.brandId : null;
    if (!brandId) return res.status(401).json({ error: 'Unauthorized' });

    const [openAds, closedAds] = await Promise.all([
      Ad.count({ where: { brandId, status: 'open' } }),
      Ad.count({ where: { brandId, status: 'closed' } })
    ]);

    const totalAds = openAds + closedAds;

    const applications = await Application.findAll({ where: { brandId } });
    const funnel = {
      applied: applications.filter(a => a.status === 'applied').length,
      shortlisted: applications.filter(a => a.status === 'shortlisted').length,
      assigned: applications.filter(a => a.status === 'assigned').length,
      submitted: applications.filter(a => a.status === 'submitted').length,
      approved: applications.filter(a => a.status === 'approved').length
    };

    const payouts = await Payout.findAll({ where: { brandId } });
    const spend = payouts.reduce((acc, p) => acc + (p.grossAmount || 0), 0);
    const commission = payouts.reduce((acc, p) => acc + (p.commission || 0), 0);
    const netPaid = payouts.reduce((acc, p) => acc + (p.netAmount || 0), 0);

    const topInfluencers = await Application.findAll({
      where: { brandId, status: 'approved' },
      include: [{ model: Influencer, attributes: ['id', 'handle'] }],
      limit: 5
    });

    const timeline = applications
      .map(a => ({ date: a.updatedAt, label: a.status }))
      .sort((x, y) => new Date(y.date) - new Date(x.date))
      .slice(0, 15);

    const notifications = [];
    if (openAds > 0 && funnel.applied === 0) notifications.push({ type: 'nudge', msg: 'Boost visibility: invite influencers to apply.' });
    if (commission > 0) notifications.push({ type: 'finance', msg: 'Commission accrued this month. Review spend breakdown.' });

    return res.json({
      overview: { totalAds, openAds, closedAds },
      spend: { total: spend, commission, netPaid, currency: 'INR' },
      funnel,
      topInfluencers: topInfluencers.map(t => ({ id: t.Influencer?.id, handle: t.Influencer?.handle })),
      timeline,
      notifications
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}

module.exports = { brandDashboard };
