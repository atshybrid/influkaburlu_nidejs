module.exports = (sequelize, DataTypes) => {
  const InfluencerPricing = sequelize.define('InfluencerPricing', {
    influencerId: { type: DataTypes.INTEGER, allowNull: false },
    adPricing: { type: DataTypes.JSONB, defaultValue: {} },
    ulid: { type: DataTypes.STRING(26), allowNull: false, unique: true },
  }, {
    tableName: 'InfluencerPricing',
  });

  InfluencerPricing.beforeValidate((row) => {
    if (!row.ulid) {
      const { ulid } = require('ulid');
      row.ulid = ulid();
    }
  });

  return InfluencerPricing;
};
