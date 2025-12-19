const { Influencer, ProfilePack, User } = require('../models');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const whatsappPhotoshoot = require('../services/sendWhatsappPhotoshoot');

function nonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function toStringArray(v) {
  if (!Array.isArray(v)) return null;
  const out = v.map((x) => (x == null ? '' : String(x).trim())).filter(Boolean);
  return out.length ? out : null;
}

function toObject(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return v;
}

function shouldUseAdvancedPrompt(body) {
  if (!body || typeof body !== 'object') return false;
  const advancedKeys = [
    'brief',
    'platforms',
    'contentCategory',
    'languages',
    'targetRegion',
    'followers',
    'avgViews',
    'pastBrands',
    'uniqueStrength',
    'collaborationTypes',
  ];
  return advancedKeys.some((k) => body[k] !== undefined && body[k] !== null && String(body[k]).trim() !== '');
}

function normalizeAdvancedInput(body) {
  const out = {
    name: nonEmptyString(body?.name) ? String(body.name).trim() : null,
    niche: nonEmptyString(body?.niche) ? String(body.niche).trim() : null,
    city: nonEmptyString(body?.city) ? String(body.city).trim() : null,
    brief: nonEmptyString(body?.brief) ? String(body.brief).trim() : null,
    platforms: toStringArray(body?.platforms),
    contentCategory: nonEmptyString(body?.contentCategory) ? String(body.contentCategory).trim() : null,
    languages: toStringArray(body?.languages),
    targetRegion: nonEmptyString(body?.targetRegion) ? String(body.targetRegion).trim() : null,
    socialLinks: toObject(body?.socialLinks),
    followers: toObject(body?.followers),
    avgViews: toObject(body?.avgViews),
    pastBrands: toStringArray(body?.pastBrands),
    uniqueStrength: nonEmptyString(body?.uniqueStrength) ? String(body.uniqueStrength).trim() : null,
    collaborationTypes: toStringArray(body?.collaborationTypes),
  };

  // Backwards compatible: allow callers to send niche as contentCategory
  if (!out.contentCategory && out.niche) out.contentCategory = out.niche;
  return out;
}

function buildAdvancedPrompt(input) {
  const name = input.name || 'Creator';
  const niche = input.niche || 'creator';
  const city = input.city || '';

  const payload = {
    name,
    niche,
    city,
    brief: input.brief || null,
    platforms: input.platforms || null,
    contentCategory: input.contentCategory || null,
    languages: input.languages || null,
    targetRegion: input.targetRegion || null,
    socialLinks: input.socialLinks || null,
    followers: input.followers || null,
    avgViews: input.avgViews || null,
    pastBrands: input.pastBrands || null,
    uniqueStrength: input.uniqueStrength || null,
    collaborationTypes: input.collaborationTypes || null,
  };

  return `You are a professional Influencer Branding & Profile Optimization Expert working for a premium influencer–brand collaboration platform (InfluKaburlu).

Generate a complete high-quality influencer profile in a premium, brand-friendly tone.

Rules:
- Output ONLY valid JSON (no markdown)
- No emojis
- No casual language
- SEO-friendly keywords included naturally
- Suitable for mobile app, website profiles, and brand decks

Input (may be partial):
${JSON.stringify(payload, null, 2)}

Return JSON with EXACT keys:
{
  "headline": string,
  "about": string,
  "contentStyleAndExpertise": string,
  "audienceInsights": string,
  "collaborationOpportunities": string[],
  "whyBrandsShouldWorkWithThisInfluencer": string[],
  "pastWorkAndBrandReadiness": string,
  "platformSummary": { "rows": Array<{"platform": string, "followers": string, "avgReach": string, "engagementType": string}> },
  "badgeLevel": "Ready"|"Fit"|"Pro"|"Prime"|"Elite",
  "callToActionForBrands": string,
  "shortBio": string,
  "longBio": string,
  "jsonLd": object
}

Guidance:
- If numeric fields are missing, write "N/A" in platformSummary rows.
- Use the influencer name/handle naturally.
- jsonLd should be schema.org Person with name, description, addressLocality when possible.
`;
}

