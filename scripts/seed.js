require("dotenv").config();

const { randomUUID } = require("crypto");
const { Op } = require("sequelize");
const {
  sequelize,
  User,
  Notification,
  Store,
  Order,
  Payment,
  Session,
  Alert,
  SavedQuery,
  ActivityEvent,
  Subscription,
  UsageCounter,
  DataSource,
  Invoice,
} = require("../src/models");

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function minutesAfter(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function money(n) {
  return Number(n).toFixed(2);
}

function monthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function channelForStore(storeName) {
  if (storeName === "Mall") return "POS";
  return "Web";
}

async function seed() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });

  const now = new Date();

  await User.upsert({
    id: "usr_001",
    name: "User",
    email: "user@company.com",
    role: "Analyst",
    workspace: "InsightCopilot",
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
  });

  const user = await User.findByPk("usr_001");
  console.log(`${user ? "Seeded" : "Missing"} user usr_001`);

  if (user) {
    const notifications = [
      {
        id: "ntf_1",
        title: "Weekly report ready",
        unread: true,
        createdAt: daysAgo(1),
      },
      {
        id: "ntf_2",
        title: "New data source connected",
        unread: false,
        createdAt: daysAgo(3),
      },
      {
        id: "ntf_3",
        title: "Payment success rate drop detected",
        unread: true,
        createdAt: daysAgo(0),
      },
    ];

    for (const n of notifications) {
      await Notification.upsert({
        ...n,
        userId: user.id,
        updatedAt: n.createdAt,
      });
    }
    console.log(`Seeded ${notifications.length} notifications.`);
  }

  const alerts = [
    { id: "a1", createdAt: daysAgo(0), severity: "high", source: "Refund spike detected", message: "Refund rate exceeded threshold" },
    { id: "a2", createdAt: daysAgo(0), severity: "medium", source: "Payment latency", message: "Checkout payment latency increased" },
    { id: "a3", createdAt: daysAgo(1), severity: "low", source: "Traffic anomaly", message: "Unusual traffic from a new campaign" },
    { id: "a4", createdAt: daysAgo(1), severity: "critical", source: "Payments down", message: "Payment success rate dropped sharply" },
    { id: "a5", createdAt: daysAgo(2), severity: "high", source: "Chargebacks", message: "Chargeback count is trending up" },
    { id: "a6", createdAt: daysAgo(2), severity: "medium", source: "Orders pending", message: "Pending orders increased vs baseline" },
    { id: "a7", createdAt: daysAgo(3), severity: "low", source: "Search errors", message: "Minor increase in search errors" },
    { id: "a8", createdAt: daysAgo(3), severity: "high", source: "Fulfillment delay", message: "Fulfillment SLA breach risk detected" },
    { id: "a9", createdAt: daysAgo(4), severity: "medium", source: "POS sync", message: "POS sync lagging behind" },
    { id: "a10", createdAt: daysAgo(5), severity: "critical", source: "Inventory mismatch", message: "Inventory counts mismatched across systems" },
  ];

  for (const a of alerts) {
    await Alert.upsert(a);
  }
  console.log(`Seeded ${alerts.length} alerts.`);

  const savedQueries = [
    {
      id: "qry_1",
      name: "Weekly order trend",
      sql: "SELECT to_char(date_trunc('week', placed_at), 'IYYY-IW') AS week, SUM(total_amount) AS sales FROM orders GROUP BY 1 ORDER BY 1 DESC LIMIT 12;",
      createdAt: daysAgo(30),
      lastRunAt: daysAgo(1),
      status: "active",
    },
    {
      id: "qry_2",
      name: "Top stores by sales",
      sql: "SELECT s.name AS store, SUM(o.total_amount) AS sales FROM orders o JOIN stores s ON s.id=o.store_id GROUP BY 1 ORDER BY 2 DESC LIMIT 10;",
      createdAt: daysAgo(20),
      lastRunAt: daysAgo(2),
      status: "active",
    },
    {
      id: "qry_3",
      name: "Conversion rate breakdown",
      sql: "SELECT COUNT(*) FILTER (WHERE status='succeeded')::float / NULLIF(COUNT(*),0) AS conversion_rate FROM payments;",
      createdAt: daysAgo(10),
      lastRunAt: daysAgo(3),
      status: "active",
    },
  ];

  for (const q of savedQueries) {
    await SavedQuery.upsert(q);
  }
  console.log(`Seeded ${savedQueries.length} saved queries.`);

  await Subscription.upsert({
    id: "sub_1",
    plan: "Pro",
    renewalAt: daysAgo(-14),
    seats: 5,
    seatsUsed: 2,
    monthlyQueryLimit: 1000,
    userId: "usr_001",
    createdAt: now,
    updatedAt: now,
  });

  const periodMonth = monthKey(now);
  await UsageCounter.upsert({
    id: `use_${periodMonth}`,
    periodMonth,
    monthlyQueriesUsed: 123,
    subscriptionId: "sub_1",
    createdAt: now,
    updatedAt: now,
  });

  await DataSource.upsert({
    id: "ds1",
    name: "Postgres - prod",
    type: "postgres",
    status: "connected",
    subscriptionId: "sub_1",
    createdAt: now,
    updatedAt: now,
  });

  const invoices = [
    {
      id: "inv1",
      issuedAt: daysAgo(30),
      amountUsd: money(49),
      status: "paid",
      subscriptionId: "sub_1",
      createdAt: daysAgo(30),
      updatedAt: daysAgo(30),
    },
    {
      id: "inv2",
      issuedAt: daysAgo(0),
      amountUsd: money(49),
      status: "paid",
      subscriptionId: "sub_1",
      createdAt: daysAgo(0),
      updatedAt: daysAgo(0),
    },
  ];

  for (const inv of invoices) {
    await Invoice.upsert(inv);
  }
  console.log(`Seeded ${invoices.length} invoices.`);

  const activityEvents = [
    { id: "ev1", at: daysAgo(0), action: "Ran query", detail: "Dashboard KPIs" },
    { id: "ev2", at: daysAgo(0), action: "Viewed report", detail: "Sales trend" },
    { id: "ev3", at: daysAgo(1), action: "Ran query", detail: "Top stores by sales" },
    { id: "ev4", at: daysAgo(2), action: "Connected source", detail: "Postgres - prod" },
    { id: "ev5", at: daysAgo(3), action: "Ran query", detail: "Orders list (paid)" },
    { id: "ev6", at: daysAgo(4), action: "Viewed alert", detail: "Refund spike detected" },
    { id: "ev7", at: daysAgo(5), action: "Generated report", detail: "Weekly order trend" },
  ];

  for (const ev of activityEvents) {
    await ActivityEvent.upsert(ev);
  }
  console.log(`Seeded ${activityEvents.length} activity events.`);

  const storeNames = ["Online", "Downtown", "Mall"];
  const storesByName = {};
  for (const name of storeNames) {
    const [store, created] = await Store.findOrCreate({
      where: { name },
      defaults: { name },
    });
    storesByName[name] = store;
    console.log(`${created ? "Created" : "Found"} store: ${store.name}`);
  }

  // Backfill any older rows created before new columns existed.
  await Order.update(
    { customerName: "Customer", channel: "Web", itemsCount: 1 },
    {
      where: {
        [Op.or]: [
          { customerName: { [Op.is]: null } },
          { channel: { [Op.is]: null } },
          { itemsCount: { [Op.is]: null } },
        ],
      },
    }
  );

  await Session.update(
    { channel: "Web", storeId: storesByName.Online.id },
    {
      where: {
        [Op.or]: [
          { channel: { [Op.is]: null } },
          { storeId: { [Op.is]: null } },
        ],
      },
    }
  );

  const paymentCount = await Payment.count();
  if (paymentCount === 0) {
    const orders = [];
    const payments = [];

    const customers = [
      "A. Reyes",
      "J. Santos",
      "M. Cruz",
      "L. Garcia",
      "S. Dela Cruz",
      "K. Lim",
    ];

    const currentYear = now.getFullYear();

    // Seed 4 years of sales data (for the trend chart).
    for (let yearOffset = 3; yearOffset >= 0; yearOffset--) {
      const year = currentYear - yearOffset;
      const yearDates = [
        new Date(year, 0, 15, 12, 0, 0), // Jan 15
        new Date(year, 3, 10, 12, 0, 0), // Apr 10
        new Date(year, 6, 20, 12, 0, 0), // Jul 20
        new Date(year, 9, 5, 12, 0, 0), // Oct 5
      ];

      for (const [storeIndex, storeName] of storeNames.entries()) {
        const store = storesByName[storeName];
        for (const [dateIndex, placedAt] of yearDates.entries()) {
          const orderId = randomUUID();
          const total = 120 + storeIndex * 45 + dateIndex * 20 + yearOffset * 10;
          const channel = channelForStore(storeName);
          const customerName =
            customers[(storeIndex + dateIndex + yearOffset) % customers.length];
          const itemsCount = ((storeIndex + dateIndex) % 4) + 1;
          const status = (dateIndex + storeIndex) % 3 === 0 ? "fulfilled" : "paid";

          orders.push({
            id: orderId,
            storeId: store.id,
            placedAt,
            customerName,
            channel,
            status,
            totalAmount: money(total),
            itemsCount,
            createdAt: placedAt,
            updatedAt: placedAt,
          });

          payments.push({
            id: randomUUID(),
            orderId,
            paidAt: minutesAfter(placedAt, 5),
            status: "succeeded",
            amount: money(total),
            createdAt: minutesAfter(placedAt, 5),
            updatedAt: minutesAfter(placedAt, 5),
          });
        }
      }
    }

    // Seed recent activity (for the KPI query).
    const recentOrders = [
      { store: "Online", daysAgo: 0, total: 240, status: "paid" },
      { store: "Downtown", daysAgo: 0, total: 180, status: "fulfilled" },
      { store: "Mall", daysAgo: 0, total: 95, status: "pending" },
      { store: "Online", daysAgo: 1, total: 210, status: "paid" },
      { store: "Downtown", daysAgo: 1, total: 160, status: "paid" },
      { store: "Mall", daysAgo: 1, total: 75, status: "refunded" },
      { store: "Online", daysAgo: 8, total: 260, status: "paid" },
      { store: "Downtown", daysAgo: 9, total: 140, status: "fulfilled" },
      { store: "Mall", daysAgo: 10, total: 110, status: "paid" },
      { store: "Online", daysAgo: 12, total: 190, status: "paid" },
      { store: "Downtown", daysAgo: 13, total: 130, status: "paid" },
      { store: "Mall", daysAgo: 20, total: 150, status: "paid" },
      { store: "Online", daysAgo: 25, total: 170, status: "paid" },
    ];

    for (const ro of recentOrders) {
      const store = storesByName[ro.store];
      const placedAt = daysAgo(ro.daysAgo);
      const orderId = randomUUID();
      const channel = channelForStore(ro.store);
      const customerName = customers[(ro.daysAgo + ro.total) % customers.length];
      const itemsCount = (ro.daysAgo % 4) + 1;

      orders.push({
        id: orderId,
        storeId: store.id,
        placedAt,
        customerName,
        channel,
        status: ro.status,
        totalAmount: money(ro.total),
        itemsCount,
        createdAt: placedAt,
        updatedAt: placedAt,
      });

      // Only create a successful payment for successful orders.
      if (["paid", "fulfilled"].includes(ro.status)) {
        payments.push({
          id: randomUUID(),
          orderId,
          paidAt: minutesAfter(placedAt, 2),
          status: "succeeded",
          amount: money(ro.total),
          createdAt: minutesAfter(placedAt, 2),
          updatedAt: minutesAfter(placedAt, 2),
        });
      }
    }

    await Order.bulkCreate(orders);
    await Payment.bulkCreate(payments);
    console.log(`Seeded ${orders.length} orders and ${payments.length} payments.`);
  } else {
    console.log(`Payments already exist (${paymentCount}); skipping order/payment seed.`);
  }

  const sessionCount = await Session.count();
  if (sessionCount < 450) {
    const sessions = [];
    const target = 450 - sessionCount;
    for (let i = 0; i < target; i++) {
      const startedAt = daysAgo(i % 30);
      const storeName = storeNames[i % storeNames.length];
      const channel = channelForStore(storeName);
      sessions.push({
        id: randomUUID(),
        startedAt,
        storeId: storesByName[storeName].id,
        channel,
        userId: `user_${(i % 50) + 1}`,
        createdAt: startedAt,
        updatedAt: startedAt,
      });
    }
    await Session.bulkCreate(sessions);
    console.log(`Seeded ${sessions.length} sessions.`);
  } else {
    console.log(`Sessions already exist (${sessionCount}); skipping session seed.`);
  }
}

seed()
  .then(() => sequelize.close())
  .catch(async (error) => {
    console.error("Seed failed:", error);
    try {
      await sequelize.close();
    } catch {
      // ignore
    }
    process.exit(1);
  });
