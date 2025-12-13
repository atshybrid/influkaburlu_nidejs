module.exports = (sequelize, DataTypes) => {
  const Brand = sequelize.define('Brand', {
    userId: { type: DataTypes.INTEGER },
    companyName: { type: DataTypes.STRING },
    gstin: { type: DataTypes.STRING },
    billingAddress: { type: DataTypes.JSONB, defaultValue: {} },
    ulid: { type: DataTypes.STRING(26), allowNull: false, unique: true },
  }, {
    tableName: 'Brands',
  });

  Brand.beforeValidate((brand) => {
    if (!brand.ulid) {
      const { ulid } = require('ulid');
      brand.ulid = ulid();
    }
  });

  return Brand;
};
