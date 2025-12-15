// Simple rate limiter for refresh endpoint: { key -> { count, resetAt } }
const refreshRate = new Map();
function rateLimitRefresh(key) {
  const windowMs = parseInt(process.env.REFRESH_RATE_WINDOW_MS || '60000', 10); // 1 min
  const max = parseInt(process.env.REFRESH_RATE_MAX || '10', 10);
  const now = Date.now();
  const entry = refreshRate.get(key);
  if (!entry || now > entry.resetAt) {
    refreshRate.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (entry.count >= max) return { allowed: false, retryAfterMs: entry.resetAt - now };
  entry.count += 1;
  return { allowed: true };
}
const { User, Influencer, Brand, OtpRequest, RefreshToken } = require('../models');
function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateRefreshToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function issueSession(user) {
  const accessTtlSec = parseInt(process.env.ACCESS_TOKEN_TTL_SEC || '900', 10); // 15 minutes
  const refreshTtlDays = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '7', 10);
  const expiresIn = accessTtlSec;
  const accessToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn });
  const accessExpiresAt = new Date(Date.now() + accessTtlSec * 1000).toISOString();
  const rawRefresh = generateRefreshToken();
  const tokenHash = hashToken(rawRefresh);
  const refreshExpiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ userId: user.id, tokenHash, expiresAt: refreshExpiresAt, revoked: false });
  const infl = user.role === 'influencer' ? await Influencer.findOne({ where: { userId: user.id } }) : null;
  return {
    // Prefer `accessToken` as the canonical field, keep `token` for backward compatibility.
    accessToken,
    token: accessToken,
    expiresIn,
    expiresAt: accessExpiresAt,
    refreshToken: rawRefresh,
    refreshExpiresAt: refreshExpiresAt.toISOString(),
    user: { id: user.id, role: user.role, name: user.name, handle: infl?.handle || null }
  };
}
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

// Simple in-memory OTP store: { phone: { otp, expiresAt, requestId } }
const otpStore = new Map();

let googleClient;
function getGoogleClient() {
  if (!googleClient) googleClient = new OAuth2Client();
  return googleClient;
}

