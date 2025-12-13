"use strict";

/**
 * Restart sequences so auto-increment IDs start at 1000 for all primary-key sequences.
 * This affects newly inserted rows; existing rows remain unchanged.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = [
      'Users', 'Brands', 'Influencers', 'Ads', 'Applications', 'Payouts',
      'Roles', 'UserRoles', 'RefreshTokens', 'OtpRequests',
      'Languages', 'Countries', 'States', 'Districts'
    ];

    for (const table of tables) {
      // Skip tables without an "id" column (e.g., join tables with composite PKs)
      const [cols] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND column_name = 'id'`
      );
      const hasId = Array.isArray(cols) && cols.length > 0;
      if (!hasId) continue;
      // Find the sequence backing the "id" column; restart it to 1000.
      // pg_get_serial_sequence returns null if the column is not a serial/identity.
      const [result] = await queryInterface.sequelize.query(
        `SELECT pg_get_serial_sequence('"${table}"','id') AS seq;`
      );
      const seq = result && result[0] && result[0].seq;
      if (seq) {
        // Ensure next value will be 1000 even if rows already exist
        // setval(seq, 999) with is_called=true makes nextval() return 1000
        await queryInterface.sequelize.query(`SELECT setval('${seq}', 999, true);`);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const tables = [
      'Users', 'Brands', 'Influencers', 'Ads', 'Applications', 'Payouts',
      'Roles', 'UserRoles', 'RefreshTokens', 'OtpRequests',
      'Languages', 'Countries', 'States', 'Districts'
    ];
    for (const table of tables) {
      const [cols] = await queryInterface.sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND column_name = 'id'`
      );
      const hasId = Array.isArray(cols) && cols.length > 0;
      if (!hasId) continue;
      const [result] = await queryInterface.sequelize.query(
        `SELECT pg_get_serial_sequence('"${table}"','id') AS seq;`
      );
      const seq = result && result[0] && result[0].seq;
      if (seq) {
        await queryInterface.sequelize.query(`SELECT setval('${seq}', 1, false);`);
      }
    }
  }
};
