const { DataTypes } = require("sequelize");

function defineSession(sequelize) {
  return sequelize.define(
    "Session",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "started_at",
      },
      storeId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: "store_id",
      },
      channel: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "Web",
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "user_id",
      },
    },
    {
      tableName: "sessions",
      timestamps: true,
      underscored: true,
    }
  );
}

module.exports = { defineSession };
