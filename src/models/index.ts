const path = require('path');
try {
	// Optional: production hosts (e.g., Render) typically inject env vars.
	// Don't crash if dotenv isn't installed or .env isn't present.
	require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
} catch (e) {
	// noop
}
const { Sequelize } = require('sequelize');

// Auto-detect SSL requirement from DATABASE_URL or PGSSL env
const dbUrl = process.env.DATABASE_URL || '';
const needsSSL = process.env.PGSSL === 'true' || dbUrl.includes('sslmode=require') || dbUrl.includes('neon.tech');

const commonOpts = { 
	logging: false,
	pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
	dialect: 'postgres',
	dialectOptions: {
		// For pg driver
		statement_timeout: parseInt(process.env.PG_STATEMENT_TIMEOUT_MS || '0', 10) || undefined,
		idle_in_transaction_session_timeout: parseInt(process.env.PG_IDLE_TX_TIMEOUT_MS || '0', 10) || undefined,
		connectTimeout: parseInt(process.env.PG_CONNECT_TIMEOUT_MS || '30000', 10),
		connectionTimeoutMillis: parseInt(process.env.PG_CONNECT_TIMEOUT_MS || '30000', 10),
		ssl: needsSSL ? { require: true, rejectUnauthorized: false } : undefined
	}
};

let sequelize;
if (process.env.DATABASE_URL) {
	sequelize = new Sequelize(process.env.DATABASE_URL, commonOpts);
} else {
	const db = process.env.DB_NAME || 'kaburlu';
	const user = process.env.DB_USER || 'postgres';
	const pass = process.env.DB_PASS || 'postgres';
	const host = process.env.DB_HOST || '127.0.0.1';
	const port = parseInt(process.env.DB_PORT || '5432', 10);
	sequelize = new Sequelize(db, user, pass, { host, port, ...commonOpts });
}

const User = require('./user')(sequelize, Sequelize.DataTypes);
const Influencer = require('./influencer')(sequelize, Sequelize.DataTypes);
const Brand = require('./brand')(sequelize, Sequelize.DataTypes);
const Ad = require('./ad')(sequelize, Sequelize.DataTypes);
const Application = require('./application')(sequelize, Sequelize.DataTypes);
const Post = require('./post')(sequelize, Sequelize.DataTypes);
const Payout = require('./payout')(sequelize, Sequelize.DataTypes);
const Language = require('./language')(sequelize, Sequelize.DataTypes);
const Category = require('./category')(sequelize, Sequelize.DataTypes);
const OtpRequest = require('./otpRequest')(sequelize, Sequelize.DataTypes);
const RefreshToken = require('./refreshToken')(sequelize, Sequelize.DataTypes);
const InfluencerAdMedia = require('./influencerAdMedia')(sequelize, Sequelize.DataTypes);
const InfluencerPricing = require('./influencerPricing')(sequelize, Sequelize.DataTypes);
const InfluencerKyc = require('./influencerKyc')(sequelize, Sequelize.DataTypes);
const InfluencerPaymentMethod = require('./influencerPaymentMethod')(sequelize, Sequelize.DataTypes);
const ProfilePack = require('./profilePack')(sequelize, Sequelize.DataTypes);
const LandingContent = require('./landingContent')(sequelize, Sequelize.DataTypes);
const SeoPage = require('./seoPage')(sequelize, Sequelize.DataTypes);
const ReferralCommission = require('./referralCommission')(sequelize, Sequelize.DataTypes);
const BrandMember = require('./brandMember')(sequelize, Sequelize.DataTypes);
const PrCommission = require('./prCommission')(sequelize, Sequelize.DataTypes);
const PhotoshootRequest = require('./photoshootRequest')(sequelize, Sequelize.DataTypes);
const { Country, State, District } = require('./location')(sequelize, Sequelize.DataTypes);
const { Role, UserRole } = require('./role')(sequelize, Sequelize.DataTypes);

