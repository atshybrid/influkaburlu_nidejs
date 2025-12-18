# kaburlu-backend-v2
Kaburlu backend (Node.js + Express + Sequelize).

## Setup

1. Install dependencies: `npm install`
2. Configure PostgreSQL `DATABASE_URL` with SSL (Neon recommended).
3. Create a `.env` file (see notes below).
4. Run migrations and seeds as needed.

## Development

Start the server:

```bash
npm install
npm run dev
```

Swagger docs: `http://localhost:4000/api-docs`

## Prisma (optional, alongside Sequelize)

This repo uses Sequelize today, but Prisma can be used alongside it for queries.

- Base schema added at `prisma/schema.prisma`.
- To introspect the current DB and generate Prisma models:

```powershell
npm install prisma @prisma/client @prisma/config
npx prisma db pull
npx prisma generate
```

- You can then import and use the Prisma client:

```js
const { PrismaClient } = require('@prisma/client');
// For Prisma 7, pass adapter/Accelerate via client options if used.
const prisma = new PrismaClient();
// example
const users = await prisma.Users.findMany();
```

Note: Keep Sequelize as the primary ORM until we migrate endpoints.

## Secret Management

- Do not commit `.env` files. `.gitignore` excludes `.env` and `.env.*`.
- Use test-mode credentials in development:
	- Razorpay: set `RAZORPAY_KEY_ID=rzp_test_...` and `RAZORPAY_KEY_SECRET=...`.
	- OpenAI and Cloudflare R2 keys: set locally via `.env`; use host-level secrets in production.
- The server blocks startup if it detects a LIVE Razorpay key (`rzp_live_...`) while `NODE_ENV=development` to prevent accidental live transactions.
- On startup, the app logs masked presence of keys without exposing values.

### Rotating Secrets

- If secrets are exposed or shared, rotate them immediately in the provider dashboards (Razorpay/OpenAI/Cloudflare), then update your local `.env`.
- Prefer environment injection in production (CI/host secrets, container env vars) over bundling `.env` files.

## DB Migrations: No-Data-Loss Rules

When adding new features, **never lose existing production data**. Follow these rules every time you change the database.

### Safe changes (additive)

These are generally safe and do not delete existing rows:

- `ADD COLUMN` (prefer nullable first)
- `CREATE TABLE`
- `CREATE INDEX`
- `ADD CONSTRAINT` (only if it will not fail on existing rows)

### Risky changes (can cause data loss)

Avoid these unless you intentionally planned a data migration + backup:

- `DROP TABLE`, `DROP COLUMN`
- `TRUNCATE`
- destructive sync like `sequelize.sync({ force: true })`
- making a column `NOT NULL` without backfilling existing rows
- adding a `UNIQUE` constraint where existing data may violate it

### Best-practice pattern for new fields

1. Add the column **nullable** (or with a safe default)
2. Backfill data (optional)
3. Only then add `NOT NULL` / `UNIQUE` constraints (optional)

### Quick checklist before deploy

- Confirm migration is **additive** (no `dropTable/removeColumn/truncate/force`)
- If adding `UNIQUE` / FK constraints, confirm existing rows will pass
- Ensure migrations are tested on a copy/staging DB first

Note: `down()` migrations may drop newly-added schema. In production, we typically **do not run down()** unless we intentionally roll back.
