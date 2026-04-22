const { DataTypes } = require("sequelize");

function defineAlert(sequelize) {
  return sequelize.define(
    "Alert",
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
      },
      severity: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      source: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      tableName: "alerts",
      timestamps: false,
      underscored: true,
    }
  );
}

module.exports = { defineAlert };