async function ensureInfluencerBadgeColumns() {
	const qi = sequelize.getQueryInterface();
	try {
		// Postgres-safe add columns if not exist
		await sequelize.query('ALTER TABLE "Influencers" ADD COLUMN IF NOT EXISTS "verificationStatus" VARCHAR(32) DEFAULT \'none\'');
		await sequelize.query('ALTER TABLE "Influencers" ADD COLUMN IF NOT EXISTS "badges" JSONB DEFAULT \'[]\'::jsonb');
	} catch (e) {
		// noop: older PG might not support IF NOT EXISTS; fallback checks
		try {
			const table = await qi.describeTable('Influencers');
			if (!table.verificationStatus) {
				await qi.addColumn('Influencers', 'verificationStatus', { type: Sequelize.DataTypes.STRING, defaultValue: 'none' });
			}
			if (!table.badges) {
				await qi.addColumn('Influencers', 'badges', { type: Sequelize.DataTypes.JSONB, defaultValue: [] });
			}
		} catch (_) {}
	}
}

ensureInfluencerBadgeColumns().catch(() => {});

async function ensureInfluencerAdPricingColumn() {
	const qi = sequelize.getQueryInterface();
	try {
		await sequelize.query(`ALTER TABLE "Influencers" ADD COLUMN IF NOT EXISTS "adPricing" JSONB DEFAULT '{}'::jsonb`);
	} catch (e) {
		try {
			const table = await qi.describeTable('Influencers');
			if (!table.adPricing) {
				await qi.addColumn('Influencers', 'adPricing', { type: Sequelize.DataTypes.JSONB, defaultValue: {} });
			}
		} catch (_) {}
	}
}

ensureInfluencerAdPricingColumn().catch(() => {});

async function ensureInfluencerSeoColumns() {
	const qi = sequelize.getQueryInterface();
	try {
		await sequelize.query('ALTER TABLE "Influencers" ADD COLUMN IF NOT EXISTS "seoTitle" VARCHAR(255)');
		await sequelize.query('ALTER TABLE "Influencers" ADD COLUMN IF NOT EXISTS "seoDescription" TEXT');
		await sequelize.query('ALTER TABLE "Influencers" ADD COLUMN IF NOT EXISTS "seoKeywords" TEXT');
		await sequelize.query('ALTER TABLE "Influencers" ADD COLUMN IF NOT EXISTS "slug" VARCHAR(255)');
		await sequelize.query('ALTER TABLE "Influencers" ADD COLUMN IF NOT EXISTS "canonicalUrl" VARCHAR(255)');
		await sequelize.query('ALTER TABLE "Influencers" ADD COLUMN IF NOT EXISTS "schemaJson" JSONB DEFAULT \'{}\'::jsonb');
		await sequelize.query('ALTER TABLE "Influencers" ADD COLUMN IF NOT EXISTS "indexed" BOOLEAN DEFAULT false');
		// Unique slug index (best-effort; allows multiple NULL)
		await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS "Influencers_slug_unique" ON "Influencers"("slug") WHERE "slug" IS NOT NULL');
	} catch (e) {
		try {
			const table = await qi.describeTable('Influencers');
			if (!table.seoTitle) await qi.addColumn('Influencers', 'seoTitle', { type: Sequelize.DataTypes.STRING(255) });
			if (!table.seoDescription) await qi.addColumn('Influencers', 'seoDescription', { type: Sequelize.DataTypes.TEXT });
			if (!table.seoKeywords) await qi.addColumn('Influencers', 'seoKeywords', { type: Sequelize.DataTypes.TEXT });
			if (!table.slug) await qi.addColumn('Influencers', 'slug', { type: Sequelize.DataTypes.STRING(255) });
			if (!table.canonicalUrl) await qi.addColumn('Influencers', 'canonicalUrl', { type: Sequelize.DataTypes.STRING(255) });
			if (!table.schemaJson) await qi.addColumn('Influencers', 'schemaJson', { type: Sequelize.DataTypes.JSONB, defaultValue: {} });
			if (!table.indexed) await qi.addColumn('Influencers', 'indexed', { type: Sequelize.DataTypes.BOOLEAN, defaultValue: false });
		} catch (_) {}
	}
}

ensureInfluencerSeoColumns().catch(() => {});

