"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('SET search_path TO public;');

    // Influencers: referral + badge progress
    await queryInterface.addColumn('Influencers', 'referralCode', {
      type: Sequelize.STRING(32),
      allowNull: true,
    });

    await queryInterface.addColumn('Influencers', 'referredByInfluencerId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Influencers', key: 'id' },
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('Influencers', 'referralLinkedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('Influencers', 'completedAdsCount', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    // Unique referral codes (best-effort; allows multiple NULL)
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "Influencers_referralCode_unique" ON "Influencers"("referralCode") WHERE "referralCode" IS NOT NULL'
    );

    // Referral commissions ledger (earned from platform commission share)
    await queryInterface.createTable('ReferralCommissions', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      referrerInfluencerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Influencers', key: 'id' },
        onDelete: 'CASCADE',
      },
      sourceInfluencerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Influencers', key: 'id' },
        onDelete: 'CASCADE',
      },
      payoutId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Payouts', key: 'id' },
        onDelete: 'SET NULL',
      },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'earned' },
      meta: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });

    // Prevent duplicate commission creation on retries
    await queryInterface.addConstraint('ReferralCommissions', {
      fields: ['referrerInfluencerId', 'payoutId'],
      type: 'unique',
      name: 'uq_referral_commissions_referrer_payout',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('SET search_path TO public;');
    await queryInterface.dropTable('ReferralCommissions');
    await queryInterface.removeColumn('Influencers', 'completedAdsCount');
    await queryInterface.removeColumn('Influencers', 'referralLinkedAt');
    await queryInterface.removeColumn('Influencers', 'referredByInfluencerId');
    await queryInterface.removeColumn('Influencers', 'referralCode');
  },
};
