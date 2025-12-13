"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create table if not exists (Postgres safe approach: try/catch describe)
    const tableName = 'languages';
    try {
      const exists = await queryInterface.describeTable(tableName).then(()=>true).catch(()=>false);
      if (exists) return;
    } catch (_) {}

    await queryInterface.createTable(tableName, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      code: { type: Sequelize.STRING(10), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(100), allowNull: false }
    });

    await queryInterface.addIndex(tableName, ['code'], { unique: true, name: 'languages_code_unique' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('languages');
  }
};
