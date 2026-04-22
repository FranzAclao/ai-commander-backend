const { DataTypes } = require("sequelize");

function defineStore(sequelize) {
  return sequelize.define(
    "Store",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
    },
    {
      tableName: "stores",
      timestamps: true,
      underscored: true,
    }
  );
}

module.exports = { defineStore };

