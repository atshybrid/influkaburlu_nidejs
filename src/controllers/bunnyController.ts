const fetch = require('node-fetch');
const { Post, InfluencerAdMedia, Influencer } = require('../models');

async function deleteFromBunny(guid: string) {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_API_KEY;
  if (!libraryId || !apiKey) {
    return { ok: false, status: 500, error: 'Bunny Stream env missing' };
  }
  const r = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`, {
    method: 'DELETE',
    headers: { AccessKey: apiKey }
  });
  if (r.ok) return { ok: true, status: r.status };
  const text = await r.text().catch(() => '');
  // Bunny returns 404 if already deleted; treat as OK for idempotency.
  if (r.status === 404) return { ok: true, status: 404, alreadyDeleted: true };
  return { ok: false, status: r.status, error: text || 'bunny_error' };
}

async function removeGuidFromPostMedia(postId: number, guid: string) {
  try {
    const post = await Post.findByPk(postId);
    if (!post) return;
    const media = Array.isArray(post.media) ? post.media : [];
    const filtered = media.filter(m => !(m && m.provider === 'bunny' && m.guid === guid));
    if (filtered.length !== media.length) {
      post.media = filtered;
      await post.save();
    }
  } catch (_) {}
}

exports.adminListVideos = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const apiKey = process.env.BUNNY_STREAM_API_KEY;
    if (!libraryId || !apiKey) return res.status(500).json({ error: 'Bunny Stream env missing' });
    const { page = 1, perPage = 20, search } = req.query;
    const url = new URL(`https://video.bunnycdn.com/library/${libraryId}/videos`);
    url.searchParams.set('page', page);
    url.searchParams.set('perPage', perPage);
    if (search) url.searchParams.set('search', search);
    const r = await fetch(url.toString(), { headers: { AccessKey: apiKey } });
    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ error: 'bunny_error', details: text });
    }
    const json = await r.json();
    const items = (json.items || json) .map(v => ({
      guid: v.guid,
      title: v.title,
      length: v.length,
      size: v.storageSize,
      status: v.status,
      thumbnailUrl: v.thumbnailUrl || null,
      createdAt: v.dateUploaded || v.createdAt || null
    }));
    res.json({ page: Number(page), perPage: Number(perPage), total: json.totalItems || items.length, items });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Influencer: delete one of my Bunny videos (by guid)
exports.deleteMyVideo = async (req, res) => {
  try {
    const { guid } = req.params;
    if (!guid) return res.status(400).json({ error: 'guid_required' });

    const infl = await Influencer.findOne({ where: { userId: req.user.id } });
    if (!infl) return res.status(404).json({ error: 'influencer_not_found' });

    const row = await InfluencerAdMedia.findOne({ where: { guid, influencerId: infl.id, provider: 'bunny' } });
    if (!row) return res.status(404).json({ error: 'not_found' });

    const bunny = await deleteFromBunny(guid);
    if (!bunny.ok) return res.status(502).json({ error: 'bunny_error', status: bunny.status, details: bunny.error });

    await removeGuidFromPostMedia(row.postId, guid);
    await row.destroy();

    return res.json({ ok: true, guid, bunnyDeleted: true, bunnyStatus: bunny.status });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

// Admin: delete any Bunny video (by guid)
exports.adminDeleteVideo = async (req, res) => {
  try {
    const { guid } = req.params;
    if (!guid) return res.status(400).json({ error: 'guid_required' });

    const bunny = await deleteFromBunny(guid);
    if (!bunny.ok) return res.status(502).json({ error: 'bunny_error', status: bunny.status, details: bunny.error });

    const row = await InfluencerAdMedia.findOne({ where: { guid, provider: 'bunny' } });
    if (row) {
      await removeGuidFromPostMedia(row.postId, guid);
      await row.destroy();
    }

    return res.json({ ok: true, guid, bunnyDeleted: true, bunnyStatus: bunny.status, dbDeleted: Boolean(row) });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.postPlayback = async (req, res) => {
  try {
    const { idUlid } = req.params;
    const post = await Post.findOne({ where: { ulid: idUlid } });
    if (!post) return res.status(404).json({ error: 'not_found' });
    const media = Array.isArray(post.media) ? post.media : [];
    const vid = media.reverse().find(m => m.type === 'video' && m.provider === 'bunny');
    if (vid) {
      return res.json({
        provider: 'bunny',
        guid: vid.guid,
        playbackUrl: vid.playbackUrl,
        title: vid.meta?.title || null,
        caption: vid.meta?.caption || post.caption || null,
        thumbnailUrl: vid.meta?.thumbnailUrl || null
      });
    }
    // Fallback: consult InfluencerAdMedia canonical table
    const row = await InfluencerAdMedia.findOne({ where: { postId: post.id, provider: 'bunny' }, order: [['createdAt','DESC']] });
    if (!row) return res.status(404).json({ error: 'no_video' });
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const playbackUrl = row.playbackUrl || (libraryId ? `https://iframe.mediadelivery.net/embed/${libraryId}/${row.guid}` : null);
    return res.json({
      provider: 'bunny',
      guid: row.guid,
      playbackUrl,
      title: row.meta?.title || null,
      caption: post.caption || null,
      thumbnailUrl: row.thumbnailUrl || null
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.videoStatus = async (req, res) => {
  try {
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const apiKey = process.env.BUNNY_STREAM_API_KEY;
    if (!libraryId || !apiKey) return res.status(500).json({ error: 'Bunny Stream env missing' });
    const { guid } = req.params;
    const r = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`, { headers: { AccessKey: apiKey } });
    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ error: 'bunny_error', details: text });
    }
    const v = await r.json();
    res.json({ guid: v.guid, title: v.title, length: v.length, size: v.storageSize, status: v.status, createdAt: v.dateUploaded || v.createdAt || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.mediaStatusCounts = async (req, res) => {
  try {
    const { InfluencerAdMedia } = require('../models');
    const rows = await InfluencerAdMedia.findAll({ attributes: ['status'] });
    const counts = rows.reduce((acc, r) => {
      const s = r.status || 'unknown';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    res.json({ counts });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
