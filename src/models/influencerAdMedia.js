module.exports = (sequelize, DataTypes) => {
  const InfluencerAdMedia = sequelize.define('InfluencerAdMedia', {
    postId: { type: DataTypes.INTEGER, allowNull: false },
    influencerId: { type: DataTypes.INTEGER, allowNull: false },
    adId: { type: DataTypes.INTEGER, allowNull: true },
    provider: { type: DataTypes.STRING, allowNull: false, defaultValue: 'bunny' },
    guid: { type: DataTypes.STRING, allowNull: false, unique: true },
    playbackUrl: { type: DataTypes.STRING },
    thumbnailUrl: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'created' },
    sizeBytes: { type: DataTypes.BIGINT },
    durationSec: { type: DataTypes.INTEGER },
    meta: { type: DataTypes.JSONB, defaultValue: {} },
    ulid: { type: DataTypes.STRING(26), allowNull: false, unique: true },
  }, {
    tableName: 'InfluencerAdMedia',
  });

  InfluencerAdMedia.beforeValidate((row) => {
    if (!row.ulid) {
      const { ulid } = require('ulid');
      row.ulid = ulid();
    }
  });

  return InfluencerAdMedia;
};
