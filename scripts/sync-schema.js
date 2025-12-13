require('dotenv').config();
const db = require('../src/models');

async function main() {
  try {
    await db.sequelize.authenticate();
    // Create all tables based on current Sequelize models
    await db.sequelize.sync({ force: true });
    console.log('Sequelize sync complete: all tables created in public schema');
    process.exit(0);
  } catch (e) {
    console.error('Schema sync error:', e.message);
    process.exit(1);
  }
}

main();
