const { DataTypes } = require("sequelize");

function defineNotification(sequelize) {
  return sequelize.define(
    "Notification",
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      unread: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "user_id",
      },
    },
    {
      tableName: "notifications",
      timestamps: true,
      underscored: true,
    }
  );
}

module.exports = { defineNotification };

