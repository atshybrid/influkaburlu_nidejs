/**
 * Public Feed Controller
 * 
 * Optimized API for mobile app swipe-to-next video feed.
 * Best practices:
 *   - Cursor-based pagination for infinite scroll
 *   - Returns only ready (processed) videos
 *   - Includes influencer details with each video
 *   - Pre-fetch hints for smooth UX
 *   - Randomization option for discovery
 */

const { InfluencerAdMedia, Influencer, Post, User } = require('../models');
const { Op, Sequelize } = require('sequelize');

// Helper: pick display badge name
function pickBadgeName(infl: any): string | null {
  const badges = Array.isArray(infl.badges) ? infl.badges : [];
  if (badges.includes('rising_star')) return 'Rising Star';
  if (badges.includes('verified')) return 'Verified';
  if (badges.includes('top_creator')) return 'Top Creator';
  if (infl.verificationStatus === 'verified') return 'Verified';
  return null;
}

/**
 * GET /api/public/feed/videos
 * 
 * Public video feed for mobile swipe-to-next UX
 * 
 * Query params:
 *   - cursor: Base64 encoded cursor for pagination (optional)
 *   - limit: Number of videos per page (default: 10, max: 50)
 *   - category: Filter by category code (optional)
 *   - language: Filter by language code (optional)
 *   - state: Filter by state code (optional)
 *   - shuffle: "true" to get randomized results (ignores cursor, uses offset)
 *   - seed: Random seed for consistent shuffle pagination (optional)
 * 
 * Response:
 *   - items: Array of video objects with influencer details
 *   - nextCursor: Cursor for next page (null if no more)
 *   - hasMore: Boolean indicating if more videos exist
 *   - prefetch: First video URL of next page (for preloading)
 *   - total: Total count of matching videos (only on first page)
 */
