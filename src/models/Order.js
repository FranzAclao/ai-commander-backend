const { DataTypes } = require("sequelize");

function defineOrder(sequelize) {
  return sequelize.define(
    "Order",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      storeId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "store_id",
      },
      placedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "placed_at",
      },
      customerName: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "Customer",
        field: "customer_name",
      },
      channel: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "Web",
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "paid",
      },
      totalAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        field: "total_amount",
      },
      itemsCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        field: "items_count",
      },
    },
    {
      tableName: "orders",
      timestamps: true,
      underscored: true,
    }
  );
}

module.exports = { defineOrder };
