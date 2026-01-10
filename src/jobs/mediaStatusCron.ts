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
  if (bunny.transcodingStatus === 1) return 'processing';
  if (bunny.transcodingStatus === 2) return 'ready';
  return 'uploaded';
}

async function updateAllOnce() {
  if (!LIBRARY_ID || !API_KEY) {
    console.warn('MediaStatusCron: Missing Bunny env');
    return { updated: 0, failures: 0 };
  }
  const t = await sequelize.transaction();
  try {
    const rows = await InfluencerAdMedia.findAll({ where: { provider: 'bunny' }, transaction: t });
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
          thumbnailUrl: bunny.thumbnailUrl || row.thumbnailUrl || null,
          meta: { ...(row.meta || {}), availableResolutions: bunny.availableResolutions },
        }, { transaction: t });
        updated++;
      } catch (e) {
        failures++;
      }
    }
    await t.commit();
    return { updated, failures };
  } catch (err) {
    await t.rollback();
    console.warn('MediaStatusCron failed batch:', err.message);
    return { updated: 0, failures: 0 };
  }
}

function startMediaStatusCron() {
  const everyMs = parseInt(process.env.MEDIA_STATUS_INTERVAL_MS || '120000', 10); // default 2 min
  console.log(`MediaStatusCron: starting with interval ${everyMs} ms`);
  updateAllOnce()
    .then(r => console.log(`MediaStatusCron initial run:`, r))
    .catch(e => console.error('MediaStatusCron initial run error:', e?.message || e));
  return setInterval(async () => {
    try {
      const r = await updateAllOnce();
      if (r.updated) console.log(`MediaStatusCron: updated ${r.updated}, failures ${r.failures}`);
    } catch (e) {
      console.error('MediaStatusCron interval error:', e?.message || e);
    }
  }, everyMs);
}

module.exports = { startMediaStatusCron };
