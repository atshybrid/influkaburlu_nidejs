/*
  Ensures the default Super Admin user is truly superadmin.
  - Does NOT drop data
  - Sets Users.role = 'superadmin'
  - Ensures Role(key='superadmin') exists
  - Ensures UserRole mapping exists

  Usage:
    npx ts-node scripts/ensure-superadmin.ts

  Optional env overrides:
    SUPERADMIN_PHONE=8282868389 SUPERADMIN_EMAIL=superadmin@kaburlu.test
*/

const db = require('../src/models');

async function ensureUserRoleEnumHasSuperadmin() {
  // Postgres stores this as enum_Users_role by default for Sequelize enums.
  // Add the value in a safe, best-effort way.
  try {
    await db.sequelize.query(`ALTER TYPE "enum_Users_role" ADD VALUE IF NOT EXISTS 'superadmin'`);
  } catch (e: any) {
    // If we're not on Postgres, or the enum type name differs, ignore.
    // The subsequent user.save() will still fail with a useful error.
  }
}

async function main() {
  const phone = String(process.env.SUPERADMIN_PHONE || '8282868389').trim();
  const email = String(process.env.SUPERADMIN_EMAIL || 'superadmin@kaburlu.test').trim();

  if (!phone && !email) {
    throw new Error('SUPERADMIN_PHONE or SUPERADMIN_EMAIL is required');
  }

  const [roleSuperadmin] = await db.Role.findOrCreate({
    where: { key: 'superadmin' },
    defaults: { key: 'superadmin', name: 'Superadmin' },
  });

  await ensureUserRoleEnumHasSuperadmin();

  const where: any = phone ? { phone } : { email };
  const user = await db.User.findOne({ where });
  if (!user) {
    throw new Error(`User not found for ${phone ? `phone=${phone}` : `email=${email}`}`);
  }

  const beforeRole = user.role;
  if (user.role !== 'superadmin') {
    user.role = 'superadmin';
    await user.save();
  }

  await db.UserRole.findOrCreate({
    where: { userId: user.id, roleId: roleSuperadmin.id },
    defaults: { userId: user.id, roleId: roleSuperadmin.id },
  });

  console.log(JSON.stringify({
    ok: true,
    userId: user.id,
    phone: user.phone || null,
    email: user.email || null,
    roleBefore: beforeRole,
    roleAfter: user.role,
    ensuredRoleKey: roleSuperadmin.key,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('ensure-superadmin failed:', err?.message || err);
    process.exit(1);
  });