async function ensureInfluencerProfilePicColumn() {
	const qi = sequelize.getQueryInterface();
	try {
		await sequelize.query('ALTER TABLE "Influencers" ADD COLUMN IF NOT EXISTS "profilePicUrl" VARCHAR(512)');
	} catch (e) {
		try {
			const table = await qi.describeTable('Influencers');
			if (!table.profilePicUrl) {
				await qi.addColumn('Influencers', 'profilePicUrl', { type: Sequelize.DataTypes.STRING });
			}
		} catch (_) {}
	}
}

ensureInfluencerProfilePicColumn().catch(() => {});

async function ensureInfluencerReferralColumns() {
	const qi = sequelize.getQueryInterface();
	try {
		await sequelize.query('ALTER TABLE "Influencers" ADD COLUMN IF NOT EXISTS "referralCode" VARCHAR(32)');
		await sequelize.query('ALTER TABLE "Influencers" ADD COLUMN IF NOT EXISTS "referredByInfluencerId" INTEGER');
		await sequelize.query('ALTER TABLE "Influencers" ADD COLUMN IF NOT EXISTS "referralLinkedAt" TIMESTAMP WITH TIME ZONE');
		await sequelize.query('ALTER TABLE "Influencers" ADD COLUMN IF NOT EXISTS "completedAdsCount" INTEGER DEFAULT 0');
		await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS "Influencers_referralCode_unique" ON "Influencers"("referralCode") WHERE "referralCode" IS NOT NULL');
	} catch (e) {
		try {
			const table = await qi.describeTable('Influencers');
			if (!table.referralCode) await qi.addColumn('Influencers', 'referralCode', { type: Sequelize.DataTypes.STRING(32) });
			if (!table.referredByInfluencerId) await qi.addColumn('Influencers', 'referredByInfluencerId', { type: Sequelize.DataTypes.INTEGER });
			if (!table.referralLinkedAt) await qi.addColumn('Influencers', 'referralLinkedAt', { type: Sequelize.DataTypes.DATE });
			if (!table.completedAdsCount) await qi.addColumn('Influencers', 'completedAdsCount', { type: Sequelize.DataTypes.INTEGER, defaultValue: 0 });
		} catch (_) {}
	}
}

ensureInfluencerReferralColumns().catch(() => {});

