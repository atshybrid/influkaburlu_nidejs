module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define('Role', {
    key: { type: DataTypes.STRING, unique: true, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING },
    isSystem: { type: DataTypes.BOOLEAN, defaultValue: true }
  });

  const UserRole = sequelize.define('UserRole', {
    // implicit id
  });

  return { Role, UserRole };
};