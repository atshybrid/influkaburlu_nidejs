"use strict";

module.exports = {
  async up(queryInterface) {
    // Add enum value for Users.role = 'dop' (Director of Photography) (Postgres)
    // Note: ALTER TYPE ... ADD VALUE cannot be easily reversed.
    // Best-effort: do nothing on non-Postgres or if type/value already exists.
    try {
      await queryInterface.sequelize.query(`ALTER TYPE "enum_Users_role" ADD VALUE IF NOT EXISTS 'dop'`);
    } catch (e) {
      // ignore
    }
  },

  async down() {
    // No-op (Postgres enums can't easily drop a single value safely)
  }
};
