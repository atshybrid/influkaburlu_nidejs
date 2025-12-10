module.exports = (sequelize, DataTypes) => {
  const Brand = sequelize.define('Brand', {
    userId: { type: DataTypes.INTEGER },
    companyName: { type: DataTypes.STRING },
    gstin: { type: DataTypes.STRING },
    billingAddress: { type: DataTypes.JSONB, defaultValue: {} }
  });
  return Brand;
};
