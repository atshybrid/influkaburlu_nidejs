module.exports = (sequelize, DataTypes) => {
  const InfluencerPaymentMethod = sequelize.define('InfluencerPaymentMethod', {
    influencerId: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'bank' }, // bank or upi
    isPreferred: { type: DataTypes.BOOLEAN, defaultValue: false },
    status: { type: DataTypes.STRING, defaultValue: 'unverified' },
    accountHolderName: { type: DataTypes.STRING },
    bankName: { type: DataTypes.STRING },
    bankIfsc: { type: DataTypes.STRING },
    bankAccountNumber: { type: DataTypes.STRING },
    upiId: { type: DataTypes.STRING },
    ulid: { type: DataTypes.STRING(26), allowNull: false, unique: true },
  }, {
    tableName: 'InfluencerPaymentMethod',
  });

  InfluencerPaymentMethod.beforeValidate((row) => {
    if (!row.ulid) {
      const { ulid } = require('ulid');
      row.ulid = ulid();
    }
  });

  return InfluencerPaymentMethod;
};
