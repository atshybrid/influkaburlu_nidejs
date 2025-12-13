"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add ulid column
    await queryInterface.addColumn('Users', 'ulid', {
      type: Sequelize.STRING(26),
      allowNull: true,
      unique: true,
    });
    // Backfill ulid values for existing rows
    const [rows] = await queryInterface.sequelize.query('SELECT id FROM "Users" WHERE ulid IS NULL');
    const { ulid } = require('ulid');
    for (const r of rows) {
      const idVal = ulid();
      await queryInterface.sequelize.query('UPDATE "Users" SET ulid = :val WHERE id = :id', { replacements: { val: idVal, id: r.id } });
    }
    // Make ulid not null after backfill
    await queryInterface.changeColumn('Users', 'ulid', {
      type: Sequelize.STRING(26),
      allowNull: false,
      unique: true,
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'ulid');
  }
};
