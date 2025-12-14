module.exports = (sequelize, DataTypes) => {
  const Payout = sequelize.define('Payout', {
    influencerId: { type: DataTypes.INTEGER },
    grossAmount: { type: DataTypes.DECIMAL },
    commission: { type: DataTypes.DECIMAL },
    netAmount: { type: DataTypes.DECIMAL },
    state: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING, defaultValue: 'pending' }
  });
  return Payout;
};
