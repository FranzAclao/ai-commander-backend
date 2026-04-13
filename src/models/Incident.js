const { DataTypes } = require("sequelize");

function defineIncident(sequelize) {
  return sequelize.define(
    "Incident",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      summary: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "open",
      },
      severity: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "medium",
      },
    },
    {
      tableName: "incidents",
      timestamps: true,
    }
  );
}

module.exports = { defineIncident };

