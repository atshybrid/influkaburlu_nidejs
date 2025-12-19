// One-off helper to patch DB schema for Influencers.ulid (no data loss).
// Usage: node scripts/ensure-influencer-ulid.js

try {
  require('dotenv').config();
} catch (_) {}

const db = require('../dist/src/models');

(async () => {
  await db.sequelize.authenticate();
  if (typeof db.ensureInfluencerUlidColumn === 'function') {
    await db.ensureInfluencerUlidColumn();
  }

  const qi = db.sequelize.getQueryInterface();
  let tableName = 'Influencers';
  let table;
  try {
    table = await qi.describeTable('Influencers');
  } catch (e) {
    tableName = 'influencers';
    table = await qi.describeTable('influencers');
  }

  const hasUlid = Object.prototype.hasOwnProperty.call(table, 'ulid');
  console.log('Patched table:', tableName);
  console.log('Has ulid column:', hasUlid);

  await db.sequelize.close();
})().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('ensure-influencer-ulid failed:', e && e.message ? e.message : e);
  process.exit(1);
});
