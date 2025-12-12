const db = require('./src/models');
const bcrypt = require('bcryptjs');
const { seedLocations } = require('./src/controllers/seedLocations');

async function seed() {
  await db.sequelize.sync({ force: true });
  await seedLocations();
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
    countryId: 101,
    stateId: 36,
    stateIds: [36, 29],
    districtId: 540,
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
  const ad = await db.Ad.create({ brandId: brand.id, title:'Demo Ad All India', description:'Promote product', targetStates:['Telangana','Andhra Pradesh'], language:'Telugu', deliverableType:'reel', payPerInfluencer:1200, budget:12000, deadline: new Date(Date.now()+7*24*3600*1000) });
  // Super Admin default login
  const superMpinHash = await bcrypt.hash('199229', 10);
  await db.User.findOrCreate({
    where: { phone: '8282868389' },
    defaults: { name: 'Super Admin', email: 'superadmin@kaburlu.test', phone: '8282868389', passwordHash: superMpinHash, role: 'admin' }
  });
  console.log('Seeded demo data');
  process.exit(0);
}

seed();