function getGoogleAudiences() {
  const raw = (process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || '').trim();
  if (!raw) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, mpin, role } = req.body;
    const credential = mpin || password;
    if (!credential) return res.status(400).json({ error: 'mpin or password is required' });
    if (mpin && !/^\d{6}$/.test(mpin)) return res.status(400).json({ error: 'mpin must be 6 digits' });
    const hash = await bcrypt.hash(credential, 10);
    const user = await User.create({ name, email, phone, passwordHash: hash, role });
    if (role === 'influencer') await Influencer.create({ userId: user.id });
    if (role === 'brand') await Brand.create({ userId: user.id, companyName: name });
    const session = await issueSession(user);
    res.json(session);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.login = async (req, res) => {
  try {
    const { email, phone, password, mpin } = req.body;
    if (!email && !phone) return res.status(400).json({ error: 'email or phone is required' });
    const user = await User.findOne({ where: email ? { email } : { phone } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(mpin || password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const session = await issueSession(user);
    res.json(session);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.loginMobile = async (req, res) => {
  try {
    const { phone, mpin } = req.body;
    if (!phone || !mpin) return res.status(400).json({ error: 'phone and mpin are required' });
    const user = await User.findOne({ where: { phone } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(mpin, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const session = await issueSession(user);
    res.json(session);
      } catch (err) { res.status(500).json({ error: err.message }); }
    };

exports.googleAuth = async (req, res) => {
  try {
    const { idToken, role, phone } = req.body || {};
    if (!idToken) return res.status(400).json({ error: 'idToken is required' });
    const audiences = getGoogleAudiences();
    if (audiences.length === 0) {
      return res.status(500).json({ error: 'google_auth_not_configured', details: 'Set GOOGLE_CLIENT_IDS (comma-separated) or GOOGLE_CLIENT_ID' });
    }

    const ticket = await getGoogleClient().verifyIdToken({ idToken, audience: audiences });
    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ error: 'invalid_google_token' });

    const sub = payload.sub;
    const email = payload.email;
    const emailVerified = payload.email_verified;
    const name = payload.name;
    const picture = payload.picture;

    if (!sub || !email) return res.status(401).json({ error: 'invalid_google_token' });
    if (emailVerified === false) return res.status(401).json({ error: 'google_email_not_verified' });

    let user = await User.findOne({ where: { googleSub: sub } });
    if (!user) user = await User.findOne({ where: { email } });

    if (!user) {
      if (!role) return res.status(400).json({ error: 'role is required for first login' });
      if (!['influencer', 'brand', 'admin'].includes(String(role))) {
        return res.status(400).json({ error: 'invalid role' });
      }
      // Create user with a random secret (Google accounts don't need a local password).
      const randomSecret = crypto.randomBytes(32).toString('hex');
      const hash = await bcrypt.hash(randomSecret, 10);
      user = await User.create({
        name: name || null,
        email,
        phone: phone || null,
        passwordHash: hash,
        role,
        authProvider: 'google',
        googleSub: sub,
        googlePictureUrl: picture || null,
        emailVerified: (emailVerified === true) ? true : null
      });
      if (role === 'influencer') await Influencer.create({ userId: user.id });
      if (role === 'brand') await Brand.create({ userId: user.id, companyName: name || 'Brand' });
    } else {
      // Link Google identity to an existing account by email.
      const updates: any = {};
      if (!user.googleSub || user.googleSub !== sub) updates.googleSub = sub;
      if (!user.authProvider) updates.authProvider = 'google';
      if (!user.googlePictureUrl && picture) updates.googlePictureUrl = picture;
      if (typeof emailVerified === 'boolean' && user.emailVerified == null) updates.emailVerified = emailVerified;
      if (Object.keys(updates).length > 0) {
        await user.update(updates);
      }
    }

    const session = await issueSession(user);
    res.json(session);
  } catch (err) {
    const msg = err?.message || 'Google auth failed';
    return res.status(401).json({ error: 'google_auth_failed', details: msg });
  }
};

    exports.refreshToken = async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
      const rate = rateLimitRefresh(`${ip}`);
      if (!rate.allowed) return res.status(429).json({ error: 'too many requests', retryAfterMs: rate.retryAfterMs });
      const tokenHash = hashToken(refreshToken);
      const record = await RefreshToken.findOne({ where: { tokenHash, revoked: false } });
      if (!record) return res.status(401).json({ error: 'invalid refresh token' });
      if (new Date() > record.expiresAt) return res.status(401).json({ error: 'refresh token expired' });
      const user = await User.findByPk(record.userId);
      if (!user) return res.status(401).json({ error: 'invalid refresh token' });
      // Optionally rotate the refresh token
      const rotate = (process.env.REFRESH_ROTATE === 'true');
      let rawRefresh = refreshToken;
      let refreshExpiresAtIso = record.expiresAt.toISOString();
      if (rotate) {
        record.revoked = true;
        await record.save();
        rawRefresh = generateRefreshToken();
        const newHash = hashToken(rawRefresh);
        const refreshTtlDays = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '7', 10);
        const newExpires = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);
        await RefreshToken.create({ userId: user.id, tokenHash: newHash, expiresAt: newExpires, revoked: false });
        refreshExpiresAtIso = newExpires.toISOString();
      }
      const accessTtlSec = parseInt(process.env.ACCESS_TOKEN_TTL_SEC || '900', 10);
      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: accessTtlSec });
      const expiresAt = new Date(Date.now() + accessTtlSec * 1000).toISOString();
      const infl = user.role === 'influencer' ? await Influencer.findOne({ where: { userId: user.id } }) : null;
      res.json({
        token,
        expiresIn: accessTtlSec,
        expiresAt,
        refreshToken: rawRefresh,
        refreshExpiresAt: refreshExpiresAtIso,
        user: { id: user.id, role: user.role, name: user.name, handle: infl?.handle || null }
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  };

  exports.logout = async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });
      const tokenHash = hashToken(refreshToken);
      const record = await RefreshToken.findOne({ where: { tokenHash } });
      if (record) { record.revoked = true; await record.save(); }
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  };

  exports.logoutAll = async (req, res) => {
    try {
      // Requires Authorization header; user set by auth middleware
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      await RefreshToken.update({ revoked: true }, { where: { userId } });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  };


exports.requestMpinReset = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required' });
    const user = await User.findOne({ where: { phone } });
    if (!user) return res.status(400).json({ error: 'phone not found' });
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
    const ttlMinutes = parseInt(process.env.OTP_TTL_MINUTES || '10', 10);
    const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
    // Persist OTP request
    await OtpRequest.create({
      userId: user.id,
      phone,
      otp,
      requestId,
      expiresAt: new Date(expiresAt),
      used: false
    });
    // Also keep in-memory for quick validation (optional)
    otpStore.set(phone, { otp, expiresAt, requestId });
    // TODO: integrate SMS provider here to send OTP
    res.json({ requestId });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.verifyMpinReset = async (req, res) => {
  try {
    const { phone, newMpin } = req.body;
    const otp = req.body?.otp ?? req.body?.code;
    if (!phone || !otp || !newMpin) {
      return res.status(400).json({ error: 'phone, otp/code, newMpin are required' });
    }
    if (!/^\d{6}$/.test(newMpin)) return res.status(400).json({ error: 'newMpin must be 6 digits' });
    // Prefer DB validation
    const record = await OtpRequest.findOne({
      where: { phone, otp, used: false },
      order: [['createdAt', 'DESC']]
    });
    if (!record) return res.status(400).json({ error: 'invalid otp' });
    if (new Date() > record.expiresAt) {
      return res.status(400).json({ error: 'otp expired' });
    }
    const user = await User.findOne({ where: { phone } });
    if (!user) return res.status(400).json({ error: 'phone not found' });
    user.passwordHash = await bcrypt.hash(newMpin, 10);
    await user.save();
    // Mark OTP as used and clear in-memory
    record.used = true;
    await record.save();
    otpStore.delete(phone);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
