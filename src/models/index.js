const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { Sequelize } = require('sequelize');
const dbUrl = process.env.DATABASE_URL;
const sequelize = new Sequelize(dbUrl, { logging: false });

const User = require('./user')(sequelize, Sequelize.DataTypes);
const Influencer = require('./influencer')(sequelize, Sequelize.DataTypes);
const Brand = require('./brand')(sequelize, Sequelize.DataTypes);
const Ad = require('./ad')(sequelize, Sequelize.DataTypes);
const Application = require('./application')(sequelize, Sequelize.DataTypes);
const Payout = require('./payout')(sequelize, Sequelize.DataTypes);
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

// Roles associations
Role.belongsToMany(User, { through: UserRole, foreignKey: 'roleId' });
User.belongsToMany(Role, { through: UserRole, foreignKey: 'userId' });

module.exports = { sequelize, User, Influencer, Brand, Ad, Application, Payout };
module.exports.Country = Country;
module.exports.State = State;
module.exports.District = District;
module.exports.Role = Role;
module.exports.UserRole = UserRole;
