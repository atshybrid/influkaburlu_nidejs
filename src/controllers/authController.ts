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
const db = require('../models');
const { User, Influencer, Brand, OtpRequest, RefreshToken, InfluencerKyc, InfluencerPaymentMethod } = db;
const { Op } = require('sequelize');

let _influencerUlidColumnKnown: null | boolean = null;
async function influencerTableHasUlidColumn() {
  if (_influencerUlidColumnKnown !== null) return _influencerUlidColumnKnown;
  try {
    const qi = db.sequelize.getQueryInterface();
    let tableName = 'Influencers';
    try {
      await qi.describeTable('Influencers');
    } catch (err1) {
      await qi.describeTable('influencers');
      tableName = 'influencers';
    }
    const table = await qi.describeTable(tableName);
    _influencerUlidColumnKnown = Object.prototype.hasOwnProperty.call(table, 'ulid');
  } catch (_) {
    // If we can't introspect, assume it exists (keeps behavior unchanged).
    _influencerUlidColumnKnown = true;
  }
  return _influencerUlidColumnKnown;
}

async function fetchInfluencerRowWithoutUlid(userId: number) {
  const qi = db.sequelize.getQueryInterface();
  let tableName = 'Influencers';
  try {
    await qi.describeTable('Influencers');
  } catch (err1) {
    await qi.describeTable('influencers');
    tableName = 'influencers';
  }
  const qTable = '"' + String(tableName).replace(/"/g, '""') + '"';
  const [rows] = await db.sequelize.query(
    `SELECT "id", "userId", "handle", "profilePicUrl", "verificationStatus" FROM ${qTable} WHERE "userId" = :userId LIMIT 1`,
    { replacements: { userId } }
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return {
    id: rows[0].id,
    userId: rows[0].userId,
    handle: rows[0].handle || null,
    profilePicUrl: rows[0].profilePicUrl || null,
    verificationStatus: rows[0].verificationStatus || 'none',
    ulid: null,
  };
}
function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function maskAccount(num) {
  if (!num) return null;
  const n = String(num);
  return n.length <= 4 ? '****' + n : '****' + n.slice(-4);
}

function maskUpi(id) {
  if (!id) return null;
  const parts = String(id).split('@');
  const name = parts[0] || '';
  const bank = parts[1] || '';
  const maskedName = name.length <= 2 ? name : name[0] + '***' + name.slice(-1);
  return maskedName + (bank ? '@' + bank : '');
}

function isInfluencerKycComplete(kyc) {
  if (!kyc) return false;
  const required = ['fullName', 'dob', 'pan', 'addressLine1', 'postalCode', 'city', 'state', 'country'];
  for (const f of required) {
    const v = kyc[f];
    if (!v || (typeof v === 'string' && !v.trim())) return false;
  }
  if (!kyc.consentTs) return false;
  return true;
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
  let infl = null;
  if (user.role === 'influencer') {
    // If DB schema is behind (missing Influencers.ulid), avoid Sequelize model queries entirely.
    if (!(await influencerTableHasUlidColumn())) {
      infl = await fetchInfluencerRowWithoutUlid(user.id);
    }
    try {
      if (!infl) infl = await Influencer.findOne({ where: { userId: user.id } });
    } catch (e) {
      const msg = String(e?.message || '');
      if (/column\s+"ulid"\s+does\s+not\s+exist/i.test(msg) && typeof db.ensureInfluencerUlidColumn === 'function') {
        try {
          await db.ensureInfluencerUlidColumn();
          infl = await Influencer.findOne({ where: { userId: user.id } });
        } catch (_) {
          // If the DB user has no ALTER permissions (or we're pointed at a different DB),
          // don't hard-fail login. Fall back to a raw query that doesn't reference ulid.
          try {
            infl = await fetchInfluencerRowWithoutUlid(user.id);
          } catch (_) {}
        }
      }
      if (!infl) throw e;
    }
  }

  let influencerSummary = null;
  if (infl) {
    const profilePicUrl = infl.profilePicUrl || null;

    const kycRow = await InfluencerKyc.findOne({ where: { influencerId: infl.id } });
    const kycObj = kycRow ? kycRow.toJSON() : null;
    const kycComplete = isInfluencerKycComplete(kycObj);
    const kycStatus = kycObj?.status || 'none';

    const methods = await InfluencerPaymentMethod.findAll({ where: { influencerId: infl.id }, order: [['isPreferred', 'DESC'], ['updatedAt', 'DESC']] });
    const hasPaymentMethod = methods.length > 0;
    const preferred = methods.find(m => m.isPreferred) || methods[0] || null;
    const preferredObj = preferred ? preferred.toJSON() : null;
    const paymentStatus = hasPaymentMethod ? (preferredObj?.status || 'unverified') : 'none';
    const paymentType = preferredObj?.type || null;
    const paymentIsVerified = paymentStatus === 'verified';

    influencerSummary = {
      id: infl.id,
      ulid: infl.ulid,
      handle: infl.handle || null,
      profilePicUrl,
      hasProfilePic: Boolean(profilePicUrl),
      verificationStatus: infl.verificationStatus || 'none',
      kyc: {
        status: kycStatus,
        isComplete: kycComplete,
        askKyc: !kycComplete
      },
      payment: {
        status: paymentStatus,
        type: paymentType,
        hasMethod: hasPaymentMethod,
        isVerified: paymentIsVerified,
        isPreferredSet: Boolean(preferredObj?.isPreferred),
        bankAccountNumberMasked: maskAccount(preferredObj?.bankAccountNumber),
        upiIdMasked: maskUpi(preferredObj?.upiId)
      }
    };
  }
  return {
    // Prefer `accessToken` as the canonical field, keep `token` for backward compatibility.
    accessToken,
    token: accessToken,
    expiresIn,
    expiresAt: accessExpiresAt,
    refreshToken: rawRefresh,
    refreshExpiresAt: refreshExpiresAt.toISOString(),
    user: {
      id: user.id,
      role: user.role,
      name: user.name || null,
      email: user.email || null,
      phone: user.phone || null,
      influencer: influencerSummary
    }
  };
}
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const sendWhatsappOtp = require('../services/sendWhatsappOtp');

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

async function verifyGoogleIdToken(idToken: string) {
  const audiences = getGoogleAudiences();
  if (audiences.length === 0) {
    const err: any = new Error('google_auth_not_configured');
    err.code = 'google_auth_not_configured';
    throw err;
  }
  const ticket = await getGoogleClient().verifyIdToken({ idToken, audience: audiences });
  const payload = ticket.getPayload();
  if (!payload) {
    const err: any = new Error('invalid_google_token');
    err.code = 'invalid_google_token';
    throw err;
  }
  const sub = payload.sub;
  const email = payload.email;
  const emailVerified = payload.email_verified;
  const name = payload.name;
  const picture = payload.picture;
  if (!sub || !email) {
    const err: any = new Error('invalid_google_token');
    err.code = 'invalid_google_token';
    throw err;
  }
  if (emailVerified === false) {
    const err: any = new Error('google_email_not_verified');
    err.code = 'google_email_not_verified';
    throw err;
  }
  return { sub, email, emailVerified, name, picture };
}

function signGoogleLinkToken(payload: { sub: string; email: string; name?: string | null; picture?: string | null }) {
  const secret = process.env.JWT_SECRET || 'secret';
  return jwt.sign(
    {
      t: 'google_link',
      sub: payload.sub,
      email: payload.email,
      name: payload.name || null,
      picture: payload.picture || null
    },
    secret,
    { expiresIn: '10m' }
  );
}

function verifyGoogleLinkToken(token: string) {
  const secret = process.env.JWT_SECRET || 'secret';
  const decoded: any = jwt.verify(token, secret);
  if (!decoded || (decoded.t !== 'google_link' && decoded.t !== 'google_signup') || !decoded.sub || !decoded.email) {
    const err: any = new Error('invalid_link_token');
    err.code = 'invalid_link_token';
    throw err;
  }
  return decoded;
}

async function createOtpForPhone(phone: string, userId?: number | null) {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const requestId = 'req_' + crypto.randomBytes(8).toString('hex');
  const ttlMinutes = parseInt(process.env.OTP_TTL_MINUTES || '10', 10);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  await OtpRequest.create({
    userId: userId ?? null,
    phone,
    otp,
    requestId,
    expiresAt,
    used: false
  });
  otpStore.set(phone, { otp, expiresAt: expiresAt.getTime(), requestId });
  return { otp, requestId, expiresAt };
}

async function rateLimitOtpRequest(phone: string) {
  const windowMin = parseInt(process.env.OTP_REQUEST_RATE_WINDOW_MINUTES || '10', 10);
  const max = parseInt(process.env.OTP_REQUEST_RATE_MAX || '3', 10);
  if (!windowMin || !max) return { allowed: true };
  const since = new Date(Date.now() - windowMin * 60 * 1000);
  const count = await OtpRequest.count({ where: { phone: String(phone), createdAt: { [Op.gte]: since } } });
  if (count >= max) {
    return { allowed: false, retryAfterSec: windowMin * 60 };
  }
  return { allowed: true };
}

async function verifyOtpForPhone(params: { phone: string; otp: string; requestId?: string | null }) {
  const { phone, otp, requestId } = params;
  const where: any = { phone, otp, used: false };
  if (requestId) where.requestId = requestId;
  const record = await OtpRequest.findOne({ where, order: [['createdAt', 'DESC']] });
  if (!record) {
    const err: any = new Error('invalid_otp');
    err.code = 'invalid_otp';
    throw err;
  }
  if (new Date() > record.expiresAt) {
    const err: any = new Error('otp_expired');
    err.code = 'otp_expired';
    throw err;
  }
  record.used = true;
  await record.save();
  otpStore.delete(phone);
  return record;
}

function signGoogleSignupToken(payload: { sub: string; email: string; name?: string | null; picture?: string | null }) {
  const secret = process.env.JWT_SECRET || 'secret';
  return jwt.sign(
    {
      t: 'google_signup',
      sub: payload.sub,
      email: payload.email,
      name: payload.name || null,
      picture: payload.picture || null
    },
    secret,
    { expiresIn: '10m' }
  );
}

function verifyGoogleSignupToken(token: string) {
  const secret = process.env.JWT_SECRET || 'secret';
  const decoded: any = jwt.verify(token, secret);
  if (!decoded || decoded.t !== 'google_signup' || !decoded.sub || !decoded.email) {
    const err: any = new Error('invalid_signup_token');
    err.code = 'invalid_signup_token';
    throw err;
  }
  return decoded;
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
  } catch (err) {
    // Ensure errors are visible in server logs (Swagger UI otherwise just shows 500).
    // eslint-disable-next-line no-console
    console.error('loginMobile error:', err?.stack || err);
    res.status(500).json({ error: err?.message || 'server_error' });
  }
};

exports.googleAuth = async (req, res) => {
  try {
    const { idToken, role, phone } = req.body || {};
    if (!idToken) return res.status(400).json({ error: 'idToken is required' });
    const { sub, email, emailVerified, name, picture } = await verifyGoogleIdToken(idToken);

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
    if (err?.code === 'google_auth_not_configured') {
      return res.status(500).json({ error: 'google_auth_not_configured', details: 'Set GOOGLE_CLIENT_IDS (comma-separated) or GOOGLE_CLIENT_ID' });
    }
    const msg = err?.message || 'Google auth failed';
    return res.status(401).json({ error: 'google_auth_failed', details: msg });
  }
};

// New: Step 1 for the "Google + Mobile" flow.
// - If googleSub is already linked -> returns session
// - Else returns linkRequired=true + linkToken so the client can verify phone OTP and call /api/auth/google/link
exports.googleStart = async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ error: 'idToken is required' });
    const { sub, email, name, picture } = await verifyGoogleIdToken(idToken);

    const user = await User.findOne({ where: { googleSub: sub } });
    if (user) {
      const session = await issueSession(user);
      return res.json({ linkRequired: false, session });
    }

    const linkToken = signGoogleLinkToken({ sub, email, name: name || null, picture: picture || null });
    return res.json({
      linkRequired: true,
      linkToken,
      profile: { email, name: name || null, picture: picture || null }
    });
  } catch (err) {
    if (err?.code === 'google_auth_not_configured') {
      return res.status(500).json({ error: 'google_auth_not_configured', details: 'Set GOOGLE_CLIENT_IDS (comma-separated) or GOOGLE_CLIENT_ID' });
    }
    const msg = err?.message || 'Google start failed';
    return res.status(401).json({ error: 'google_auth_failed', details: msg });
  }
};

