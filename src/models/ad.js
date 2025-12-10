module.exports = (sequelize, DataTypes) => {
  const Ad = sequelize.define('Ad', {
    brandId: { type: DataTypes.INTEGER },
    title: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    targetStates: { type: DataTypes.JSONB, defaultValue: [] },
    language: { type: DataTypes.STRING },
    deliverableType: { type: DataTypes.STRING },
    payPerInfluencer: { type: DataTypes.DECIMAL },
    budget: { type: DataTypes.DECIMAL },
    deadline: { type: DataTypes.DATE },
    status: { type: DataTypes.STRING, defaultValue: 'open' }
  });
  return Ad;
};
