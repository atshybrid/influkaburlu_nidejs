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
    categories: { type: DataTypes.JSONB, defaultValue: [] },
    adTypes: { type: DataTypes.JSONB, defaultValue: [] },
    deliverables: { type: DataTypes.JSONB, defaultValue: [] },
    briefUrl: { type: DataTypes.STRING },
    mediaRefs: { type: DataTypes.JSONB, defaultValue: [] },
    timeline: { type: DataTypes.JSONB, defaultValue: {} },
    budgetPaid: { type: DataTypes.BOOLEAN, defaultValue: false },
    transactionId: { type: DataTypes.STRING },
    createdByUserId: { type: DataTypes.INTEGER },
    updatedByUserId: { type: DataTypes.INTEGER },
    deadline: { type: DataTypes.DATE },
    status: { type: DataTypes.STRING, defaultValue: 'open' },
    ulid: { type: DataTypes.STRING(26), allowNull: false, unique: true },
  }, {
    tableName: 'Ads',
  });

  Ad.beforeValidate((ad) => {
    if (!ad.ulid) {
      const { ulid } = require('ulid');
      ad.ulid = ulid();
    }
  });

  return Ad;
};
