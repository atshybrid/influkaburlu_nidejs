"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // BrandMembers table
    try {
      await queryInterface.describeTable('BrandMembers');
    } catch (e) {
      await queryInterface.createTable('BrandMembers', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        brandId: { type: Sequelize.INTEGER, allowNull: false },
        userId: { type: Sequelize.INTEGER, allowNull: false },
        memberRole: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'pr' },
        isPrimary: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        createdByUserId: { type: Sequelize.INTEGER, allowNull: true },
        meta: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
      try {
        await queryInterface.sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS "BrandMembers_brand_user_unique" ON "BrandMembers"("brandId", "userId")');
      } catch (_) {}
      try {
        await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS "BrandMembers_brandId_idx" ON "BrandMembers"("brandId")');
      } catch (_) {}
      try {
        await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS "BrandMembers_userId_idx" ON "BrandMembers"("userId")');
      } catch (_) {}
    }

    // PrCommissions table
    try {
      await queryInterface.describeTable('PrCommissions');
    } catch (e) {
      await queryInterface.createTable('PrCommissions', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        prUserId: { type: Sequelize.INTEGER, allowNull: false },
        brandId: { type: Sequelize.INTEGER, allowNull: false },
        adId: { type: Sequelize.INTEGER, allowNull: true },
        applicationId: { type: Sequelize.INTEGER, allowNull: true },
        payoutId: { type: Sequelize.INTEGER, allowNull: true },
        amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
        status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'earned' },
        meta: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
      try {
        await queryInterface.sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS "PrCommissions_pr_payout_unique" ON "PrCommissions"("prUserId", "payoutId")');
      } catch (_) {}
      try {
        await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS "PrCommissions_brandId_idx" ON "PrCommissions"("brandId")');
      } catch (_) {}
      try {
        await queryInterface.sequelize.query('CREATE INDEX IF NOT EXISTS "PrCommissions_prUserId_idx" ON "PrCommissions"("prUserId")');
      } catch (_) {}
    }

    // Ads fields (controller already writes these; ensure columns exist without data loss)
    let adsTable;
    try {
      adsTable = await queryInterface.describeTable('Ads');
    } catch (e) {
      adsTable = null;
    }

    if (adsTable) {
      const addIfMissing = async (name, def) => {
        if (!adsTable[name]) await queryInterface.addColumn('Ads', name, def);
      };

      await addIfMissing('categories', { type: Sequelize.JSONB, defaultValue: [] });
      await addIfMissing('adTypes', { type: Sequelize.JSONB, defaultValue: [] });
      await addIfMissing('deliverables', { type: Sequelize.JSONB, defaultValue: [] });
      await addIfMissing('briefUrl', { type: Sequelize.STRING });
      await addIfMissing('mediaRefs', { type: Sequelize.JSONB, defaultValue: [] });
      await addIfMissing('timeline', { type: Sequelize.JSONB, defaultValue: {} });
      await addIfMissing('budgetPaid', { type: Sequelize.BOOLEAN, defaultValue: false });
      await addIfMissing('transactionId', { type: Sequelize.STRING });
      await addIfMissing('createdByUserId', { type: Sequelize.INTEGER });
      await addIfMissing('updatedByUserId', { type: Sequelize.INTEGER });
    }
  },

  async down(queryInterface, Sequelize) {
    // Best-effort rollback. (In production, prefer additive migrations.)
    try { await queryInterface.dropTable('PrCommissions'); } catch (_) {}
    try { await queryInterface.dropTable('BrandMembers'); } catch (_) {}

    try {
      const adsTable = await queryInterface.describeTable('Ads');
      const dropIfExists = async (name) => {
        if (adsTable[name]) await queryInterface.removeColumn('Ads', name);
      };
      await dropIfExists('categories');
      await dropIfExists('adTypes');
      await dropIfExists('deliverables');
      await dropIfExists('briefUrl');
      await dropIfExists('mediaRefs');
      await dropIfExists('timeline');
      await dropIfExists('budgetPaid');
      await dropIfExists('transactionId');
      await dropIfExists('createdByUserId');
      await dropIfExists('updatedByUserId');
    } catch (_) {}
  }
};
