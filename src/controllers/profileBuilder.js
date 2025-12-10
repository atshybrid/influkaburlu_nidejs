const { Influencer } = require('../models');
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
    if (req.user && req.user.role === 'influencer') {
      const infl = await Influencer.findOne({ where: { userId: req.user.id } });
      if (infl) { infl.profilePackUrl = `/api/profile-builder/pack/${pack.packId}`; await infl.save(); }
    }
    res.json(pack);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getPack = async (req, res) => {
  res.json({ msg: 'Demo pack content for ' + req.params.id });
};
