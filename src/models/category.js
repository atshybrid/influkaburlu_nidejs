module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('Category', {
    name: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING },
    purpose: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT }
  });
  return Category;
};
