// Poll Bunny Stream API to update InfluencerAdMedia status/metadata
require('dotenv').config();
const fetch = require('node-fetch');
const { sequelize, InfluencerAdMedia } = require('../models');

const LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const API_KEY = process.env.BUNNY_STREAM_API_KEY;

async function getVideoStatus(guid) {
  const url = `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos/${guid}`;
  const resp = await fetch(url, { headers: { AccessKey: API_KEY } });
  if (!resp.ok) throw new Error(`Bunny status ${resp.status}`);
  return resp.json();
}

function mapStatus(bunny) {
  // Bunny fields: transcodingStatus (0=none,1=processing,2=completed), availableResolutions, length, storageSize
  if (bunny.transcodingStatus === 1) return 'processing';
  if (bunny.transcodingStatus === 2) return 'ready';
  return 'uploaded';
}

async function run() {
  if (!LIBRARY_ID || !API_KEY) {
    console.error('Missing BUNNY_STREAM_LIBRARY_ID or BUNNY_STREAM_API_KEY');
    process.exit(1);
  }
  console.log('Updating InfluencerAdMedia statuses from Bunny...');
  const t = await sequelize.transaction();
  try {
    const rows = await InfluencerAdMedia.findAll({
      where: { provider: 'bunny' },
      transaction: t,
    });
    let updated = 0, failures = 0;
    for (const row of rows) {
      try {
        const bunny = await getVideoStatus(row.guid);
        const status = mapStatus(bunny);
        const playbackUrl = row.playbackUrl || (LIBRARY_ID ? `https://iframe.mediadelivery.net/embed/${LIBRARY_ID}/${row.guid}` : null);
        await row.update({
          status,
          playbackUrl,
          durationSec: bunny.length || row.durationSec || null,
          sizeBytes: bunny.storageSize || row.sizeBytes || null,
          thumbnailUrl: bunny.thumbnail?.[0]?.thumbnailUrl || row.thumbnailUrl || null,
          meta: { ...(row.meta || {}), availableResolutions: bunny.availableResolutions },
        }, { transaction: t });
        updated++;
      } catch (e) {
        failures++;
        console.warn(`GUID ${row.guid} update failed: ${e.message}`);
      }
    }
    await t.commit();
    console.log(`Status update done. Updated: ${updated}, Failures: ${failures}`);
    process.exit(0);
  } catch (err) {
    await t.rollback();
    console.error('Update run failed:', err.message);
    process.exit(1);
  }
}

run();
