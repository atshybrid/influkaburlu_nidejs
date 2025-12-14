// One-time backfill: migrate Bunny video entries from Posts.media into InfluencerAdMedia
require('dotenv').config();
const { sequelize, Post, Influencer, InfluencerAdMedia } = require('../models');

async function run() {
  console.log('Starting backfill of InfluencerAdMedia from Posts.media...');
  const t = await sequelize.transaction();
  try {
    const posts = await Post.findAll({ where: {}, transaction: t });
    let created = 0, skipped = 0;
    for (const post of posts) {
      const mediaArr = Array.isArray(post.media) ? post.media : [];
      const bunnyVideos = mediaArr.filter(m => m && m.type === 'video' && m.provider === 'bunny' && m.guid);
      if (!bunnyVideos.length) { continue; }
      const inflId = post.influencerId || null;
      for (const mv of bunnyVideos) {
        const exists = await InfluencerAdMedia.findOne({ where: { guid: mv.guid }, transaction: t });
        if (exists) { skipped++; continue; }
        const playbackUrl = mv.playbackUrl || (process.env.BUNNY_STREAM_LIBRARY_ID ? `https://iframe.mediadelivery.net/embed/${process.env.BUNNY_STREAM_LIBRARY_ID}/${mv.guid}` : null);
        await InfluencerAdMedia.create({
          postId: post.id,
          influencerId: inflId,
          adId: post.adId || null,
          provider: 'bunny',
          guid: mv.guid,
          playbackUrl,
          thumbnailUrl: mv.meta?.thumbnailUrl || null,
          status: 'uploaded',
          meta: { title: mv.meta?.title, caption: mv.meta?.caption },
        }, { transaction: t });
        created++;
      }
    }
    await t.commit();
    console.log(`Backfill complete. Created: ${created}, Skipped (existing): ${skipped}`);
    process.exit(0);
  } catch (err) {
    await t.rollback();
    console.error('Backfill failed:', err.message);
    process.exit(1);
  }
}

run();
