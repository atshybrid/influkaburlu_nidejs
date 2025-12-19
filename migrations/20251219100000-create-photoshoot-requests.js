'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('PhotoshootRequests', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      ulid: { type: Sequelize.STRING(26), allowNull: false, unique: true },

      influencerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Influencers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'pending' },
      details: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },

      requestedStartAt: { type: Sequelize.DATE, allowNull: true },
      requestedEndAt: { type: Sequelize.DATE, allowNull: true },
      requestedTimezone: { type: Sequelize.STRING(64), allowNull: true },

      scheduledStartAt: { type: Sequelize.DATE, allowNull: true },
      scheduledEndAt: { type: Sequelize.DATE, allowNull: true },
      scheduledTimezone: { type: Sequelize.STRING(64), allowNull: true },

      location: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },

      rejectReason: { type: Sequelize.TEXT, allowNull: true },
      adminNotes: { type: Sequelize.TEXT, allowNull: true },

      approvedByUserId: { type: Sequelize.INTEGER, allowNull: true },
      approvedAt: { type: Sequelize.DATE, allowNull: true },

      scheduledByUserId: { type: Sequelize.INTEGER, allowNull: true },
      scheduledAt: { type: Sequelize.DATE, allowNull: true },

      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('PhotoshootRequests', ['influencerId']);
    await queryInterface.addIndex('PhotoshootRequests', ['status']);
    await queryInterface.addIndex('PhotoshootRequests', ['requestedStartAt']);
    await queryInterface.addIndex('PhotoshootRequests', ['scheduledStartAt']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('PhotoshootRequests');
  },
};
