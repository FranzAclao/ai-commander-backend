const { DataTypes } = require("sequelize");

function defineProduct(sequelize) {
  return sequelize.define(
    "Product",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
    },
    {
      tableName: "products",
      timestamps: true,
    }
  );
}

module.exports = { defineProduct };

