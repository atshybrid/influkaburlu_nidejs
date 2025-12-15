module.exports = (sequelize, DataTypes) => {
  const LandingContent = sequelize.define('LandingContent', {
    key: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    data: { type: DataTypes.JSONB, defaultValue: {} },
    ulid: { type: DataTypes.STRING(26), allowNull: false, unique: true },
  }, {
    tableName: 'LandingContent',
  });

  LandingContent.beforeValidate((row) => {
    if (!row.ulid) {
      const { ulid } = require('ulid');
      row.ulid = ulid();
    }
  });

  return LandingContent;
};
