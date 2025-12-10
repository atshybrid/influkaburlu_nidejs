const fs = require('fs');
const path = require('path');
const { Country, State, District } = require('../models');

async function seedLocations(){
  const countries = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/countries.json')));
  for (const c of countries){
    const country = await Country.create(c);
    if (c.code2 === 'IN'){
      const states = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/states_IN.json')));
      for (const s of states){
        const state = await State.create({ ...s, countryId: country.id });
        if (s.code === 'TG'){
          const districts = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/districts_TG.json')));
          for (const d of districts){
            await District.create({ ...d, stateId: state.id });
          }
        }
      }
    }
  }
}

module.exports = { seedLocations };