const { DataTypes } = require("sequelize");

function defineUser(sequelize) {
  return sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      role: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "Analyst",
      },
      workspace: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "Demo Workspace",
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "last_login_at",
      },
    },
    {
      tableName: "users",
      timestamps: true,
      underscored: true,
    }
  );
}

module.exports = { defineUser };

