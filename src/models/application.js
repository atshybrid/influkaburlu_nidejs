module.exports = (sequelize, DataTypes) => {
  const Application = sequelize.define('Application', {
    adId: { type: DataTypes.INTEGER },
    influencerId: { type: DataTypes.INTEGER },
    state: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING, defaultValue: 'applied' },
    submission: { type: DataTypes.JSONB, defaultValue: {} },
    payment: { type: DataTypes.JSONB, defaultValue: {} }
  });
  return Application;
};
