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
