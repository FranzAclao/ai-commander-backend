const { DataTypes } = require("sequelize");

function defineSavedQuery(sequelize) {
  return sequelize.define(
    "SavedQuery",
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      sql: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "SELECT 1;",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
      },
      lastRunAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "last_run_at",
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "active",
      },
    },
    {
      tableName: "saved_queries",
      timestamps: false,
      underscored: true,
    }
  );
}

module.exports = { defineSavedQuery };
