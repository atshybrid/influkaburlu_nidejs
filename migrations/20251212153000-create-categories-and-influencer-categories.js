"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('SET search_path TO public;');
    await queryInterface.createTable('Categories', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, allowNull: false },
      type: { type: Sequelize.STRING },
      purpose: { type: Sequelize.STRING },
      description: { type: Sequelize.TEXT },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') }
    });

    await queryInterface.createTable('InfluencerCategories', {
      influencerId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Influencers', key: 'id' }, onDelete: 'CASCADE' },
      categoryId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Categories', key: 'id' }, onDelete: 'CASCADE' },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') }
    });

    await queryInterface.addConstraint('InfluencerCategories', {
      fields: ['influencerId', 'categoryId'],
      type: 'primary key',
      name: 'pk_influencer_categories'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('InfluencerCategories');
    await queryInterface.dropTable('Categories');
  }
};