async function ensureInfluencerUlidColumn() {
	const qi = sequelize.getQueryInterface();
	const quoteIdent = (name) => '"' + String(name).replace(/"/g, '""') + '"';
	let tableName = 'Influencers';
	try {
		await qi.describeTable('Influencers');
	} catch (e) {
		try {
			await qi.describeTable('influencers');
			tableName = 'influencers';
		} catch (_) {
			// keep default; later operations will just no-op/fail silently
		}
	}
	const qTable = quoteIdent(tableName);
	try {
		await sequelize.query(`ALTER TABLE ${qTable} ADD COLUMN IF NOT EXISTS "ulid" VARCHAR(26)`);
	} catch (e) {
		try {
			const table = await qi.describeTable(tableName);
			if (!table.ulid) {
				await qi.addColumn(tableName, 'ulid', { type: Sequelize.DataTypes.STRING(26), allowNull: true });
			}
		} catch (_) {}
	}

	// Backfill ULIDs for existing rows (best-effort, avoids breaking auth/session flows).
	try {
		const [rows] = await sequelize.query(`SELECT "id" FROM ${qTable} WHERE "ulid" IS NULL`);
		if (Array.isArray(rows) && rows.length > 0) {
			const { ulid } = require('ulid');
			for (const r of rows) {
				const influencerId = r.id;
				if (!influencerId) continue;
				let assigned = false;
				for (let attempts = 0; attempts < 5 && !assigned; attempts++) {
					const value = ulid();
					try {
						await sequelize.query(`UPDATE ${qTable} SET "ulid" = :ulid WHERE "id" = :id AND "ulid" IS NULL`, {
							replacements: { ulid: value, id: influencerId }
						});
						assigned = true;
					} catch (_) {
						// retry on potential unique collisions
					}
				}
			}
		}
	} catch (_) {}

	// Unique index (allows multiple NULLs if any remain; safe to run repeatedly).
	try {
		const indexName = `${tableName}_ulid_unique`;
		await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS ${quoteIdent(indexName)} ON ${qTable}("ulid") WHERE "ulid" IS NOT NULL`);
	} catch (_) {}
}

// Exported so server can run this after DB connect (more reliable than one-time boot call).
module.exports.ensureInfluencerUlidColumn = ensureInfluencerUlidColumn;

// Best-effort early attempt (may fail if DB is not reachable yet).
ensureInfluencerUlidColumn().catch(() => {});

async function ensureReferralCommissionsTable() {
	const qi = sequelize.getQueryInterface();
	try {
		await qi.describeTable('ReferralCommissions');
	} catch (e) {
		await qi.createTable('ReferralCommissions', {
			id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
			referrerInfluencerId: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
			sourceInfluencerId: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
			payoutId: { type: Sequelize.DataTypes.INTEGER, allowNull: true },
			amount: { type: Sequelize.DataTypes.DECIMAL(12, 2), allowNull: false },
			status: { type: Sequelize.DataTypes.STRING(32), allowNull: false, defaultValue: 'earned' },
			meta: { type: Sequelize.DataTypes.JSONB, allowNull: false, defaultValue: {} },
			createdAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
			updatedAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
		});
		try {
			await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS "ReferralCommissions_referrer_payout_unique" ON "ReferralCommissions"("referrerInfluencerId", "payoutId")');
		} catch (_) {}
	}
}

ensureReferralCommissionsTable().catch(() => {});

async function ensureBrandMembersTable() {
	const qi = sequelize.getQueryInterface();
	try {
		await qi.describeTable('BrandMembers');
	} catch (e) {
		await qi.createTable('BrandMembers', {
			id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
			brandId: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
			userId: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
			memberRole: { type: Sequelize.DataTypes.STRING(32), allowNull: false, defaultValue: 'pr' },
			isPrimary: { type: Sequelize.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
			createdByUserId: { type: Sequelize.DataTypes.INTEGER, allowNull: true },
			meta: { type: Sequelize.DataTypes.JSONB, allowNull: false, defaultValue: {} },
			createdAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
			updatedAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
		});
		try {
			await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS "BrandMembers_brand_user_unique" ON "BrandMembers"("brandId", "userId")');
		} catch (_) {}
		try {
			await sequelize.query('CREATE INDEX IF NOT EXISTS "BrandMembers_brandId_idx" ON "BrandMembers"("brandId")');
		} catch (_) {}
		try {
			await sequelize.query('CREATE INDEX IF NOT EXISTS "BrandMembers_userId_idx" ON "BrandMembers"("userId")');
		} catch (_) {}
	}
}

ensureBrandMembersTable().catch(() => {});

async function ensurePrCommissionsTable() {
	const qi = sequelize.getQueryInterface();
	try {
		await qi.describeTable('PrCommissions');
	} catch (e) {
		await qi.createTable('PrCommissions', {
			id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
			prUserId: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
			brandId: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
			adId: { type: Sequelize.DataTypes.INTEGER, allowNull: true },
			applicationId: { type: Sequelize.DataTypes.INTEGER, allowNull: true },
			payoutId: { type: Sequelize.DataTypes.INTEGER, allowNull: true },
			amount: { type: Sequelize.DataTypes.DECIMAL(12, 2), allowNull: false },
			status: { type: Sequelize.DataTypes.STRING(32), allowNull: false, defaultValue: 'earned' },
			meta: { type: Sequelize.DataTypes.JSONB, allowNull: false, defaultValue: {} },
			createdAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
			updatedAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
		});
		try {
			await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS "PrCommissions_pr_payout_unique" ON "PrCommissions"("prUserId", "payoutId")');
		} catch (_) {}
		try {
			await sequelize.query('CREATE INDEX IF NOT EXISTS "PrCommissions_brandId_idx" ON "PrCommissions"("brandId")');
		} catch (_) {}
		try {
			await sequelize.query('CREATE INDEX IF NOT EXISTS "PrCommissions_prUserId_idx" ON "PrCommissions"("prUserId")');
		} catch (_) {}
	}
}

ensurePrCommissionsTable().catch(() => {});

async function ensurePhotoshootRequestsTable() {
	const qi = sequelize.getQueryInterface();
	try {
		await qi.describeTable('PhotoshootRequests');
	} catch (e) {
		await qi.createTable('PhotoshootRequests', {
			id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
			ulid: { type: Sequelize.DataTypes.STRING(26), allowNull: false, unique: true },
			influencerId: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
			status: { type: Sequelize.DataTypes.STRING(32), allowNull: false, defaultValue: 'pending' },
			details: { type: Sequelize.DataTypes.JSONB, allowNull: false, defaultValue: {} },
			requestedStartAt: { type: Sequelize.DataTypes.DATE, allowNull: true },
			requestedEndAt: { type: Sequelize.DataTypes.DATE, allowNull: true },
			requestedTimezone: { type: Sequelize.DataTypes.STRING(64), allowNull: true },
			scheduledStartAt: { type: Sequelize.DataTypes.DATE, allowNull: true },
			scheduledEndAt: { type: Sequelize.DataTypes.DATE, allowNull: true },
			scheduledTimezone: { type: Sequelize.DataTypes.STRING(64), allowNull: true },
			location: { type: Sequelize.DataTypes.JSONB, allowNull: false, defaultValue: {} },
			rejectReason: { type: Sequelize.DataTypes.TEXT, allowNull: true },
			adminNotes: { type: Sequelize.DataTypes.TEXT, allowNull: true },
			approvedByUserId: { type: Sequelize.DataTypes.INTEGER, allowNull: true },
			approvedAt: { type: Sequelize.DataTypes.DATE, allowNull: true },
			scheduledByUserId: { type: Sequelize.DataTypes.INTEGER, allowNull: true },
			scheduledAt: { type: Sequelize.DataTypes.DATE, allowNull: true },
			createdAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
			updatedAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
		});
		try {
			await sequelize.query('CREATE INDEX IF NOT EXISTS "PhotoshootRequests_influencerId_idx" ON "PhotoshootRequests"("influencerId")');
		} catch (_) {}
		try {
			await sequelize.query('CREATE INDEX IF NOT EXISTS "PhotoshootRequests_status_idx" ON "PhotoshootRequests"("status")');
		} catch (_) {}
	}

	// Schema evolution: add DOP fields if missing (best-effort)
	try {
		await sequelize.query('ALTER TABLE "PhotoshootRequests" ADD COLUMN IF NOT EXISTS "dopUserId" INTEGER');
		await sequelize.query('ALTER TABLE "PhotoshootRequests" ADD COLUMN IF NOT EXISTS "dopAssignedByUserId" INTEGER');
		await sequelize.query('ALTER TABLE "PhotoshootRequests" ADD COLUMN IF NOT EXISTS "dopAssignedAt" TIMESTAMP WITH TIME ZONE');
		await sequelize.query('ALTER TABLE "PhotoshootRequests" ADD COLUMN IF NOT EXISTS "rawMedia" JSONB DEFAULT \'[]\'::jsonb');
		await sequelize.query('ALTER TABLE "PhotoshootRequests" ADD COLUMN IF NOT EXISTS "finalMedia" JSONB DEFAULT \'[]\'::jsonb');
		await sequelize.query('ALTER TABLE "PhotoshootRequests" ADD COLUMN IF NOT EXISTS "rawUploadedByUserId" INTEGER');
		await sequelize.query('ALTER TABLE "PhotoshootRequests" ADD COLUMN IF NOT EXISTS "rawUploadedAt" TIMESTAMP WITH TIME ZONE');
		await sequelize.query('ALTER TABLE "PhotoshootRequests" ADD COLUMN IF NOT EXISTS "finalUploadedByUserId" INTEGER');
		await sequelize.query('ALTER TABLE "PhotoshootRequests" ADD COLUMN IF NOT EXISTS "finalUploadedAt" TIMESTAMP WITH TIME ZONE');
		await sequelize.query('CREATE INDEX IF NOT EXISTS "PhotoshootRequests_dopUserId_idx" ON "PhotoshootRequests"("dopUserId")');
	} catch (_) {}
}

ensurePhotoshootRequestsTable().catch(() => {});

async function ensureUserAuthColumns() {
	const qi = sequelize.getQueryInterface();
	try {
		await sequelize.query('ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "authProvider" VARCHAR(32)');
		await sequelize.query('ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "googleSub" VARCHAR(255)');
		await sequelize.query('ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "googlePictureUrl" VARCHAR(512)');
		await sequelize.query('ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN');
		// Best-effort unique index for googleSub (multiple NULLs allowed)
		await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS "Users_googleSub_unique" ON "Users"("googleSub") WHERE "googleSub" IS NOT NULL');
	} catch (e) {
		try {
			const table = await qi.describeTable('Users');
			if (!table.authProvider) {
				await qi.addColumn('Users', 'authProvider', { type: Sequelize.DataTypes.STRING });
			}
			if (!table.googleSub) {
				await qi.addColumn('Users', 'googleSub', { type: Sequelize.DataTypes.STRING });
			}
			if (!table.googlePictureUrl) {
				await qi.addColumn('Users', 'googlePictureUrl', { type: Sequelize.DataTypes.STRING });
			}
			if (!table.emailVerified) {
				await qi.addColumn('Users', 'emailVerified', { type: Sequelize.DataTypes.BOOLEAN });
			}
		} catch (_) {}
	}
}

// Exported so server can run this after DB connect (more reliable than one-time boot call).
module.exports.ensureUserAuthColumns = ensureUserAuthColumns;

// Best-effort early attempt (may fail if DB is not reachable yet).
ensureUserAuthColumns().catch(() => {});

async function ensureInfluencerAdMediaTable() {
	const qi = sequelize.getQueryInterface();
	try {
		await qi.describeTable('InfluencerAdMedia');
	} catch (e) {
		await qi.createTable('InfluencerAdMedia', {
			id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
			postId: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
			influencerId: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
			adId: { type: Sequelize.DataTypes.INTEGER, allowNull: true },
			provider: { type: Sequelize.DataTypes.STRING, allowNull: false, defaultValue: 'bunny' },
			guid: { type: Sequelize.DataTypes.STRING, allowNull: false, unique: true },
			playbackUrl: { type: Sequelize.DataTypes.STRING },
			thumbnailUrl: { type: Sequelize.DataTypes.STRING },
			status: { type: Sequelize.DataTypes.STRING, allowNull: false, defaultValue: 'created' },
			sizeBytes: { type: Sequelize.DataTypes.BIGINT },
			durationSec: { type: Sequelize.DataTypes.INTEGER },
			meta: { type: Sequelize.DataTypes.JSONB, defaultValue: {} },
			ulid: { type: Sequelize.DataTypes.STRING(26), allowNull: false, unique: true },
			createdAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
			updatedAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
		});
	}
}

ensureInfluencerAdMediaTable().catch(() => {});
async function ensureInfluencerKycTable() {
	const qi = sequelize.getQueryInterface();
	try { await qi.describeTable('InfluencerKyc'); }
	catch (e) {
		await qi.createTable('InfluencerKyc', {
			id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
			influencerId: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
			fullName: { type: Sequelize.DataTypes.STRING },
			dob: { type: Sequelize.DataTypes.DATEONLY },
			pan: { type: Sequelize.DataTypes.STRING },
			addressLine1: { type: Sequelize.DataTypes.STRING },
			addressLine2: { type: Sequelize.DataTypes.STRING },
			postalCode: { type: Sequelize.DataTypes.STRING },
			city: { type: Sequelize.DataTypes.STRING },
			state: { type: Sequelize.DataTypes.STRING },
			country: { type: Sequelize.DataTypes.STRING },
			status: { type: Sequelize.DataTypes.STRING, defaultValue: 'pending' },
			verifiedAt: { type: Sequelize.DataTypes.DATE },
			documents: { type: Sequelize.DataTypes.JSONB, defaultValue: {} },
			consentTs: { type: Sequelize.DataTypes.DATE },
			ulid: { type: Sequelize.DataTypes.STRING(26), allowNull: false, unique: true },
			createdAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
			updatedAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
		});
	}
	try {
		const t = await qi.describeTable('InfluencerKyc');
		if (!t.aadhaarHash) await qi.addColumn('InfluencerKyc', 'aadhaarHash', { type: Sequelize.DataTypes.STRING });
		if (!t.aadhaarLast4) await qi.addColumn('InfluencerKyc', 'aadhaarLast4', { type: Sequelize.DataTypes.STRING(4) });
	} catch (_) {}
}

async function ensureInfluencerPaymentMethodTable() {
	const qi = sequelize.getQueryInterface();
	try { await qi.describeTable('InfluencerPaymentMethod'); }
	catch (e) {
		await qi.createTable('InfluencerPaymentMethod', {
			id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
			influencerId: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
			type: { type: Sequelize.DataTypes.STRING, allowNull: false, defaultValue: 'bank' },
			isPreferred: { type: Sequelize.DataTypes.BOOLEAN, defaultValue: false },
			status: { type: Sequelize.DataTypes.STRING, defaultValue: 'unverified' },
			accountHolderName: { type: Sequelize.DataTypes.STRING },
			bankName: { type: Sequelize.DataTypes.STRING },
			bankIfsc: { type: Sequelize.DataTypes.STRING },
			bankAccountNumber: { type: Sequelize.DataTypes.STRING },
			upiId: { type: Sequelize.DataTypes.STRING },
			ulid: { type: Sequelize.DataTypes.STRING(26), allowNull: false, unique: true },
			createdAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
			updatedAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
		});
	}
}

ensureInfluencerKycTable().catch(() => {});
ensureInfluencerPaymentMethodTable().catch(() => {});

async function ensureLandingContentTable() {
	const qi = sequelize.getQueryInterface();
	try {
		await qi.describeTable('LandingContent');
	} catch (e) {
		await qi.createTable('LandingContent', {
			id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
			key: { type: Sequelize.DataTypes.STRING(64), allowNull: false, unique: true },
			data: { type: Sequelize.DataTypes.JSONB, defaultValue: {} },
			ulid: { type: Sequelize.DataTypes.STRING(26), allowNull: false, unique: true },
			createdAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
			updatedAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
		});
	}
}

ensureLandingContentTable().catch(() => {});

async function ensureSeoPagesTable() {
	const qi = sequelize.getQueryInterface();
	try {
		await qi.describeTable('SeoPages');
	} catch (e) {
		await qi.createTable('SeoPages', {
			id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
			slug: { type: Sequelize.DataTypes.STRING(255), allowNull: false, unique: true },
			metaTitle: { type: Sequelize.DataTypes.STRING(255) },
			metaDescription: { type: Sequelize.DataTypes.TEXT },
			metaKeywords: { type: Sequelize.DataTypes.TEXT },
			ogImage: { type: Sequelize.DataTypes.STRING(512) },
			ulid: { type: Sequelize.DataTypes.STRING(26), allowNull: false, unique: true },
			createdAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
			updatedAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
		});
	}
}

ensureSeoPagesTable().catch(() => {});

async function ensureInfluencerPricingTable() {
	const qi = sequelize.getQueryInterface();
	try {
		await qi.describeTable('InfluencerPricing');
	} catch (e) {
		await qi.createTable('InfluencerPricing', {
			id: { type: Sequelize.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
			influencerId: { type: Sequelize.DataTypes.INTEGER, allowNull: false },
			adPricing: { type: Sequelize.DataTypes.JSONB, defaultValue: {} },
			ulid: { type: Sequelize.DataTypes.STRING(26), allowNull: false, unique: true },
			createdAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
			updatedAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
		});
	}
}

ensureInfluencerPricingTable().catch(() => {});

User.hasOne(Influencer, { foreignKey: 'userId' });
Influencer.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(Brand, { foreignKey: 'userId' });
Brand.belongsTo(User, { foreignKey: 'userId' });

// Brand members (PR users are scoped to brands through this table)
Brand.hasMany(BrandMember, { foreignKey: 'brandId' });
BrandMember.belongsTo(Brand, { foreignKey: 'brandId' });
User.hasMany(BrandMember, { foreignKey: 'userId' });
BrandMember.belongsTo(User, { foreignKey: 'userId' });

Brand.hasMany(Ad, { foreignKey: 'brandId' });
Ad.belongsTo(Brand, { foreignKey: 'brandId' });

Ad.hasMany(Application, { foreignKey: 'adId' });
Application.belongsTo(Ad, { foreignKey: 'adId' });

Influencer.hasMany(Application, { foreignKey: 'influencerId' });
Application.belongsTo(Influencer, { foreignKey: 'influencerId' });

Influencer.hasMany(Payout, { foreignKey: 'influencerId' });
// Influencer categories (many-to-many)
const InfluencerCategory = sequelize.define('InfluencerCategory', {}, { tableName: 'InfluencerCategories' });
Influencer.belongsToMany(Category, { through: InfluencerCategory, foreignKey: 'influencerId' });
Category.belongsToMany(Influencer, { through: InfluencerCategory, foreignKey: 'categoryId' });

// OTP requests optional relation
User.hasMany(OtpRequest, { foreignKey: 'userId' });
OtpRequest.belongsTo(User, { foreignKey: 'userId' });

// Refresh tokens
User.hasMany(RefreshToken, { foreignKey: 'userId' });
RefreshToken.belongsTo(User, { foreignKey: 'userId' });

// Roles associations
Role.belongsToMany(User, { through: UserRole, foreignKey: 'roleId' });
User.belongsToMany(Role, { through: UserRole, foreignKey: 'userId' });

// Media associations
const PostModel = Post;
PostModel.hasMany(InfluencerAdMedia, { foreignKey: 'postId' });
InfluencerAdMedia.belongsTo(PostModel, { foreignKey: 'postId' });
Influencer.hasMany(InfluencerAdMedia, { foreignKey: 'influencerId' });
InfluencerAdMedia.belongsTo(Influencer, { foreignKey: 'influencerId' });
Ad.hasMany(InfluencerAdMedia, { foreignKey: 'adId' });
InfluencerAdMedia.belongsTo(Ad, { foreignKey: 'adId' });

// Pricing association
Influencer.hasOne(InfluencerPricing, { foreignKey: 'influencerId' });
InfluencerPricing.belongsTo(Influencer, { foreignKey: 'influencerId' });

// KYC and Payment associations
Influencer.hasOne(InfluencerKyc, { foreignKey: 'influencerId' });
InfluencerKyc.belongsTo(Influencer, { foreignKey: 'influencerId' });
Influencer.hasMany(InfluencerPaymentMethod, { foreignKey: 'influencerId' });
InfluencerPaymentMethod.belongsTo(Influencer, { foreignKey: 'influencerId' });

// Profile pack association
Influencer.hasMany(ProfilePack, { foreignKey: 'influencerId' });
ProfilePack.belongsTo(Influencer, { foreignKey: 'influencerId' });

// Referral commissions associations
Influencer.hasMany(ReferralCommission, { foreignKey: 'referrerInfluencerId' });
ReferralCommission.belongsTo(Influencer, { foreignKey: 'referrerInfluencerId' });

// PR commissions associations
User.hasMany(PrCommission, { foreignKey: 'prUserId' });
PrCommission.belongsTo(User, { foreignKey: 'prUserId' });
Brand.hasMany(PrCommission, { foreignKey: 'brandId' });
PrCommission.belongsTo(Brand, { foreignKey: 'brandId' });

module.exports = { sequelize, User, Influencer, Brand, Ad, Application, Payout, OtpRequest, RefreshToken, Post, InfluencerAdMedia, InfluencerPricing, InfluencerKyc, InfluencerPaymentMethod, ProfilePack, LandingContent, SeoPage, ReferralCommission, BrandMember, PrCommission, PhotoshootRequest, ensureUserAuthColumns, ensureInfluencerUlidColumn };
module.exports.Language = Language;
module.exports.Category = Category;
module.exports.InfluencerCategory = InfluencerCategory;
module.exports.Country = Country;
module.exports.State = State;
module.exports.District = District;
module.exports.Role = Role;
module.exports.UserRole = UserRole;
