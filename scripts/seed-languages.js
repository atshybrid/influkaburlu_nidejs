require('dotenv').config();
const db = require('../src/models');

async function run() {
  try {
    const langs = require('../src/data/languages.json');
    await db.sequelize.authenticate();
    await db.Language.bulkCreate(langs, { ignoreDuplicates: true });
    console.log(`Inserted/kept ${langs.length} languages.`);
    process.exit(0);
  } catch (e) {
    console.error('Language seed error:', e.message);
    process.exit(1);
  }
}

run();