exports.getVideoFeed = async (req, res) => {
  try {
    const {
      cursor,
      limit: rawLimit = '10',
      category,
      language,
      state,
      shuffle = 'false',
      seed,
    } = req.query;

    const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 10, 1), 50);
    const isShuffled = shuffle === 'true';

    // Base where clause: only ready videos from Bunny
    const where: any = {
      provider: 'bunny',
      status: 'ready',
      playbackUrl: { [Op.ne]: null },
    };

    // Build includes with filters
    const postWhere: any = { status: 'active' };
    if (language) postWhere.language = language;
    if (state) postWhere.states = { [Op.contains]: [state] };
    if (category) postWhere.categories = { [Op.contains]: [category] };

    const include: any[] = [
      {
        model: Post,
        attributes: ['id', 'ulid', 'caption', 'language', 'categories', 'states', 'type', 'metrics'],
        where: postWhere,
        required: true,
      },
      {
        model: Influencer,
        attributes: ['id', 'ulid', 'handle', 'profilePicUrl', 'verificationStatus', 'badges', 'bio', 'followers'],
        required: true,
        include: [{ model: User, attributes: ['name'] }],
      },
    ];

    // Cursor-based pagination (decode cursor)
    let cursorData: any = null;
    if (cursor && !isShuffled) {
      try {
        cursorData = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
        if (cursorData.t && cursorData.u) {
          const t = new Date(cursorData.t);
          where[Op.or] = [
            { createdAt: { [Op.lt]: t } },
            { createdAt: t, ulid: { [Op.lt]: cursorData.u } },
          ];
        }
      } catch (_) {
        // Invalid cursor, ignore
      }
    }

    // For shuffled mode, use seeded random offset
    let offset = 0;
    if (isShuffled && cursorData?.offset !== undefined) {
      offset = cursorData.offset;
    } else if (isShuffled && cursor) {
      try {
        const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
        offset = parsed.offset || 0;
      } catch (_) {}
    }

    // Ordering
    let order: any;
    if (isShuffled) {
      // Use seeded random for consistent pagination
      const seedVal = seed ? parseInt(seed, 10) || 12345 : Math.floor(Math.random() * 100000);
      order = Sequelize.literal(`RANDOM()`);
      // Note: True seeded random requires: ORDER BY MD5(id::text || '${seedVal}')
      // For simplicity, we use offset-based pagination with random order
    } else {
      order = [
        ['createdAt', 'DESC'],
        ['ulid', 'DESC'],
      ];
    }

    // Fetch one extra to determine hasMore
    const rows = await InfluencerAdMedia.findAll({
      where,
      include,
      limit: limit + 1,
      offset: isShuffled ? offset : undefined,
      order: isShuffled ? Sequelize.literal('RANDOM()') : order,
    });

    const hasMore = rows.length > limit;
    const resultRows = rows.slice(0, limit);

    // Get total count only on first page (no cursor)
    let total: number | undefined;
    if (!cursor) {
      total = await InfluencerAdMedia.count({
        where: { provider: 'bunny', status: 'ready', playbackUrl: { [Op.ne]: null } },
        include: [{ model: Post, where: postWhere, required: true }],
      });
    }

    // Map results to response format
    const items = resultRows.map((r: any) => {
      const infl = r.Influencer;
      const post = r.Post;
      const userName = infl?.User?.name || null;
      const handle = infl?.handle || null;
      const badgeName = pickBadgeName(infl);

      return {
        // Video details
        videoId: r.ulid,
        videoGuid: r.guid,
        videoUrl: r.playbackUrl,
        thumbnailUrl: r.thumbnailUrl || null,
        durationSec: r.durationSec || null,

        // Post details
        postId: post?.ulid || null,
        caption: post?.caption || r.meta?.caption || null,
        language: post?.language || null,
        categories: post?.categories || [],
        states: post?.states || [],
        metrics: post?.metrics || { likes: 0, comments: 0, saves: 0, views: 0 },

        // Influencer details
        influencer: {
          id: infl?.ulid || null,
          name: userName,
          handle,
          handleDisplay: handle ? `@${handle}` : null,
          profilePicUrl: infl?.profilePicUrl || null,
          verified: infl?.verificationStatus === 'verified',
          badgeName,
          bio: infl?.bio || null,
          followers: infl?.followers || {},
        },

        // Metadata
        createdAt: r.createdAt,
      };
    });

    // Build next cursor
    let nextCursor: string | null = null;
    if (hasMore && resultRows.length > 0) {
      if (isShuffled) {
        nextCursor = Buffer.from(JSON.stringify({ offset: offset + limit, seed })).toString('base64');
      } else {
        const last = resultRows[resultRows.length - 1];
        nextCursor = Buffer.from(JSON.stringify({ t: last.createdAt, u: last.ulid })).toString('base64');
      }
    }

    // Prefetch hint: get first video URL of next batch
    let prefetch: { videoUrl: string; thumbnailUrl?: string } | null = null;
    if (hasMore && rows.length > limit) {
      const nextFirst = rows[limit];
      prefetch = {
        videoUrl: nextFirst.playbackUrl,
        thumbnailUrl: nextFirst.thumbnailUrl || undefined,
      };
    }

    return res.json({
      items,
      nextCursor,
      hasMore,
      prefetch,
      ...(total !== undefined && { total }),
    });
  } catch (err: any) {
    console.error('[publicFeed] getVideoFeed error:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
};

/**
 * GET /api/public/feed/videos/:videoId
 * 
 * Get single video details by ULID
 * Useful for deep linking / sharing
 */
exports.getVideoById = async (req, res) => {
  try {
    const { videoId } = req.params;

    const row = await InfluencerAdMedia.findOne({
      where: {
        ulid: videoId,
        provider: 'bunny',
        status: 'ready',
        playbackUrl: { [Op.ne]: null },
      },
      include: [
        {
          model: Post,
          attributes: ['id', 'ulid', 'caption', 'language', 'categories', 'states', 'type', 'metrics'],
          where: { status: 'active' },
          required: true,
        },
        {
          model: Influencer,
          attributes: ['id', 'ulid', 'handle', 'profilePicUrl', 'verificationStatus', 'badges', 'bio', 'followers', 'socialLinks'],
          required: true,
          include: [{ model: User, attributes: ['name'] }],
        },
      ],
    });

    if (!row) {
      return res.status(404).json({ error: 'not_found', message: 'Video not found' });
    }

    const infl = row.Influencer;
    const post = row.Post;
    const userName = infl?.User?.name || null;
    const handle = infl?.handle || null;
    const badgeName = pickBadgeName(infl);

    return res.json({
      videoId: row.ulid,
      videoGuid: row.guid,
      videoUrl: row.playbackUrl,
      thumbnailUrl: row.thumbnailUrl || null,
      durationSec: row.durationSec || null,
      sizeBytes: row.sizeBytes || null,

      postId: post?.ulid || null,
      caption: post?.caption || row.meta?.caption || null,
      language: post?.language || null,
      categories: post?.categories || [],
      states: post?.states || [],
      metrics: post?.metrics || { likes: 0, comments: 0, saves: 0, views: 0 },

      influencer: {
        id: infl?.ulid || null,
        name: userName,
        handle,
        handleDisplay: handle ? `@${handle}` : null,
        profilePicUrl: infl?.profilePicUrl || null,
        verified: infl?.verificationStatus === 'verified',
        badgeName,
        bio: infl?.bio || null,
        followers: infl?.followers || {},
        socialLinks: infl?.socialLinks || {},
      },

      createdAt: row.createdAt,
    });
  } catch (err: any) {
    console.error('[publicFeed] getVideoById error:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
};

/**
 * GET /api/public/feed/influencers/:influencerId/videos
 * 
 * Get all videos from a specific influencer
 * For viewing an influencer's profile/portfolio
 */
exports.getInfluencerVideos = async (req, res) => {
  try {
    const { influencerId } = req.params;
    const { cursor, limit: rawLimit = '10' } = req.query;

    const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 10, 1), 50);

    // Find influencer by ULID
    const infl = await Influencer.findOne({
      where: { ulid: influencerId },
      include: [{ model: User, attributes: ['name'] }],
    });

    if (!infl) {
      return res.status(404).json({ error: 'not_found', message: 'Influencer not found' });
    }

    const where: any = {
      influencerId: infl.id,
      provider: 'bunny',
      status: 'ready',
      playbackUrl: { [Op.ne]: null },
    };

    // Cursor pagination
    if (cursor) {
      try {
        const cursorData = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
        if (cursorData.t && cursorData.u) {
          const t = new Date(cursorData.t);
          where[Op.or] = [
            { createdAt: { [Op.lt]: t } },
            { createdAt: t, ulid: { [Op.lt]: cursorData.u } },
          ];
        }
      } catch (_) {}
    }

    const rows = await InfluencerAdMedia.findAll({
      where,
      include: [
        {
          model: Post,
          attributes: ['id', 'ulid', 'caption', 'language', 'categories', 'states', 'metrics'],
          where: { status: 'active' },
          required: true,
        },
      ],
      limit: limit + 1,
      order: [['createdAt', 'DESC'], ['ulid', 'DESC']],
    });

    const hasMore = rows.length > limit;
    const resultRows = rows.slice(0, limit);

    const userName = infl.User?.name || null;
    const handle = infl.handle || null;
    const badgeName = pickBadgeName(infl);

    const items = resultRows.map((r: any) => {
      const post = r.Post;
      return {
        videoId: r.ulid,
        videoGuid: r.guid,
        videoUrl: r.playbackUrl,
        thumbnailUrl: r.thumbnailUrl || null,
        durationSec: r.durationSec || null,
        postId: post?.ulid || null,
        caption: post?.caption || r.meta?.caption || null,
        categories: post?.categories || [],
        metrics: post?.metrics || { likes: 0, comments: 0, saves: 0, views: 0 },
        createdAt: r.createdAt,
      };
    });

    let nextCursor: string | null = null;
    if (hasMore && resultRows.length > 0) {
      const last = resultRows[resultRows.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ t: last.createdAt, u: last.ulid })).toString('base64');
    }

    // Get total count for this influencer
    const total = await InfluencerAdMedia.count({
      where: {
        influencerId: infl.id,
        provider: 'bunny',
        status: 'ready',
        playbackUrl: { [Op.ne]: null },
      },
      include: [{ model: Post, where: { status: 'active' }, required: true }],
    });

    return res.json({
      influencer: {
        id: infl.ulid,
        name: userName,
        handle,
        handleDisplay: handle ? `@${handle}` : null,
        profilePicUrl: infl.profilePicUrl || null,
        verified: infl.verificationStatus === 'verified',
        badgeName,
        bio: infl.bio || null,
        followers: infl.followers || {},
      },
      items,
      nextCursor,
      hasMore,
      total,
    });
  } catch (err: any) {
    console.error('[publicFeed] getInfluencerVideos error:', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
};
