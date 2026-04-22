const { DataTypes } = require("sequelize");

function definePayment(sequelize) {
  return sequelize.define(
    "Payment",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      orderId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "order_id",
      },
      paidAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "paid_at",
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "succeeded",
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
    },
    {
      tableName: "payments",
      timestamps: true,
      underscored: true,
    }
  );
}

module.exports = { definePayment };

