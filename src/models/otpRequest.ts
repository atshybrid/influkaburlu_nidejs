module.exports = (sequelize, DataTypes) => {
  const OtpRequest = sequelize.define('OtpRequest', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: false },
    otp: { type: DataTypes.STRING, allowNull: false },
    requestId: { type: DataTypes.STRING, allowNull: false, unique: true },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    used: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  }, {
    tableName: 'otp_requests',
    timestamps: true,
    indexes: [
      { fields: ['phone'] },
      { fields: ['userId'] },
      { unique: true, fields: ['requestId'] }
    ]
  });

  return OtpRequest;
};