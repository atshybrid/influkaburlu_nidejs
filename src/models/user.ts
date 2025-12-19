module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    ulid: { type: DataTypes.STRING(26), allowNull: true, unique: true },
    name: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING, unique: true },
    phone: { type: DataTypes.STRING, unique: true },
    passwordHash: { type: DataTypes.STRING },
    authProvider: { type: DataTypes.STRING },
    googleSub: { type: DataTypes.STRING },
    googlePictureUrl: { type: DataTypes.STRING },
    emailVerified: { type: DataTypes.BOOLEAN },
    role: { type: DataTypes.ENUM('influencer','brand','admin'), defaultValue: 'influencer' }
  });
  return User;
};
