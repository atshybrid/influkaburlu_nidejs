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
const Payout = require('./payout')(sequelize, Sequelize.DataTypes);
const OtpRequest = require('./otpRequest')(sequelize, Sequelize.DataTypes);
const RefreshToken = require('./refreshToken')(sequelize, Sequelize.DataTypes);
const { Country, State, District } = require('./location')(sequelize, Sequelize.DataTypes);
const { Role, UserRole } = require('./role')(sequelize, Sequelize.DataTypes);

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

// OTP requests optional relation
User.hasMany(OtpRequest, { foreignKey: 'userId' });
OtpRequest.belongsTo(User, { foreignKey: 'userId' });

// Refresh tokens
User.hasMany(RefreshToken, { foreignKey: 'userId' });
RefreshToken.belongsTo(User, { foreignKey: 'userId' });

// Roles associations
Role.belongsToMany(User, { through: UserRole, foreignKey: 'roleId' });
User.belongsToMany(Role, { through: UserRole, foreignKey: 'userId' });

module.exports = { sequelize, User, Influencer, Brand, Ad, Application, Payout, OtpRequest, RefreshToken };
module.exports.Country = Country;
module.exports.State = State;
module.exports.District = District;
module.exports.Role = Role;
module.exports.UserRole = UserRole;