// New: Step 2 for the "Google + Mobile" flow.
// Requires OTP verification for the phone before linking/creating.
exports.googleLink = async (req, res) => {
  try {
    const { linkToken, phone, role, requestId } = req.body || {};
    const otp = req.body?.otp ?? req.body?.code;
    if (!linkToken) return res.status(400).json({ error: 'linkToken is required' });
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    const requireOtp = (process.env.GOOGLE_LINK_REQUIRE_OTP || 'true').toLowerCase() !== 'false';
    if (requireOtp && !otp) return res.status(400).json({ error: 'otp/code is required' });

    const decoded = verifyGoogleLinkToken(String(linkToken));
    const sub = decoded.sub;
    const email = decoded.email;
    const name = decoded.name || null;
    const picture = decoded.picture || null;

    // If this Google is already linked, just login.
    const byGoogle = await User.findOne({ where: { googleSub: sub } });
    if (byGoogle) {
      const session = await issueSession(byGoogle);
      return res.json(session);
    }

    if (requireOtp) {
      await verifyOtpForPhone({ phone: String(phone), otp: String(otp), requestId: requestId ? String(requestId) : null });
    }

    // Link to existing user by phone, else create new.
    let user = await User.findOne({ where: { phone: String(phone) } });
    if (user) {
      const updates: any = {};
      if (!user.googleSub) updates.googleSub = sub;
      if (!user.authProvider) updates.authProvider = 'google';
      if (!user.googlePictureUrl && picture) updates.googlePictureUrl = picture;
      if (!user.email && email) {
        const emailOwner = await User.findOne({ where: { email } });
        if (!emailOwner) updates.email = email;
      }
      if (!user.name && name) updates.name = name;
      if (Object.keys(updates).length > 0) await user.update(updates);
      const session = await issueSession(user);
      return res.json(session);
    }

    if (!role) return res.status(400).json({ error: 'role is required for first signup' });
    if (!['influencer', 'brand', 'admin'].includes(String(role))) {
      return res.status(400).json({ error: 'invalid role' });
    }

    const randomSecret = crypto.randomBytes(32).toString('hex');
    const hash = await bcrypt.hash(randomSecret, 10);
    user = await User.create({
      name,
      email,
      phone: String(phone),
      passwordHash: hash,
      role,
      authProvider: 'google',
      googleSub: sub,
      googlePictureUrl: picture,
      emailVerified: true
    });
    if (role === 'influencer') await Influencer.create({ userId: user.id });
    if (role === 'brand') await Brand.create({ userId: user.id, companyName: name || 'Brand' });

    const session = await issueSession(user);
    return res.json(session);
  } catch (err) {
    if (err?.code === 'invalid_link_token' || /jwt/i.test(String(err?.message || ''))) {
      return res.status(400).json({ error: 'invalid_link_token' });
    }
    if (err?.code === 'invalid_otp') return res.status(400).json({ error: 'invalid_otp' });
    if (err?.code === 'otp_expired') return res.status(400).json({ error: 'otp_expired' });
    const msg = err?.message || 'Google link failed';
    return res.status(400).json({ error: 'google_link_failed', details: msg });
  }
};

