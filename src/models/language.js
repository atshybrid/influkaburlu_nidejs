module.exports = (sequelize, DataTypes) => {
  const Language = sequelize.define('Language', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(10), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(100), allowNull: false }
  }, {
    tableName: 'languages',
    timestamps: false
  });
  return Language;
};
