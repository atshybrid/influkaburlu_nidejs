module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    name: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING, unique: true },
    phone: { type: DataTypes.STRING, unique: true },
    passwordHash: { type: DataTypes.STRING },
    role: { type: DataTypes.ENUM('influencer','brand','admin'), defaultValue: 'influencer' }
  });
  return User;
};
