require('dotenv').config();
const db = require('../src/models');

async function main() {
  const { sequelize } = db;
  try {
    await sequelize.authenticate();
    await sequelize.query('CREATE SCHEMA IF NOT EXISTS public;');
    await sequelize.query('SET search_path TO public;');
    console.log('Public schema ensured and search_path set for session.');
    console.log('If migrations still fail, set a permanent default search_path on the role:');
    console.log('  ALTER ROLE neondb_owner IN DATABASE influkaburlu SET search_path = public;');
    process.exit(0);
  } catch (e) {
    console.error('Bootstrap error:', e.message);
    process.exit(1);
  }
}

main();
