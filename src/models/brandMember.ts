module.exports = (sequelize, DataTypes) => {
  const BrandMember = sequelize.define(
    'BrandMember',
    {
      brandId: { type: DataTypes.INTEGER, allowNull: false },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      memberRole: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'pr' },
      isPrimary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdByUserId: { type: DataTypes.INTEGER },
      meta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    {
      tableName: 'BrandMembers',
      indexes: [
        { unique: true, fields: ['brandId', 'userId'] },
        { fields: ['brandId'] },
        { fields: ['userId'] },
      ],
    }
  );

  return BrandMember;
};