// Step 1: verify Google ID token and tell client whether signup is required.
exports.googleInit = async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ error: 'idToken is required' });
    const { sub, email, name, picture } = await verifyGoogleIdToken(idToken);

    let user = await User.findOne({ where: { googleSub: sub } });
    if (!user) user = await User.findOne({ where: { email } });

    if (user) {
      // Link Google identity if needed
      const updates: any = {};
      if (!user.googleSub || user.googleSub !== sub) updates.googleSub = sub;
      if (!user.authProvider) updates.authProvider = 'google';
      if (!user.googlePictureUrl && picture) updates.googlePictureUrl = picture;
      if (Object.keys(updates).length > 0) await user.update(updates);

      const session = await issueSession(user);
      return res.json({ signupRequired: false, session });
    }

    const signupToken = signGoogleSignupToken({ sub, email, name: name || null, picture: picture || null });
    return res.json({
      signupRequired: true,
      signupToken,
      profile: { email, name: name || null, picture: picture || null }
    });
  } catch (err) {
    if (err?.code === 'google_auth_not_configured') {
      return res.status(500).json({ error: 'google_auth_not_configured', details: 'Set GOOGLE_CLIENT_IDS (comma-separated) or GOOGLE_CLIENT_ID' });
    }
    const msg = err?.message || 'Google init failed';
    return res.status(401).json({ error: 'google_auth_failed', details: msg });
  }
};

