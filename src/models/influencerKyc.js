module.exports = (sequelize, DataTypes) => {
  const InfluencerKyc = sequelize.define('InfluencerKyc', {
    influencerId: { type: DataTypes.INTEGER, allowNull: false },
    fullName: { type: DataTypes.STRING },
    dob: { type: DataTypes.DATEONLY },
    pan: { type: DataTypes.STRING },
    addressLine1: { type: DataTypes.STRING },
    addressLine2: { type: DataTypes.STRING },
    postalCode: { type: DataTypes.STRING },
    city: { type: DataTypes.STRING },
    state: { type: DataTypes.STRING },
    country: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING, defaultValue: 'pending' },
    verifiedAt: { type: DataTypes.DATE },
    documents: { type: DataTypes.JSONB, defaultValue: {} },
    consentTs: { type: DataTypes.DATE },
    ulid: { type: DataTypes.STRING(26), allowNull: false, unique: true },
  }, {
    tableName: 'InfluencerKyc',
  });

  InfluencerKyc.beforeValidate((row) => {
    if (!row.ulid) {
      const { ulid } = require('ulid');
      row.ulid = ulid();
    }
  });

  return InfluencerKyc;
};
