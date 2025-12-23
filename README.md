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

## WhatsApp OTP (Cloud API)

This backend can deliver OTP via WhatsApp Cloud API when `OTP_DELIVERY_CHANNEL=whatsapp`.

Required:

- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_API_VERSION` (optional; defaults to `v19.0`)

Templates (best-practice):

- Generic OTP flow (signup/linking):
	- `WHATSAPP_OTP_TEMPLATE_NAME`
	- `WHATSAPP_OTP_TEMPLATE_LANG` (optional; default `en_US`)
	- `WHATSAPP_OTP_TEMPLATE_MODE` (optional; default `otp_only`)
	- `WHATSAPP_OTP_INCLUDE_BUTTON_URL` (optional; default `false`)
- MPIN reset flow:
	- `WHATSAPP_MPIN_RESET_TEMPLATE_NAME`
	- `WHATSAPP_MPIN_RESET_TEMPLATE_LANG` (optional; default `en_US`)

## WhatsApp Webhook (Callback URL)

This backend exposes a WhatsApp Cloud API webhook endpoint for verification and delivery/status callbacks.

- Callback URL: `https://<your-domain>/webhook/whatsapp`
- Verification (GET): used by Meta to verify your endpoint (must match `WEBHOOK_VERIFY_TOKEN`)
- Notifications (POST): receives message delivery/read/failed status and incoming messages (if enabled in Meta)

Required env:

- `WEBHOOK_VERIFY_TOKEN` (a secret string you choose in Meta Webhooks settings)
- `WHATSAPP_APP_SECRET` (recommended; used to validate `X-Hub-Signature-256` on POST callbacks)
	- Alternative env name supported: `META_APP_SECRET`

Notes:

- If `WHATSAPP_OTP_TEMPLATE_*` is not set, the server falls back to `WHATSAPP_MPIN_RESET_TEMPLATE_*` so production can keep working with a single approved template.
- Phone numbers are normalized to WhatsApp international digits-only format; common inputs like `+91xxxxxxxxxx`, `91xxxxxxxxxx`, `0xxxxxxxxxx`, `091xxxxxxxxxx`, `0091xxxxxxxxxx` are accepted.

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
