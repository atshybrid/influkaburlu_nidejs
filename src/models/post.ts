module.exports = (sequelize, DataTypes) => {
  const Post = sequelize.define('Post', {
    userId: { type: DataTypes.INTEGER },
    influencerId: { type: DataTypes.INTEGER },
    adId: { type: DataTypes.INTEGER },
    type: { type: DataTypes.ENUM('ad','external','portfolio'), allowNull: false },
    caption: { type: DataTypes.TEXT },
    categories: { type: DataTypes.JSONB, defaultValue: [] },
    language: { type: DataTypes.STRING },
    states: { type: DataTypes.JSONB, defaultValue: [] },
    media: { type: DataTypes.JSONB, defaultValue: [] },
    metrics: { type: DataTypes.JSONB, defaultValue: { likes: 0, comments: 0, saves: 0, views: 0 } },
    status: { type: DataTypes.STRING, defaultValue: 'active' },
    ulid: { type: DataTypes.STRING(26), allowNull: false, unique: true },
  }, {
    tableName: 'Posts',
  });

  Post.beforeValidate((post) => {
    if (!post.ulid) {
      const { ulid } = require('ulid');
      post.ulid = ulid();
    }
  });

  return Post;
};