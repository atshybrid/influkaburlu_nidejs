module.exports = (sequelize, DataTypes) => {
  const PhotoshootRequest = sequelize.define(
    'PhotoshootRequest',
    {
      influencerId: { type: DataTypes.INTEGER, allowNull: false },
      status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'pending' },
      details: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },

      requestedStartAt: { type: DataTypes.DATE, allowNull: true },
      requestedEndAt: { type: DataTypes.DATE, allowNull: true },
      requestedTimezone: { type: DataTypes.STRING(64), allowNull: true },

      scheduledStartAt: { type: DataTypes.DATE, allowNull: true },
      scheduledEndAt: { type: DataTypes.DATE, allowNull: true },
      scheduledTimezone: { type: DataTypes.STRING(64), allowNull: true },

      location: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },

      rejectReason: { type: DataTypes.TEXT, allowNull: true },
      adminNotes: { type: DataTypes.TEXT, allowNull: true },

      approvedByUserId: { type: DataTypes.INTEGER, allowNull: true },
      approvedAt: { type: DataTypes.DATE, allowNull: true },

      scheduledByUserId: { type: DataTypes.INTEGER, allowNull: true },
      scheduledAt: { type: DataTypes.DATE, allowNull: true },

      ulid: { type: DataTypes.STRING(26), allowNull: false, unique: true },
    },
    {
      tableName: 'PhotoshootRequests',
    }
  );

  PhotoshootRequest.beforeValidate((row) => {
    if (!row.ulid) {
      const { ulid } = require('ulid');
      row.ulid = ulid();
    }
  });

  return PhotoshootRequest;
};
