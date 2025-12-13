const { Post, Influencer, Ad, InfluencerAdMedia } = require('../models');
const { Op } = require('sequelize');
const fetch = require('node-fetch');
let axios;
const fs = require('fs');

exports.createPost = async (req, res) => {
  try {
    const userId = req.user.id;
    const infl = await Influencer.findOne({ where: { userId } });
    const influencerId = infl ? infl.id : null;
    const { type = 'external', caption, media = [], categories = [], language, states = [], adId } = req.body;
    const post = await Post.create({ userId, influencerId, type, caption, media, categories, language, states, adId: adId || null });
    res.json({ ...post.toJSON(), idUlid: post.ulid });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.listFeed = async (req, res) => {
  try {
    const { category, state, language, type, page = 1, limit = 20, cursor, status = 'any', fields } = req.query;
    const lim = Math.min(Number(limit) || 20, 50);
    const where = { status: 'active' };
    if (type) where.type = type;
    if (language) where.language = language;
    if (state) where.states = { [Op.contains]: [state] };
    if (category) where.categories = { [Op.contains]: [category] };

    // Cursor filter: expect base64 JSON { t: ISO date, u: ulid }
    let order = [['createdAt', 'DESC'], ['ulid', 'DESC']];
    if (cursor) {
      try {
        const json = JSON.parse(Buffer.from(String(cursor), 'base64').toString('utf8'));
        if (json && json.t) {
          const t = new Date(json.t);
          where[Op.or] = [
            { createdAt: { [Op.lt]: t } },
            { createdAt: t, ulid: { [Op.lt]: json.u } }
          ];
        }
      } catch (_) {}
    }

    const rows = await Post.findAll({ where, limit: lim, offset: cursor ? undefined : (page - 1) * lim, order });

    // Enrich media: top-level fields and optional videos[]
    const postIds = rows.map(r => r.id);
    const mediaByPost = new Map();
    const allMediaByPost = new Map();
    if (postIds.length) {
      const allMedia = await InfluencerAdMedia.findAll({
        where: { postId: { [Op.in]: postIds }, provider: 'bunny' },
        order: [['createdAt', 'DESC']],
      });
      for (const m of allMedia) {
        if (!mediaByPost.has(m.postId)) mediaByPost.set(m.postId, m);
        const arr = allMediaByPost.get(m.postId) || [];
        arr.push(m);
        allMediaByPost.set(m.postId, arr);
      }
    }

    const wantVideos = !fields || String(fields).split(',').includes('videos');
    const wantMetrics = !fields || String(fields).split(',').includes('metrics');

    let items = rows.map(r => {
      const json = { ...r.toJSON(), idUlid: r.ulid };
      if (!wantMetrics) delete json.metrics;
      const m = mediaByPost.get(r.id);
      const allM = allMediaByPost.get(r.id) || [];
      if (m) {
        json.videoUrl = m.playbackUrl;
        json.videoGuid = m.guid;
        json.videoStatus = m.status;
        json.videoProvider = m.provider;
        json.videoThumbnailUrl = m.thumbnailUrl || undefined;
        if (wantVideos) {
          json.videos = allM.map(x => ({
            guid: x.guid,
            url: x.playbackUrl,
            status: x.status,
            provider: x.provider,
            thumbnailUrl: x.thumbnailUrl || undefined,
            sizeBytes: x.sizeBytes || undefined,
            createdAt: x.createdAt
          }));
        }
      } else {
        const mediaArr = Array.isArray(r.media) ? r.media : [];
        const firstVid = mediaArr.find(x => x && x.type === 'video' && x.provider === 'bunny');
        if (firstVid) {
          json.videoUrl = firstVid.playbackUrl;
          json.videoGuid = firstVid.guid;
          json.videoStatus = undefined;
          json.videoProvider = 'bunny';
          json.videoThumbnailUrl = firstVid.meta?.thumbnailUrl;
          if (wantVideos) {
            json.videos = mediaArr
              .filter(x => x && x.type === 'video' && x.provider === 'bunny')
              .map(x => ({ guid: x.guid, url: x.playbackUrl, status: undefined, provider: 'bunny', thumbnailUrl: x.meta?.thumbnailUrl }));
          }
        }
      }
      return json;
    });

    // Status filter: default 'any'; if 'ready', keep only posts with latest videoStatus === 'ready'
    if (status === 'ready') {
      items = items.filter(p => p.videoStatus === 'ready');
    }

    // Build nextCursor from last item
    let nextCursor = null;
    if (items.length) {
      const last = rows[rows.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ t: last.createdAt, u: last.ulid })).toString('base64');
    }

    // Prefetch hint: attempt to get first videoUrl of next page
    let prefetch = null;
    if (!cursor) {
      const next = await Post.findAll({ where, limit: 1, offset: (Number(page) * lim), order });
      if (next && next[0]) {
        const nm = await InfluencerAdMedia.findOne({ where: { postId: next[0].id, provider: 'bunny' }, order: [['createdAt','DESC']] });
        if (nm) prefetch = { videoUrl: nm.playbackUrl };
      }
    }

    res.json({ items, nextCursor, prefetch });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getPost = async (req, res) => {
  try {
    const { idUlid } = req.params;
    const post = await Post.findOne({ where: { ulid: idUlid } });
    if (!post) return res.status(404).json({ error: 'not found' });
    res.json({ ...post.toJSON(), idUlid: post.ulid });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Create Bunny Stream video for a post and return upload info
exports.createPostVideo = async (req, res) => {
  try {
    const { idUlid } = req.params;
    const post = await Post.findOne({ where: { ulid: idUlid } });
    if (!post) return res.status(404).json({ error: 'not found' });
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const apiKey = process.env.BUNNY_STREAM_API_KEY;
    if (!libraryId || !apiKey) return res.status(500).json({ error: 'Bunny Stream env missing' });
    const r = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', AccessKey: apiKey },
      body: JSON.stringify({ title: req.body.title || `Post ${post.ulid} Video` })
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ error: 'bunny_error', details: text });
    }
    const json = await r.json();
    // json.guid and json.uploadUrl available; store provisional media entry
    const playbackUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${json.guid}`;
    const mediaEntry = { type: 'video', provider: 'bunny', guid: json.guid, uploadUrl: json.uploadUrl, playbackUrl };
    const media = Array.isArray(post.media) ? post.media : [];
    media.push(mediaEntry);
    post.media = media;
    await post.save();
    // Also persist an InfluencerAdMedia row for stable tracking
    try {
      await InfluencerAdMedia.create({
        postId: post.id,
        influencerId: post.influencerId || null,
        adId: post.adId || null,
        provider: 'bunny',
        guid: json.guid,
        playbackUrl,
        status: 'created',
        meta: {}
      });
    } catch (_) {}
    res.json({ guid: json.guid, uploadUrl: json.uploadUrl, playbackUrl, postIdUlid: post.ulid });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Create Bunny Stream video for the influencer's latest ad post (me)
exports.createPostVideoMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const infl = await Influencer.findOne({ where: { userId } });
    if (!infl) return res.status(404).json({ error: 'influencer_not_found' });
    let post;
    const { postUlid, title, description, caption, thumbnailUrl, category, categoryCode } = req.body || {};
    if (postUlid) {
      post = await Post.findOne({ where: { ulid: postUlid, influencerId: infl.id } });
      if (!post) return res.status(404).json({ error: 'post_not_found_or_not_owned' });
    } else {
      post = await Post.findOne({ where: { influencerId: infl.id, type: 'ad' }, order: [['createdAt', 'DESC']] });
    }
    let createdNew = false;
    if (!post) {
      // Create a new ad-type post for this influencer
      const baseCategories = [];
      if (category) baseCategories.push(String(category));
      if (categoryCode) baseCategories.push(String(categoryCode));
      post = await Post.create({
        userId,
        influencerId: infl.id,
        type: 'ad',
        caption: caption || title || 'Ad Post',
        media: [],
        categories: baseCategories,
        language: (Array.isArray(infl.languages) && infl.languages.length) ? infl.languages[0] : null,
        states: Array.isArray(infl.states) ? infl.states : []
      });
      createdNew = true;
    }
    // Enrich post details from influencer profile if missing
    if (!post.language && Array.isArray(infl.languages) && infl.languages.length) post.language = infl.languages[0];
    if ((!post.states || !post.states.length) && Array.isArray(infl.states)) post.states = infl.states;
    // Add category by id or code string to post categories
    const categories = Array.isArray(post.categories) ? post.categories : [];
    if (category) categories.push(String(category));
    if (categoryCode) categories.push(String(categoryCode));
    post.categories = categories;
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const apiKey = process.env.BUNNY_STREAM_API_KEY;
    if (!libraryId || !apiKey) return res.status(500).json({ error: 'Bunny Stream env missing' });
    const r = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', AccessKey: apiKey },
      body: JSON.stringify({ title: title || `Post ${post.ulid} Video` })
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ error: 'bunny_error', details: text });
    }
    const json = await r.json();
    const playbackUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${json.guid}`;
    const mediaEntry = { type: 'video', provider: 'bunny', guid: json.guid, uploadUrl: json.uploadUrl, playbackUrl, meta: { title: title || null, description: description || null, caption: caption || null, thumbnailUrl: thumbnailUrl || null } };
    const media = Array.isArray(post.media) ? post.media : [];
    media.push(mediaEntry);
    post.media = media;
    await post.save();
    // Persist InfluencerAdMedia row
    let mediaRow;
    try {
      mediaRow = await InfluencerAdMedia.create({
        postId: post.id,
        influencerId: post.influencerId || infl.id,
        adId: post.adId || null,
        provider: 'bunny',
        guid: json.guid,
        playbackUrl,
        thumbnailUrl: thumbnailUrl || null,
        status: 'created',
        meta: { title: title || null, description: description || null, caption: caption || null, categories: post.categories || [] }
      });
    } catch (_) {}
    // If a file was uploaded, stream it directly to Bunny API (recommended)
    let uploadedOk = false;
    const tempPath = req.file?.path;
    if (req.file) {
      try {
        if (!axios) {
          try { axios = require('axios'); } catch (e) { return res.status(500).json({ error: 'axios_not_installed' }); }
        }
        // Prefer disk path streaming to set Content-Length correctly
        const filePath = tempPath;
        let stats;
        if (filePath && fs.existsSync(filePath)) {
          stats = fs.statSync(filePath);
        } else if (req.file.buffer) {
          // Fallback: write buffer to temp file to ensure Content-Length
          const tmp = (require('os').tmpdir()) + '/' + (Date.now() + '-upload.bin');
          fs.writeFileSync(tmp, req.file.buffer);
          stats = fs.statSync(tmp);
          req.file.path = tmp;
        }
        const stream = fs.createReadStream(req.file.path);
        const up = await axios.put(
          `https://video.bunnycdn.com/library/${libraryId}/videos/${json.guid}`,
          stream,
          {
            headers: {
              AccessKey: apiKey,
              'Content-Type': 'application/octet-stream',
              'Content-Length': stats?.size || req.file.size || undefined
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 0
          }
        );
        if (up.status < 200 || up.status >= 300) {
          return res.status(502).json({ error: 'bunny_upload_failed_status', status: up.status });
        }
        uploadedOk = true;
        // Update media row status and size
        try {
          if (mediaRow) {
            mediaRow.status = 'uploaded';
            mediaRow.sizeBytes = stats?.size || req.file.size || null;
            await mediaRow.save();
          } else {
            await InfluencerAdMedia.update(
              { status: 'uploaded', sizeBytes: stats?.size || req.file.size || null },
              { where: { guid: json.guid } }
            );
          }
        } catch (_) {}
      } catch (e) {
        return res.status(502).json({ error: 'bunny_upload_error', details: e.message });
      } finally {
        if (tempPath && fs.existsSync(tempPath)) {
          try { fs.unlinkSync(tempPath); } catch (_) {}
        }
      }
    }
    // Attempt to update Bunny video metadata (title/description) for better display
    let metaUpdated = false;
    try {
      if (title || description) {
        const metaRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${json.guid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', AccessKey: apiKey },
          body: JSON.stringify({ title: title || undefined, description: description || undefined, tags: Array.isArray(post.categories) ? post.categories : undefined, thumbnailUrl: thumbnailUrl || undefined })
        });
        metaUpdated = metaRes.ok;
        if (metaUpdated) {
          try {
            await InfluencerAdMedia.update(
              { status: 'processing', meta: { ...(mediaRow?.meta || {}), title: title || undefined, description: description || undefined } },
              { where: { guid: json.guid } }
            );
          } catch (_) {}
        }
      }
    } catch (_) { /* ignore meta update errors */ }
    const payload = { guid: json.guid, uploadUrl: json.uploadUrl, playbackUrl, postIdUlid: post.ulid, uploaded: uploadedOk, size: req.file?.size || null, metaApplied: true, bunnyMetaUpdated: metaUpdated };
    if (createdNew) return res.status(201).json(payload);
    return res.status(200).json(payload);
  } catch (err) { res.status(500).json({ error: err.message }); }
};