async function generatePack(data){
  const name = data.name || 'Creator';
  const niche = data.niche || 'creator';
  const city = data.city || '';
  if (!openai) {
    const shortBio = `${name} | ${niche} creator from ${city}. Collaborates with brands for authentic content.`;
    const longBio = `${name} is a ${niche} influencer from ${city}. With a focus on local audiences and engaging storytelling, ${name} creates content that resonates. Services include sponsored posts, reviews, and event hosting.`;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": name,
      "description": longBio,
      "address": { "addressLocality": city }
    };
    return { shortBio, longBio, jsonLd, packId: uuidv4(), ai: false };
  }
  const useAdvanced = shouldUseAdvancedPrompt(data);
  const prompt = useAdvanced
    ? buildAdvancedPrompt(normalizeAdvancedInput(data))
    : `Create a concise influencer profile for ${name}, a ${niche} creator from ${city}. Provide:\n- shortBio (<= 160 chars)\n- longBio (3-5 sentences, brand-friendly)\n- jsonLd (schema.org Person with name, description, addressLocality). Return JSON with keys shortBio,longBio,jsonLd.`;
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a helpful assistant that outputs only JSON.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.6
  });

  const content = completion.choices?.[0]?.message?.content || '';
  let parsed;
  try { parsed = JSON.parse(content); } catch {
    parsed = null;
  }

  if (!parsed || typeof parsed !== 'object') {
    parsed = { shortBio: `${name} ${niche} creator`, longBio: `${name} is a ${niche} influencer.`, jsonLd: { "@context":"https://schema.org","@type":"Person","name":name,"description":`${name} ${niche}` } };
  }

  // If advanced prompt, keep the richer sections under jsonLd.kaburluProfile
  if (useAdvanced) {
    const jsonLd = (parsed.jsonLd && typeof parsed.jsonLd === 'object') ? parsed.jsonLd : { "@context":"https://schema.org","@type":"Person" };
    jsonLd.kaburluProfile = {
      headline: parsed.headline || null,
      about: parsed.about || null,
      contentStyleAndExpertise: parsed.contentStyleAndExpertise || null,
      audienceInsights: parsed.audienceInsights || null,
      collaborationOpportunities: Array.isArray(parsed.collaborationOpportunities) ? parsed.collaborationOpportunities : [],
      whyBrandsShouldWorkWithThisInfluencer: Array.isArray(parsed.whyBrandsShouldWorkWithThisInfluencer) ? parsed.whyBrandsShouldWorkWithThisInfluencer : [],
      pastWorkAndBrandReadiness: parsed.pastWorkAndBrandReadiness || null,
      platformSummary: parsed.platformSummary || null,
      badgeLevel: parsed.badgeLevel || null,
      callToActionForBrands: parsed.callToActionForBrands || null,
    };
    parsed.jsonLd = jsonLd;
  }

  return { ...parsed, packId: uuidv4(), ai: true, advanced: useAdvanced };
}

function buildGenerateFromMePayload({ user, influencer, body }) {
  const socialLinks = (influencer?.socialLinks && typeof influencer.socialLinks === 'object') ? influencer.socialLinks : {};
  const followers = (influencer?.followers && typeof influencer.followers === 'object') ? influencer.followers : {};

  const detectedPlatforms = Object.keys(socialLinks || {}).filter(Boolean);

  const name = nonEmptyString(body?.name)
    ? String(body.name).trim()
    : (user?.name || influencer?.handle || 'Creator');

  const niche = nonEmptyString(body?.niche)
    ? String(body.niche).trim()
    : (nonEmptyString(body?.contentCategory) ? String(body.contentCategory).trim() : 'creator');

  const city = nonEmptyString(body?.city) ? String(body.city).trim() : '';

  return {
    name,
    niche,
    city,
    brief: nonEmptyString(body?.brief) ? String(body.brief).trim() : null,
    platforms: toStringArray(body?.platforms) || (detectedPlatforms.length ? detectedPlatforms : null),
    contentCategory: nonEmptyString(body?.contentCategory) ? String(body.contentCategory).trim() : null,
    languages: toStringArray(body?.languages) || (Array.isArray(influencer?.languages) ? influencer.languages.map((v) => String(v)) : null),
    targetRegion: nonEmptyString(body?.targetRegion) ? String(body.targetRegion).trim() : null,
    socialLinks,
    followers,
    avgViews: toObject(body?.avgViews),
    pastBrands: toStringArray(body?.pastBrands),
    uniqueStrength: nonEmptyString(body?.uniqueStrength) ? String(body.uniqueStrength).trim() : null,
    collaborationTypes: toStringArray(body?.collaborationTypes),
  };
}

