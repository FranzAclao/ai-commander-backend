const sequelize = require("../db");
const { defineIncident } = require("./Incident");

const Incident = defineIncident(sequelize);

module.exports = {
  sequelize,
  Incident,
};