// Step 2: complete signup for first-time Google users (collect role + phone).
exports.googleComplete = async (req, res) => {
  try {
    const { signupToken, role, phone } = req.body || {};
    if (!signupToken) return res.status(400).json({ error: 'signupToken is required' });
    if (!role) return res.status(400).json({ error: 'role is required' });
    if (!phone) return res.status(400).json({ error: 'phone is required' });
    if (!['influencer', 'brand', 'admin'].includes(String(role))) {
      return res.status(400).json({ error: 'invalid role' });
    }

    const decoded = verifyGoogleSignupToken(String(signupToken));
    const sub = decoded.sub;
    const email = decoded.email;
    const name = decoded.name || null;
    const picture = decoded.picture || null;

    let user = await User.findOne({ where: { googleSub: sub } });
    if (!user) user = await User.findOne({ where: { email } });

    if (!user) {
      const randomSecret = crypto.randomBytes(32).toString('hex');
      const hash = await bcrypt.hash(randomSecret, 10);
      user = await User.create({
        name,
        email,
        phone,
        passwordHash: hash,
        role,
        authProvider: 'google',
        googleSub: sub,
        googlePictureUrl: picture,
        emailVerified: true
      });
      if (role === 'influencer') await Influencer.create({ userId: user.id });
      if (role === 'brand') await Brand.create({ userId: user.id, companyName: name || 'Brand' });
    } else {
      // If account was created by another flow, just link Google + ensure phone.
      const updates: any = {};
      if (!user.googleSub || user.googleSub !== sub) updates.googleSub = sub;
      if (!user.authProvider) updates.authProvider = 'google';
      if (!user.googlePictureUrl && picture) updates.googlePictureUrl = picture;
      if (!user.phone && phone) updates.phone = phone;
      if (Object.keys(updates).length > 0) await user.update(updates);
    }

    const session = await issueSession(user);
    return res.json(session);
  } catch (err) {
    if (err?.code === 'invalid_signup_token' || /jwt/i.test(String(err?.message || ''))) {
      return res.status(400).json({ error: 'invalid_signup_token' });
    }
    const msg = err?.message || 'Google complete failed';
    return res.status(400).json({ error: 'google_complete_failed', details: msg });
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
    // Basic abuse protection (DB-backed; defaults to 3 requests / 10 minutes).
    const rate = await rateLimitOtpRequest(String(phone));
    if (!rate.allowed) return res.status(429).json({ error: 'too many requests', retryAfterSec: rate.retryAfterSec });

    const { otp, requestId } = await createOtpForPhone(String(phone), user.id);

    // Send OTP via WhatsApp template when configured.
    const shouldSendWhatsapp = (process.env.OTP_DELIVERY_CHANNEL || 'whatsapp').toLowerCase() === 'whatsapp';
    if (shouldSendWhatsapp && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) {
      try {
        await sendWhatsappOtp({ phone: String(phone), otp: String(otp), purpose: 'mpin_reset' });
      } catch (e) {
        if ((process.env.NODE_ENV || 'development') === 'production') {
          // eslint-disable-next-line no-console
          console.error('WhatsApp OTP send failed (production):', e?.code || e?.message || e, e?.provider || '');
          return res.status(502).json({ error: 'otp_send_failed' });
        }
        console.warn('WhatsApp OTP send failed (non-production):', e?.message || e);
      }
    }

    const payload: any = { requestId };
    if ((process.env.NODE_ENV || 'development') !== 'production') payload.otp = otp;
    res.json(payload);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Generic OTP request for phone verification (signup/linking)
exports.requestOtp = async (req, res) => {
  try {
    const { phone, purpose, email } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    // Basic abuse protection (DB-backed; defaults to 3 requests / 10 minutes).
    const rate = await rateLimitOtpRequest(String(phone));
    if (!rate.allowed) return res.status(429).json({ error: 'too many requests', retryAfterSec: rate.retryAfterSec });

    const user = await User.findOne({ where: { phone: String(phone) } });
    const { otp, requestId } = await createOtpForPhone(String(phone), user?.id ?? null);

    // Send OTP via WhatsApp template when configured.
    // - Production: fail fast if provider call fails (so the client can retry)
    // - Non-production: do not block the response (OTP is returned for dev testing anyway)
    const shouldSendWhatsapp = (process.env.OTP_DELIVERY_CHANNEL || 'whatsapp').toLowerCase() === 'whatsapp';
    if (shouldSendWhatsapp && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) {
      try {
        await sendWhatsappOtp({
          phone: String(phone),
          otp: String(otp),
          purpose: purpose ? String(purpose) : 'google_link',
          email: email ? String(email) : null
        });
      } catch (e) {
        if ((process.env.NODE_ENV || 'development') === 'production') {
          // eslint-disable-next-line no-console
          console.error('WhatsApp OTP send failed (production):', e?.code || e?.message || e, e?.provider || '');
          return res.status(502).json({ error: 'otp_send_failed' });
        }
        console.warn('WhatsApp OTP send failed (non-production):', e?.message || e);
      }
    }

    const payload: any = { requestId };
    // Do not leak OTP in production.
    if ((process.env.NODE_ENV || 'development') !== 'production') payload.otp = otp;
    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Generic OTP verify (optional helper endpoint)
exports.verifyOtp = async (req, res) => {
  try {
    const { phone, requestId } = req.body || {};
    const otp = req.body?.otp ?? req.body?.code;
    if (!phone || !otp) return res.status(400).json({ error: 'phone and otp/code are required' });
    await verifyOtpForPhone({ phone: String(phone), otp: String(otp), requestId: requestId ? String(requestId) : null });
    return res.json({ success: true });
  } catch (err) {
    if (err?.code === 'invalid_otp') return res.status(400).json({ error: 'invalid_otp' });
    if (err?.code === 'otp_expired') return res.status(400).json({ error: 'otp_expired' });
    return res.status(500).json({ error: err.message });
  }
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
