const { DataTypes } = require("sequelize");

function defineActivityEvent(sequelize) {
  return sequelize.define(
    "ActivityEvent",
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      action: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      detail: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      tableName: "activity_events",
      timestamps: false,
      underscored: true,
    }
  );
}

module.exports = { defineActivityEvent };

