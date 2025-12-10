const { User, Influencer, Brand } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, mpin, role } = req.body;
    const credential = mpin || password;
    if (!credential) return res.status(400).json({ error: 'mpin is required' });
    if (mpin && !/^\d{6}$/.test(mpin)) return res.status(400).json({ error: 'mpin must be 6 digits' });
    const hash = await bcrypt.hash(credential, 10);
    const user = await User.create({ name, email, phone, passwordHash: hash, role });
    if (role === 'influencer') await Influencer.create({ userId: user.id });
    if (role === 'brand') await Brand.create({ userId: user.id, companyName: name });
    res.json({ id: user.id, email: user.email });
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.login = async (req, res) => {
  try {
    const { email, password, mpin } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(mpin || password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ token, role: user.role });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
