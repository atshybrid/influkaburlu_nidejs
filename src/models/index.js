const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { Sequelize } = require('sequelize');

const commonOpts = { 
	logging: false,
	pool: { max: 10, min: 0, acquire: 15000, idle: 10000 },
	dialect: 'postgres',
	dialectOptions: {
		// For pg driver
		statement_timeout: parseInt(process.env.PG_STATEMENT_TIMEOUT_MS || '0', 10) || undefined,
		idle_in_transaction_session_timeout: parseInt(process.env.PG_IDLE_TX_TIMEOUT_MS || '0', 10) || undefined,
		connectTimeout: parseInt(process.env.PG_CONNECT_TIMEOUT_MS || '10000', 10),
		connectionTimeoutMillis: parseInt(process.env.PG_CONNECT_TIMEOUT_MS || '10000', 10),
		ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
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

module.exports = { sequelize, User, Influencer, Brand, Ad, Application, Payout, OtpRequest, RefreshToken, Post, InfluencerAdMedia, InfluencerPricing, InfluencerKyc, InfluencerPaymentMethod };
module.exports.Language = Language;
module.exports.Category = Category;
module.exports.InfluencerCategory = InfluencerCategory;
module.exports.Country = Country;
module.exports.State = State;
module.exports.District = District;
module.exports.Role = Role;
module.exports.UserRole = UserRole;
