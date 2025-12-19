"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add ulid column (idempotent for environments where runtime ensure already added it)
    await queryInterface.sequelize.query(
      'ALTER TABLE "Influencers" ADD COLUMN IF NOT EXISTS "ulid" VARCHAR(26)'
    );

    // Backfill ulid values for existing rows
    const [rows] = await queryInterface.sequelize.query(
      'SELECT id FROM "Influencers" WHERE ulid IS NULL'
    );

    if (Array.isArray(rows) && rows.length > 0) {
      const { ulid } = require('ulid');
      for (const r of rows) {
        // ULID collisions are astronomically unlikely, but we still keep it simple/robust.
        await queryInterface.sequelize.query(
          'UPDATE "Influencers" SET ulid = :val WHERE id = :id AND ulid IS NULL',
          { replacements: { val: ulid(), id: r.id } }
        );
      }
    }

    // Unique index (safe even if some rows are still NULL)
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "Influencers_ulid_unique" ON "Influencers"("ulid") WHERE "ulid" IS NOT NULL'
    );

    // Enforce NOT NULL after backfill
    await queryInterface.changeColumn('Influencers', 'ulid', {
      type: Sequelize.STRING(26),
      allowNull: false,
    });
  },

  async down(queryInterface) {
    // Drop index first, then column
    try {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS "Influencers_ulid_unique"');
    } catch (_) {}
    await queryInterface.removeColumn('Influencers', 'ulid');
  },
};
