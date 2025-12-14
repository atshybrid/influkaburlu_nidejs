module.exports = (sequelize, DataTypes) => {
  const ProfilePack = sequelize.define('ProfilePack', {
    packId: { type: DataTypes.STRING, allowNull: false, unique: true },
    influencerId: { type: DataTypes.INTEGER, allowNull: true },
    name: { type: DataTypes.STRING },
    niche: { type: DataTypes.STRING },
    city: { type: DataTypes.STRING },
    shortBio: { type: DataTypes.TEXT },
    longBio: { type: DataTypes.TEXT },
    jsonLd: { type: DataTypes.JSONB, defaultValue: {} },
    images: { type: DataTypes.JSONB, defaultValue: { avatar: null, gallery: [] } },
    ai: { type: DataTypes.BOOLEAN, defaultValue: false },
    ulid: { type: DataTypes.STRING(26), allowNull: false, unique: true },
  }, { tableName: 'ProfilePacks' });

  ProfilePack.beforeValidate((row) => {
    if (!row.ulid) { const { ulid } = require('ulid'); row.ulid = ulid(); }
  });

  return ProfilePack;
};