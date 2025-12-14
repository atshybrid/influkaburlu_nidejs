const { Influencer, InfluencerKyc } = require('../models');

function maskPan(pan) {
  if (!pan) return null;
  return pan.replace(/.(?=.{4})/g, '*');
}

function isKycComplete(kyc) {
  if (!kyc) return false;
  const required = ['fullName','dob','pan','addressLine1','postalCode','city','state','country'];
  for (const f of required) {
    const v = kyc[f];
    if (!v || (typeof v === 'string' && !v.trim())) return false;
  }
  if (!kyc.consentTs) return false;
  return true;
}

exports.getMe = async (req, res) => {
  try {
    const infl = await Influencer.findOne({ where: { userId: req.user.id } });
    if (!infl) return res.status(404).json({ error: 'not found' });
    const kyc = await InfluencerKyc.findOne({ where: { influencerId: infl.id } });
    if (!kyc) return res.json({ status: 'none', kyc: {}, meta: { isComplete: false, askKyc: true } });
    const data = kyc.toJSON();
    const complete = isKycComplete(data);
    data.pan = maskPan(data.pan);
    res.json({ status: data.status, kyc: data, meta: { isComplete: complete, askKyc: !complete } });
  } catch (err) {
    res.status(500).json({ error: 'server_error' });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const infl = await Influencer.findOne({ where: { userId: req.user.id } });
    if (!infl) return res.status(404).json({ error: 'not found' });
    const body = req.body || {};
    const defaults = { influencerId: infl.id };
    const [kyc, created] = await InfluencerKyc.findOrCreate({ where: { influencerId: infl.id }, defaults });
    const originalStatus = kyc.status || 'pending';
    const fields = ['fullName','dob','pan','addressLine1','addressLine2','postalCode','city','state','country','documents'];
    for (const f of fields) {
      if (body[f] !== undefined) {
        // If verified, do not override PAN
        if (originalStatus === 'verified' && f === 'pan') continue;
        kyc[f] = body[f];
      }
    }
    if (typeof body.consent === 'boolean' && body.consent) kyc.consentTs = new Date();
    // Preserve verified status; otherwise keep or set to pending
    kyc.status = originalStatus === 'verified' ? 'verified' : 'pending';
    await kyc.save();
    const out = kyc.toJSON();
    const complete = isKycComplete(out);
    out.pan = maskPan(out.pan);
    res.json({ status: out.status, kyc: out, meta: { isComplete: complete, askKyc: !complete } });
  } catch (err) {
    res.status(500).json({ error: 'server_error' });
  }
};
