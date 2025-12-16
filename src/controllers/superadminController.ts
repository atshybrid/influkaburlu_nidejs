const { User, Influencer, Brand, Ad, Application, Payout, InfluencerKyc } = require('../models');

exports.dashboard = async (req, res) => {
  try {
    const [
      usersTotal,
      influencersTotal,
      brandsTotal,
      adsTotal,
      applicationsTotal,
      payoutsTotal,
      pendingKycTotal,
    ] = await Promise.all([
      User.count(),
      Influencer.count(),
      Brand.count(),
      Ad.count(),
      Application.count(),
      Payout.count(),
      InfluencerKyc ? InfluencerKyc.count({ where: { status: 'pending' } }) : 0,
    ]);

    return res.json({
      ok: true,
      time: new Date().toISOString(),
      counts: {
        usersTotal,
        influencersTotal,
        brandsTotal,
        adsTotal,
        applicationsTotal,
        payoutsTotal,
        pendingKycTotal,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};
