const { InfluencerAdMedia, Post, Influencer, Ad } = require('../models');
const fs = require('fs');
const { Op } = require('sequelize');

// Public: list influencer ad media entries (canonical video records)
exports.listInfluencerAdMedia = async (req, res) => {
  try {
    const {
      status, // created|uploaded|processing|ready
      influencerUlid,
      postUlid,
      adUlid,
      language,
      state,
      category,
      limit = 20,
      page = 1,
    } = req.query;

    const where: any = { provider: 'bunny' };
    if (status) where.status = status;

    const include: any = [
        { model: Post, attributes: ['id', 'ulid', 'caption', 'language', 'categories', 'states', 'type', 'status'], where: {} as any },
        { model: Influencer, attributes: ['id', 'ulid', 'handle'] },
        { model: Ad, attributes: ['id', 'ulid'], required: false },
      ];

    if (postUlid) include[0].where.ulid = postUlid;
    if (language) include[0].where.language = language;
    if (state) include[0].where.states = { [Op.contains]: [state] };
    if (category) include[0].where.categories = { [Op.contains]: [category] };

    if (influencerUlid) include[1].where = { ulid: influencerUlid };
    if (adUlid) include[2].where = { ulid: adUlid };

    const rows = await InfluencerAdMedia.findAll({
      where,
      include,
      limit: Math.min(Number(limit) || 20, 100),
      offset: (Number(page) - 1) * (Number(limit) || 20),
      order: [['createdAt', 'DESC']],
    });

    const items = rows.map(r => ({
      id: r.id,
      ulid: r.ulid,
      provider: r.provider,
      guid: r.guid,
      playbackUrl: r.playbackUrl,
      thumbnailUrl: r.thumbnailUrl,
      status: r.status,
      sizeBytes: r.sizeBytes,
      durationSec: r.durationSec,
      meta: r.meta,
      post: r.Post ? { ulid: r.Post.ulid, caption: r.Post.caption, language: r.Post.language, categories: r.Post.categories, states: r.Post.states, type: r.Post.type, status: r.Post.status } : null,
      influencer: r.Influencer ? { ulid: r.Influencer.ulid, handle: r.Influencer.handle } : null,
      ad: r.Ad ? { ulid: r.Ad.ulid } : null,
    }));

    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Auth: list only the logged-in influencer's ad media entries
exports.listMyInfluencerAdMedia = async (req, res) => {
  try {
    const {
      status,
      postUlid,
      adUlid,
      language,
      state,
      category,
      limit = 20,
      page = 1,
    } = req.query;

    const infl = await Influencer.findOne({ where: { userId: req.user.id } });
    if (!infl) return res.status(404).json({ error: 'not found' });

    const where: any = { provider: 'bunny' };
    if (status) where.status = status;

    const include: any = [
      { model: Post, attributes: ['id', 'ulid', 'caption', 'language', 'categories', 'states', 'type', 'status'], where: {} as any },
      { model: Influencer, attributes: ['id', 'ulid', 'handle'], where: { id: infl.id } },
      { model: Ad, attributes: ['id', 'ulid'], required: false },
    ];

    if (postUlid) include[0].where.ulid = postUlid;
    if (language) include[0].where.language = language;
    if (state) include[0].where.states = { [Op.contains]: [state] };
    if (category) include[0].where.categories = { [Op.contains]: [category] };
    if (adUlid) include[2].where = { ulid: adUlid };

    const rows = await InfluencerAdMedia.findAll({
      where,
      include,
      limit: Math.min(Number(limit) || 20, 100),
      offset: (Number(page) - 1) * (Number(limit) || 20),
      order: [['createdAt', 'DESC']],
    });

    const items = rows.map(r => ({
      id: r.id,
      ulid: r.ulid,
      provider: r.provider,
      guid: r.guid,
      playbackUrl: r.playbackUrl,
      thumbnailUrl: r.thumbnailUrl,
      status: r.status,
      sizeBytes: r.sizeBytes,
      durationSec: r.durationSec,
      meta: r.meta,
      post: r.Post ? { ulid: r.Post.ulid, caption: r.Post.caption, language: r.Post.language, categories: r.Post.categories, states: r.Post.states, type: r.Post.type, status: r.Post.status } : null,
      influencer: r.Influencer ? { ulid: r.Influencer.ulid, handle: r.Influencer.handle } : null,
      ad: r.Ad ? { ulid: r.Ad.ulid } : null,
    }));

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
const crypto = require('crypto');
const { uploadBuffer } = require('../utils/r2');

const maxImageMB = parseInt(process.env.MEDIA_MAX_IMAGE_MB || '10', 10);
const maxVideoMB = parseInt(process.env.MEDIA_MAX_VIDEO_MB || '100', 10);

function detectType(filename, mimetype) {
  const lower = (mimetype || '').toLowerCase();
  if (lower.startsWith('image/')) return 'image';
  if (lower.startsWith('video/')) return 'video';
  const ext = (filename || '').toLowerCase();
  if (ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png') || ext.endsWith('.webp')) return 'image';
  if (ext.endsWith('.mp4') || ext.endsWith('.mov') || ext.endsWith('.webm')) return 'video';
  return 'unknown';
}

exports.upload = async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'file is required' });
    }
    const file = req.files.file; // using express-fileupload assumed
    const type = detectType(file.name, file.mimetype);
    if (type === 'unknown') return res.status(400).json({ error: 'Unsupported file type' });

    const sizeMB = file.size / (1024 * 1024);
    if (type === 'image' && sizeMB > maxImageMB) {
      return res.status(413).json({ error: `Image too large. Max ${maxImageMB}MB` });
    }
    if (type === 'video' && sizeMB > maxVideoMB) {
      return res.status(413).json({ error: `Video too large. Max ${maxVideoMB}MB` });
    }

    const id = crypto.randomUUID();
    const key = `uploads/${req.user.id}/${type}/${id}-${file.name}`;
    const buffer = (file.data && file.data.length) ? file.data : await fs.promises.readFile(file.tempFilePath);
    const { url } = await uploadBuffer(key, buffer, file.mimetype || 'application/octet-stream');

    res.json({ url, key, type, sizeMB: Number(sizeMB.toFixed(2)) });
  } catch (err) {
    console.error('Upload error', err);
    res.status(500).json({ error: 'Upload failed' });
  }
};
