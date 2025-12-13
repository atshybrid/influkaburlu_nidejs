"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('CREATE SCHEMA IF NOT EXISTS public;');
    await queryInterface.sequelize.query('SET search_path TO public;');
  },
  async down(queryInterface, Sequelize) {
    // Do not drop public schema; noop
  }
};
