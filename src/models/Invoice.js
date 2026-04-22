const { DataTypes } = require("sequelize");

function defineInvoice(sequelize) {
  return sequelize.define(
    "Invoice",
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      issuedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "issued_at",
      },
      amountUsd: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        field: "amount_usd",
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      subscriptionId: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "subscription_id",
      },
    },
    {
      tableName: "invoices",
      timestamps: true,
      underscored: true,
    }
  );
}

module.exports = { defineInvoice };

