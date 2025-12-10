module.exports = (sequelize, DataTypes) => {
  const Influencer = sequelize.define('Influencer', {
    userId: { type: DataTypes.INTEGER },
    handle: { type: DataTypes.STRING },
    countryId: { type: DataTypes.INTEGER },
    stateId: { type: DataTypes.INTEGER },
    stateIds: { type: DataTypes.JSONB, defaultValue: [] },
    districtId: { type: DataTypes.INTEGER },
    addressLine1: { type: DataTypes.STRING },
    addressLine2: { type: DataTypes.STRING },
    postalCode: { type: DataTypes.STRING },
    states: { type: DataTypes.JSONB, defaultValue: [] },
    languages: { type: DataTypes.JSONB, defaultValue: [] },
    socialLinks: { type: DataTypes.JSONB, defaultValue: {} },
    followers: { type: DataTypes.JSONB, defaultValue: {} },
    bio: { type: DataTypes.TEXT },
    profilePicUrl: { type: DataTypes.STRING },
    posts: { type: DataTypes.JSONB, defaultValue: [] },
    rateCards: { type: DataTypes.JSONB, defaultValue: [] },
    availability: { type: DataTypes.JSONB, defaultValue: [] },
    profilePackUrl: { type: DataTypes.STRING }
  });
  return Influencer;
};
