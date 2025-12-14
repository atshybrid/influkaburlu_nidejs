require('dotenv').config();
const db = require('../src/models');

async function reset() {
  const { sequelize } = db;
  const qi = sequelize.getQueryInterface();
  const tables = [
    'UserRoles','Roles','RefreshTokens','OtpRequests','Applications','Payouts','Ads','Influencers','Brands','Users',
    'Languages','Districts','States','Countries'
  ];
  for (const t of tables) {
    try {
      await sequelize.query(`TRUNCATE TABLE "${t}" RESTART IDENTITY CASCADE;`);
      console.log('Truncated', t);
    } catch (e) {
      console.warn('Skip truncate', t, e.message);
    }
  }
}

async function main() {
  try {
    await db.sequelize.authenticate();
    await reset();
    // Run seeds
    try {
      await require('../scripts/seed-languages');
    } catch (e) {
      console.warn('seed-languages script finished or not found:', e.message);
    }
    try {
      await require('../seed');
    } catch (e) {
      console.warn('seed script finished or not found:', e.message);
    }
    console.log('Reset and seed complete');
    process.exit(0);
  } catch (err) {
    console.error('Reset error', err);
    process.exit(1);
  }
}

main();
