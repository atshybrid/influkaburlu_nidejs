// Backfill InfluencerPricing table from Influencers.adPricing without data loss
// Usage: node src/scripts/backfillInfluencerPricing.js

const { sequelize, Influencer, InfluencerPricing } = require('../models');

async function main() {
  try {
    await sequelize.authenticate();
    // Ensure table exists (models/index.js already does, but being defensive)
    try {
      await sequelize.getQueryInterface().describeTable('InfluencerPricing');
    } catch (_) {
      await sequelize.getQueryInterface().createTable('InfluencerPricing', {
        id: { type: sequelize.constructor.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        influencerId: { type: sequelize.constructor.DataTypes.INTEGER, allowNull: false },
        adPricing: { type: sequelize.constructor.DataTypes.JSONB, defaultValue: {} },
        ulid: { type: sequelize.constructor.DataTypes.STRING(26), allowNull: false, unique: true },
        createdAt: { type: sequelize.constructor.DataTypes.DATE, allowNull: false, defaultValue: sequelize.fn('NOW') },
        updatedAt: { type: sequelize.constructor.DataTypes.DATE, allowNull: false, defaultValue: sequelize.fn('NOW') },
      });
    }

    const infls = await Influencer.findAll({ attributes: ['id', 'adPricing'] });
    let created = 0, updated = 0;
    for (const infl of infls) {
      const pricing = await InfluencerPricing.findOne({ where: { influencerId: infl.id } });
      const src = infl.adPricing || {};
      if (!pricing) {
        if (Object.keys(src).length === 0) continue;
        await InfluencerPricing.create({ influencerId: infl.id, adPricing: src });
        created++;
      } else {
        const merged = { ...src, ...(pricing.adPricing || {}) };
        if (Object.keys(merged).length > Object.keys(pricing.adPricing || {}).length) {
          pricing.adPricing = merged;
          await pricing.save();
          updated++;
        }
      }
    }
    console.log(`Backfill done. Created: ${created}, Updated: ${updated}`);
    await sequelize.close();
  } catch (err) {
    console.error('Backfill error:', err);
    process.exitCode = 1;
    try { await sequelize.close(); } catch {}
  }
}

main();
