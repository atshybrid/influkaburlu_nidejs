// Backfill adPricing JSONB column from legacy rateCards/adPricing without data loss
// Usage: node src/scripts/backfillAdPricing.js

const { Sequelize } = require('sequelize');
const { sequelize, Influencer } = require('../models');

async function main() {
  try {
    await sequelize.authenticate();

    // Add column if missing (safe on modern PG), otherwise ignore error
    try {
      await sequelize.query(
        `ALTER TABLE "Influencers" ADD COLUMN IF NOT EXISTS "adPricing" JSONB DEFAULT '{}'::jsonb`
      );
      console.log('Ensured adPricing column exists.');
    } catch (_) {}

    const influencers = await Influencer.findAll({ attributes: ['id', 'adPricing', 'rateCards'] });
    let updated = 0;
    for (const infl of influencers) {
      const current = infl.adPricing || {};
      const rc = infl.rateCards;
      let legacy = null;
      if (rc && typeof rc === 'object') {
        if (rc.adPricing && typeof rc.adPricing === 'object') legacy = rc.adPricing;
      } else if (Array.isArray(rc) && rc.length > 0) {
        if (rc[0] && typeof rc[0] === 'object' && rc[0].adPricing) legacy = rc[0].adPricing;
      }

      if (!legacy || Object.keys(legacy).length === 0) continue;

      const merged = { ...legacy, ...current };
      // Only update if merging adds something new
      const currentKeys = Object.keys(current || {});
      const mergedKeys = Object.keys(merged);
      if (mergedKeys.length > currentKeys.length) {
        infl.adPricing = merged;
        // Also normalize rateCards to object shape containing adPricing
        let newRateCards = rc;
        if (!rc || typeof rc !== 'object' || Array.isArray(rc)) {
          newRateCards = { adPricing: legacy };
        } else {
          newRateCards = { ...rc, adPricing: legacy };
        }
        infl.rateCards = newRateCards;
        await infl.save();
        updated++;
      }
    }
    console.log(`Backfill complete. Updated rows: ${updated}`);
    await sequelize.close();
  } catch (err) {
    console.error('Backfill error:', err);
    process.exitCode = 1;
    try { await sequelize.close(); } catch {}
  }
}

main();
