module.exports = (sequelize, DataTypes) => {
  const ReferralCommission = sequelize.define('ReferralCommission', {
    referrerInfluencerId: { type: DataTypes.INTEGER, allowNull: false },
    sourceInfluencerId: { type: DataTypes.INTEGER, allowNull: false },
    payoutId: { type: DataTypes.INTEGER, allowNull: true },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'earned' },
    meta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  }, {
    tableName: 'ReferralCommissions',
  });

  return ReferralCommission;
};
