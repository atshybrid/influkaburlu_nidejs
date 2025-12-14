const { Influencer, ProfilePack } = require('../models');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

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
  const prompt = `Create a concise influencer profile for ${name}, a ${niche} creator from ${city}. Provide:\n- shortBio (<= 160 chars)\n- longBio (3-5 sentences, brand-friendly)\n- jsonLd (schema.org Person with name, description, addressLocality). Return JSON with keys shortBio,longBio,jsonLd.`;
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a helpful assistant that outputs only JSON.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7
  });
  let content = completion.choices?.[0]?.message?.content || '';
  let parsed;
  try { parsed = JSON.parse(content); } catch {
    parsed = { shortBio: `${name} ${niche} creator`, longBio: `${name} is a ${niche} influencer.`, jsonLd: { "@context":"https://schema.org","@type":"Person","name":name,"description":`${name} ${niche}` } };
  }
  return { ...parsed, packId: uuidv4(), ai: true };
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
