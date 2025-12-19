module.exports = (sequelize, DataTypes) => {
  const PrCommission = sequelize.define(
    'PrCommission',
    {
      prUserId: { type: DataTypes.INTEGER, allowNull: false },
      brandId: { type: DataTypes.INTEGER, allowNull: false },
      adId: { type: DataTypes.INTEGER },
      applicationId: { type: DataTypes.INTEGER },
      payoutId: { type: DataTypes.INTEGER },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'earned' },
      meta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    {
      tableName: 'PrCommissions',
      indexes: [
        { fields: ['prUserId'] },
        { fields: ['brandId'] },
        { fields: ['payoutId'] },
      ],
    }
  );

  return PrCommission;
};
