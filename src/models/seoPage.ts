module.exports = (sequelize, DataTypes) => {
  const SeoPage = sequelize.define(
    'SeoPage',
    {
      slug: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      metaTitle: { type: DataTypes.STRING(255) },
      metaDescription: { type: DataTypes.TEXT },
      metaKeywords: { type: DataTypes.TEXT },
      ogImage: { type: DataTypes.STRING(512) },
      ulid: { type: DataTypes.STRING(26), allowNull: false, unique: true },
    },
    {
      tableName: 'SeoPages',
    }
  );

  SeoPage.beforeValidate((row) => {
    if (!row.ulid) {
      const { ulid } = require('ulid');
      row.ulid = ulid();
    }
  });

  return SeoPage;
};