exports.generate = async (req, res) => {
  try {
    const data = req.body;
    const pack = await generatePack(data);
    // Persist pack
    let influencerId = null;
    if (req.user && req.user.role === 'influencer') {
      const infl = await Influencer.findOne({ where: { userId: req.user.id } });
      if (infl) { influencerId = infl.id; infl.profilePackUrl = `/api/profile-builder/pack/${pack.packId}`; await infl.save(); }
    }
    await ProfilePack.create({
      packId: pack.packId,
      influencerId,
      name: data.name || 'Creator',
      niche: data.niche || 'creator',
      city: data.city || '',
      shortBio: pack.shortBio,
      longBio: pack.longBio,
      jsonLd: pack.jsonLd,
      images: { avatar: null, gallery: [] },
      ai: !!pack.ai
    });
    res.json(pack);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Generate a profile pack using stored influencer profile data (best for frontend).
// Frontend can send only brief/collaborationTypes/etc and backend auto-fills followers/socialLinks.
exports.generateFromMe = async (req, res) => {
  try {
    const influencer = await Influencer.findOne({ where: { userId: req.user.id } });
    if (!influencer) return res.status(404).json({ error: 'not_found' });

    const user = await User.findOne({ where: { id: req.user.id } });
    const data = buildGenerateFromMePayload({ user, influencer, body: req.body || {} });
    const pack = await generatePack(data);

    influencer.profilePackUrl = `/api/profile-builder/pack/${pack.packId}`;
    await influencer.save();

    await ProfilePack.create({
      packId: pack.packId,
      influencerId: influencer.id,
      name: data.name || 'Creator',
      niche: data.niche || 'creator',
      city: data.city || '',
      shortBio: pack.shortBio,
      longBio: pack.longBio,
      jsonLd: pack.jsonLd,
      images: { avatar: null, gallery: [] },
      ai: !!pack.ai
    });

    return res.json(pack);
  } catch (e) {
    return res.status(500).json({ error: 'server_error', detail: e.message });
  }
};

exports.getPack = async (req, res) => {
  try {
    const row = await ProfilePack.findOne({ where: { packId: req.params.id } });
    if (!row) return res.status(404).json({ error: 'not_found' });
    const p = row.toJSON();
    res.json({
      packId: p.packId,
      name: p.name,
      niche: p.niche,
      city: p.city,
      shortBio: p.shortBio,
      longBio: p.longBio,
      jsonLd: p.jsonLd,
      images: p.images,
      ai: p.ai
    });
  } catch (e) { res.status(500).json({ error: 'server_error' }); }
};

// Generate influencer photos (SEO-friendly) via OpenAI Images
exports.generatePhotos = async (req, res) => {
  try {
    if (!openai) return res.status(400).json({ error: 'openai_not_configured' });
    const { prompt, count = 1 } = req.body || {};
    const safeCount = Math.min(Math.max(parseInt(count || '1', 10), 1), 4);
    const basePrompt = prompt || 'Professional influencer portrait, brand-friendly, high-quality, studio lighting, neutral background';
    const images = [];
    for (let i = 0; i < safeCount; i++) {
      const resp = await openai.images.generate({
        model: 'gpt-image-1',
        prompt: basePrompt,
        size: '1024x1024'
      });
      const b64 = resp.data?.[0]?.b64_json;
      if (b64) images.push({ b64 });
    }
    res.json({ images });
  } catch (e) { res.status(500).json({ error: 'server_error', detail: e.message }); }
};

// Add an existing photo URL to a profile pack with SEO metadata
exports.addPhotoToPack = async (req, res) => {
  try {
    const { id } = req.params;
    const { imageUrl, title, caption, items } = req.body || {};
    const pack = await ProfilePack.findOne({ where: { packId: id } });
    if (!pack) return res.status(404).json({ error: 'not_found' });
    const toAdd = [];
    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        const u = (it && it.imageUrl) || null;
        if (!u) continue;
        const t = (it && it.title) || null;
        const c = (it && it.caption) || null;
        const alt = (t || c || 'influencer photo').trim();
        toAdd.push({
          url: u,
          title: t,
          caption: c,
          alt,
          jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'ImageObject',
            'url': u,
            'caption': c || t || ''
          }
        });
      }
    } else {
      if (!imageUrl) return res.status(400).json({ error: 'imageUrl_required' });
      const alt = (title || caption || 'influencer photo').trim();
      toAdd.push({
        url: imageUrl,
        title: title || null,
        caption: caption || null,
        alt,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'ImageObject',
          'url': imageUrl,
          'caption': caption || title || ''
        }
      });
    }
    const images = pack.images || { avatar: null, gallery: [] };
    images.gallery = Array.isArray(images.gallery) ? images.gallery : [];
    for (const img of toAdd) {
      images.gallery.push(img);
      if (!images.avatar) images.avatar = img.url;
    }
    pack.images = images;
    await pack.save();

    // WhatsApp notification (best-effort)
    try {
      if (whatsappPhotoshoot?.isWhatsAppConfigured?.()) {
        const influencerId = pack.influencerId;
        if (influencerId) {
          const influencer = await Influencer.findByPk(influencerId);
          if (influencer?.userId) {
            const user = await User.findByPk(influencer.userId);
            const phone = user?.phone;
            if (phone) {
              await whatsappPhotoshoot.sendPortfolioUploaded({
                req,
                phone,
                influencerName: user?.name || influencer?.handle || 'Creator',
                packId: pack.packId || id,
                photoCount: toAdd.length,
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('WhatsApp portfolio uploaded send failed:', e?.code || e?.message || e, e?.provider || '');
    }

    res.json({ ok: true, count: toAdd.length, images });
  } catch (e) { res.status(500).json({ error: 'server_error', detail: e.message }); }
};

exports.getPackPhotos = async (req, res) => {
  try {
    const { id } = req.params;
    const pack = await ProfilePack.findOne({ where: { packId: id } });
    if (!pack) return res.status(404).json({ error: 'not_found' });
    const images = pack.images || { avatar: null, gallery: [] };
    res.json(images);
  } catch (e) { res.status(500).json({ error: 'server_error', detail: e.message }); }
};
