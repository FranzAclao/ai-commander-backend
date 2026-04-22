const { DataTypes } = require("sequelize");

function defineUsageCounter(sequelize) {
  return sequelize.define(
    "UsageCounter",
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      periodMonth: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "period_month",
      },
      monthlyQueriesUsed: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "monthly_queries_used",
      },
      subscriptionId: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "subscription_id",
      },
    },
    {
      tableName: "usage_counters",
      timestamps: true,
      underscored: true,
    }
  );
}

module.exports = { defineUsageCounter };

