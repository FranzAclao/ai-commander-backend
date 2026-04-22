const sequelize = require("../db");
const { defineUser } = require("./User");
const { defineNotification } = require("./Notification");
const { defineStore } = require("./Store");
const { defineOrder } = require("./Order");
const { definePayment } = require("./Payment");
const { defineSession } = require("./Session");
const { defineAlert } = require("./Alert");
const { defineSavedQuery } = require("./SavedQuery");
const { defineSubscription } = require("./Subscription");
const { defineUsageCounter } = require("./UsageCounter");
const { defineDataSource } = require("./DataSource");
const { defineInvoice } = require("./Invoice");
const { defineActivityEvent } = require("./ActivityEvent");

const User = defineUser(sequelize);
const Notification = defineNotification(sequelize);
const Store = defineStore(sequelize);
const Order = defineOrder(sequelize);
const Payment = definePayment(sequelize);
const Session = defineSession(sequelize);
const Alert = defineAlert(sequelize);
const SavedQuery = defineSavedQuery(sequelize);
const Subscription = defineSubscription(sequelize);
const UsageCounter = defineUsageCounter(sequelize);
const DataSource = defineDataSource(sequelize);
const Invoice = defineInvoice(sequelize);
const ActivityEvent = defineActivityEvent(sequelize);

Notification.belongsTo(User, { foreignKey: "userId" });
User.hasMany(Notification, { foreignKey: "userId" });

Order.belongsTo(Store, { foreignKey: "storeId" });
Store.hasMany(Order, { foreignKey: "storeId" });

Payment.belongsTo(Order, { foreignKey: "orderId" });
Order.hasMany(Payment, { foreignKey: "orderId" });

Session.belongsTo(Store, { foreignKey: "storeId" });
Store.hasMany(Session, { foreignKey: "storeId" });

Subscription.belongsTo(User, { foreignKey: "userId" });
User.hasOne(Subscription, { foreignKey: "userId" });

UsageCounter.belongsTo(Subscription, { foreignKey: "subscriptionId" });
Subscription.hasMany(UsageCounter, { foreignKey: "subscriptionId" });

DataSource.belongsTo(Subscription, { foreignKey: "subscriptionId" });
Subscription.hasMany(DataSource, { foreignKey: "subscriptionId" });

Invoice.belongsTo(Subscription, { foreignKey: "subscriptionId" });
Subscription.hasMany(Invoice, { foreignKey: "subscriptionId" });

module.exports = {
  sequelize,
  User,
  Notification,
  Store,
  Order,
  Payment,
  Session,
  Alert,
  SavedQuery,
  Subscription,
  UsageCounter,
  DataSource,
  Invoice,
  ActivityEvent,
};
