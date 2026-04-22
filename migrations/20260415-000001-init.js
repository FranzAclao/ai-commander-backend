"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("users", {
      id: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      role: { type: Sequelize.STRING, allowNull: false, defaultValue: "Analyst" },
      workspace: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "InsightCopilot",
      },
      last_login_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("notifications", {
      id: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: false },
      unread: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      user_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("stores", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4,
      },
      name: { type: Sequelize.STRING, allowNull: false, unique: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("orders", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4,
      },
      store_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "stores", key: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },
      placed_at: { type: Sequelize.DATE, allowNull: false },
      customer_name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "Customer",
      },
      channel: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "Web",
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "paid",
      },
      total_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      items_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("payments", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4,
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "orders", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      paid_at: { type: Sequelize.DATE, allowNull: false },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: "succeeded" },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("sessions", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4,
      },
      started_at: { type: Sequelize.DATE, allowNull: false },
      store_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "stores", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      channel: { type: Sequelize.STRING, allowNull: false, defaultValue: "Web" },
      user_id: { type: Sequelize.STRING, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("alerts", {
      id: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      severity: { type: Sequelize.STRING, allowNull: false },
      source: { type: Sequelize.STRING, allowNull: false },
      message: { type: Sequelize.TEXT, allowNull: false },
    });

    await queryInterface.createTable("saved_queries", {
      id: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      sql: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      last_run_at: { type: Sequelize.DATE, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: "active" },
    });

    await queryInterface.createTable("activity_events", {
      id: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
      at: { type: Sequelize.DATE, allowNull: false },
      action: { type: Sequelize.STRING, allowNull: false },
      detail: { type: Sequelize.TEXT, allowNull: false },
    });

    await queryInterface.createTable("subscriptions", {
      id: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
      plan: { type: Sequelize.STRING, allowNull: false },
      renewal_at: { type: Sequelize.DATE, allowNull: false },
      seats: { type: Sequelize.INTEGER, allowNull: false },
      seats_used: { type: Sequelize.INTEGER, allowNull: false },
      monthly_query_limit: { type: Sequelize.INTEGER, allowNull: false },
      user_id: {
        type: Sequelize.STRING,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("usage_counters", {
      id: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
      period_month: { type: Sequelize.STRING, allowNull: false },
      monthly_queries_used: { type: Sequelize.INTEGER, allowNull: false },
      subscription_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: { model: "subscriptions", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("data_sources", {
      id: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      type: { type: Sequelize.STRING, allowNull: false, defaultValue: "postgres" },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: "connected" },
      subscription_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: { model: "subscriptions", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("invoices", {
      id: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
      issued_at: { type: Sequelize.DATE, allowNull: false },
      amount_usd: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      status: { type: Sequelize.STRING, allowNull: false },
      subscription_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: { model: "subscriptions", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("invoices");
    await queryInterface.dropTable("data_sources");
    await queryInterface.dropTable("usage_counters");
    await queryInterface.dropTable("subscriptions");
    await queryInterface.dropTable("activity_events");
    await queryInterface.dropTable("saved_queries");
    await queryInterface.dropTable("alerts");
    await queryInterface.dropTable("sessions");
    await queryInterface.dropTable("payments");
    await queryInterface.dropTable("orders");
    await queryInterface.dropTable("stores");
    await queryInterface.dropTable("notifications");
    await queryInterface.dropTable("users");
  },
};
