const { DataTypes } = require("sequelize");

function defineSubscription(sequelize) {
  return sequelize.define(
    "Subscription",
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      plan: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      renewalAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "renewal_at",
      },
      seats: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      seatsUsed: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "seats_used",
      },
      monthlyQueryLimit: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "monthly_query_limit",
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "user_id",
      },
    },
    {
      tableName: "subscriptions",
      timestamps: true,
      underscored: true,
    }
  );
}

module.exports = { defineSubscription };

