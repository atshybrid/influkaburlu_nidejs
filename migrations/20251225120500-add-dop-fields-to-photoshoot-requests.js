"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // PhotoshootRequests may already exist in some environments.
    // Add columns best-effort; ignore if already present.
    const add = async (name, spec) => {
      try {
        await queryInterface.addColumn('PhotoshootRequests', name, spec);
      } catch (_) {
        // ignore
      }
    };

    await add('dopUserId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await add('dopAssignedByUserId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await add('dopAssignedAt', { type: Sequelize.DATE, allowNull: true });

    await add('rawMedia', { type: Sequelize.JSONB, allowNull: false, defaultValue: [] });
    await add('finalMedia', { type: Sequelize.JSONB, allowNull: false, defaultValue: [] });

    await add('rawUploadedByUserId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await add('rawUploadedAt', { type: Sequelize.DATE, allowNull: true });

    await add('finalUploadedByUserId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await add('finalUploadedAt', { type: Sequelize.DATE, allowNull: true });

    try {
      await queryInterface.addIndex('PhotoshootRequests', ['dopUserId']);
    } catch (_) {}
  },

  async down(queryInterface) {
    // Best-effort rollback (safe even if columns already removed)
    const remove = async (name) => {
      try {
        await queryInterface.removeColumn('PhotoshootRequests', name);
      } catch (_) {
        // ignore
      }
    };

    await remove('finalUploadedAt');
    await remove('finalUploadedByUserId');
    await remove('rawUploadedAt');
    await remove('rawUploadedByUserId');
    await remove('finalMedia');
    await remove('rawMedia');
    await remove('dopAssignedAt');
    await remove('dopAssignedByUserId');
    await remove('dopUserId');
  },
};
