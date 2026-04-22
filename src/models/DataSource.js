const { DataTypes } = require("sequelize");

function defineDataSource(sequelize) {
  return sequelize.define(
    "DataSource",
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "postgres",
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "connected",
      },
      subscriptionId: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "subscription_id",
      },
    },
    {
      tableName: "data_sources",
      timestamps: true,
      underscored: true,
    }
  );
}

module.exports = { defineDataSource };
