const db = require('./src/models');
const bcrypt = require('bcryptjs');
const { seedLocations } = require('./src/controllers/seedLocations');

async function seed() {
  await db.sequelize.sync({ force: true });
  await seedLocations();

  const india = await db.Country.findOne({ where: { code2: 'IN' } });
  const telangana = await db.State.findOne({ where: { code: 'TG' } });
  const andhra = await db.State.findOne({ where: { code: 'AP' } });
  const hyderabadDistrict = telangana
    ? await db.District.findOne({ where: { stateId: telangana.id, name: 'Hyderabad' } })
    : null;

  if (!india || !telangana) {
    throw new Error('Seed locations missing India/Telangana. Check src/data/countries.json and src/data/states_IN.json');
  }
  if (!hyderabadDistrict) {
    throw new Error('Seed locations missing Hyderabad district for Telangana. Check src/data/districts_TG.json');
  }
  // Seed languages table from static data
  try {
    const langs = require('./src/data/languages.json');
    await db.Language.bulkCreate(langs, { ignoreDuplicates: true });
    console.log(`Seeded languages: ${langs.length}`);
  } catch (e) { console.warn('Languages seed skipped:', e.message); }
  const pw = await bcrypt.hash('password', 10);
  // Seed roles
  const roleAdmin = await db.Role.findOrCreate({ where: { key: 'admin' }, defaults: { name: 'Admin' } }).then(r=>r[0]);
  const roleBrand = await db.Role.findOrCreate({ where: { key: 'brand' }, defaults: { name: 'Brand' } }).then(r=>r[0]);
  const roleInfluencer = await db.Role.findOrCreate({ where: { key: 'influencer' }, defaults: { name: 'Influencer' } }).then(r=>r[0]);

  const admin = await db.User.create({ name:'Admin', email:'admin@kaburlu.test', phone:'1111111111', passwordHash: pw, role:'admin' });
  await db.UserRole.create({ userId: admin.id, roleId: roleAdmin.id });

  const brandUser = await db.User.create({ name:'Demo Brand', email:'brand@kaburlu.test', phone:'9999999999', passwordHash: pw, role:'brand' });
  await db.UserRole.create({ userId: brandUser.id, roleId: roleBrand.id });
  const brand = await db.Brand.create({ userId: brandUser.id, companyName:'Demo Brand' });
  const influencerUser = await db.User.create({ name:'Demo Influencer', email:'influencer@kaburlu.test', phone:'8888888888', passwordHash: pw, role:'influencer' });
  await db.UserRole.create({ userId: influencerUser.id, roleId: roleInfluencer.id });
  const influencer = await db.Influencer.create({
    userId: influencerUser.id,
    handle: '@demo',
    countryId: india.id,
    stateId: telangana.id,
    stateIds: [telangana.id].concat(andhra ? [andhra.id] : []),
    districtId: hyderabadDistrict.id,
    addressLine1: 'Flat 12, Sunrise Residency',
    addressLine2: 'Madhapur, Near Metro',
    postalCode: '500081',
    states: ['Telangana'],
    languages: ['Telugu', 'English'],
    socialLinks: { instagram: '@demo', youtube: 'https://youtube.com/@demo' },
    followers: { instagram: 15000 },
    bio: 'Sample influencer for testing dashboards and APIs.',
    adPricing: {
      instagramPost: 5000,
      instagramStory: 2500,
      instagramReel: 8000,
      youtubeShort: 10000,
      youtubeIntegration: 25000,
      travelAllowancePerDay: 2000,
      negotiable: true
    },
    verificationStatus: 'green-tick',
    badges: ['top-creator']
  });
  // Seed categories and link to influencer
  const categories = [
    { name: 'Tech', type: 'domain', purpose: 'Gadgets & Software' },
    { name: 'Fashion', type: 'lifestyle', purpose: 'Apparel & Accessories' },
    { name: 'Food', type: 'lifestyle', purpose: 'Cuisine & Reviews' },
    { name: 'Travel', type: 'lifestyle', purpose: 'Destinations & Tips' },
    { name: 'Education', type: 'knowledge', purpose: 'Learning & Tutorials' }
  ];
  try {
    const createdCats = await db.Category.bulkCreate(categories);
    await influencer.addCategories(createdCats.map(c => c.id));
    console.log(`Seeded categories: ${createdCats.length}`);
  } catch (e) { console.warn('Categories seed skipped:', e.message); }
  const ad = await db.Ad.create({ brandId: brand.id, title:'Demo Ad All India', description:'Promote product', targetStates:['Telangana','Andhra Pradesh'], language:'Telugu', deliverableType:'reel', payPerInfluencer:1200, budget:12000, deadline: new Date(Date.now()+7*24*3600*1000) });
  // Super Admin default login
  const superMpinHash = await bcrypt.hash('199229', 10);
  await db.User.findOrCreate({
    where: { phone: '8282868389' },
    defaults: { name: 'Super Admin', email: 'superadmin@kaburlu.test', phone: '8282868389', passwordHash: superMpinHash, role: 'admin' }
  });
  // Ensure ULIDs exist for all core tables (in case of legacy rows)
  const { ulid } = require('ulid');
  const brands = await db.Brand.findAll({ where: { ulid: null } });
  for (const b of brands) { b.ulid = ulid(); await b.save(); }
  const influencers = await db.Influencer.findAll({ where: { ulid: null } });
  for (const i of influencers) { i.ulid = ulid(); await i.save(); }
  const ads = await db.Ad.findAll({ where: { ulid: null } });
  for (const a of ads) { a.ulid = ulid(); await a.save(); }
  console.log('Seeded demo data');
  process.exit(0);
}

seed();
