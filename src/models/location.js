module.exports = (sequelize, DataTypes) => {
  const Country = sequelize.define('Country', {
    code2: { type: DataTypes.STRING(2), unique: true },
    code3: { type: DataTypes.STRING(3) },
    name: { type: DataTypes.STRING, allowNull: false }
  });

  const State = sequelize.define('State', {
    name: { type: DataTypes.STRING, allowNull: false },
    code: { type: DataTypes.STRING(8) }
  });

  const District = sequelize.define('District', {
    name: { type: DataTypes.STRING, allowNull: false }
  });

  Country.hasMany(State, { foreignKey: 'countryId' });
  State.belongsTo(Country, { foreignKey: 'countryId' });

  State.hasMany(District, { foreignKey: 'stateId' });
  District.belongsTo(State, { foreignKey: 'stateId' });

  return { Country, State, District };
};