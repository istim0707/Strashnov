const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "finley.json");
const SESSION_COOKIE = "finley_session";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Europe/Moscow";

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});

const CATEGORIES = [
  { id: "food", label: "Еда", icon: "utensils", color: "#0f9f7a" },
  { id: "groceries", label: "Продукты", icon: "basket", color: "#5f8d3d" },
  { id: "delivery", label: "Доставка", icon: "truck", color: "#c26a2c" },
  { id: "transport", label: "Транспорт", icon: "route", color: "#3178c6" },
  { id: "home", label: "Дом", icon: "home", color: "#8b6f47" },
  { id: "health", label: "Здоровье", icon: "heart", color: "#d94b6a" },
  { id: "subscriptions", label: "Подписки", icon: "repeat", color: "#6f5bd3" },
  { id: "shopping", label: "Покупки", icon: "bag", color: "#cf6b32" },
  { id: "travel", label: "Поездки", icon: "plane", color: "#11809b" },
  { id: "income", label: "Доход", icon: "arrow-down", color: "#13a46f" },
  { id: "other", label: "Другое", icon: "dot", color: "#667085" }
];

const CATEGORY_IDS = new Set(CATEGORIES.map((category) => category.id));

const CUSTOM_CATEGORY_COLORS = [
  "#6f5bd3",
  "#11809b",
  "#cf6b32",
  "#0f9f7a",
  "#8b6f47",
  "#d94b6a",
  "#667085"
];

const MONTH_ALIASES = [
  ["января", 0], ["январь", 0], ["янв", 0],
  ["февраля", 1], ["февраль", 1], ["фев", 1],
  ["марта", 2], ["март", 2], ["мар", 2],
  ["апреля", 3], ["апрель", 3], ["апр", 3],
  ["мая", 4], ["май", 4],
  ["июня", 5], ["июнь", 5],
  ["июля", 6], ["июль", 6],
  ["августа", 7], ["август", 7], ["авг", 7],
  ["сентября", 8], ["сентябрь", 8], ["сен", 8], ["сент", 8],
  ["октября", 9], ["октябрь", 9], ["окт", 9],
  ["ноября", 10], ["ноябрь", 10], ["ноя", 10],
  ["декабря", 11], ["декабрь", 11], ["дек", 11]
];

const MONTH_INDEX = new Map(MONTH_ALIASES);
const MONTH_PATTERN = MONTH_ALIASES
  .map(([month]) => month)
  .sort((a, b) => b.length - a.length)
  .map(escapeRegExp)
  .join("|");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

const keywordCategories = [
  ["delivery", ["доставка", "доставку", "курьер", "курьеру", "деливери", "delivery", "яндекс еда", "yandex food", "eda yandex", "delivery club", "деливери клаб", "самовывоз"]],
  ["food", ["обед", "ужин", "завтрак", "кофе", "кафе", "ресторан", "бургер", "суши", "пицца", "ланч", "еда"]],
  ["groceries", ["пятерочка", "пятёрочка", "пятерка", "пятёрка", "5ка", "5 ка", "x5", "перекресток", "перекрёсток", "перекресток впрок", "впрок", "магнит", "магнит семейный", "дикси", "лента", "ашан", "вкусвилл", "вкус вилл", "азбука", "азбука вкуса", "самокат", "лавка", "яндекс лавка", "озон фреш", "ozon fresh", "сбермаркет", "купер", "утконос", "верный", "монетка", "окей", "o'кей", "spar", "eurospar", "глобус", "мираторг", "мяснов", "продукт", "продукты", "рынок", "овощ", "молоко"]],
  ["transport", ["такси", "uber", "яндекс go", "метро", "автобус", "транспорт", "бензин", "парков", "каршер", "поезд"]],
  ["home", ["квартира", "квартиру", "квартире", "квартиры", "квартплата", "аренда", "аренд", "ипотека", "жкх", "коммун", "коммуналка", "коммунальные", "интернет", "мебель", "дом", "ремонт", "жилье", "жильё", "съем", "съём", "снимаю", "электричество", "свет", "вода", "газ"]],
  ["health", ["аптека", "врач", "клиник", "стомат", "анализ", "здоров", "лекар", "спортзал", "фитнес"]],
  ["subscriptions", ["netflix", "spotify", "youtube", "подпис", "apple", "icloud", "telegram", "vpn", "kinopoisk", "яндекс плюс"]],
  ["shopping", ["одеж", "маркет", "wildberries", "ozon", "авито", "подар", "книга", "техника", "магазин"]],
  ["travel", ["отель", "билет", "самолет", "аэро", "поездка", "airbnb", "travel", "путеше"]]
];

function nowIso() {
  return new Date().toISOString();
}

function appDateParts(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = Number(part.value);
    return acc;
  }, {});
}

function appDateTimeParts(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = Number(part.value);
    return acc;
  }, {});
}

function timeZoneOffsetMs(date) {
  const parts = appDateTimeParts(date);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(year, monthIndex, day, hour = 0, minute = 0, second = 0) {
  const guess = new Date(Date.UTC(year, monthIndex, day, hour, minute, second, 0));
  const first = new Date(guess.getTime() - timeZoneOffsetMs(guess));
  return new Date(guess.getTime() - timeZoneOffsetMs(first));
}

function businessToday(now = new Date()) {
  const parts = appDateParts(now);
  return zonedDateTimeToUtc(parts.year, parts.month - 1, parts.day, 0, 0, 0);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

function dayIso(daysAgo, hour = 12) {
  const date = addDays(businessToday(), -daysAgo);
  return new Date(date.getTime() + hour * 60 * 60 * 1000).toISOString();
}

function createSeedData() {
  return {
    settings: {
      monthlyBudget: 120000,
      categoryBudgets: {},
      currency: "RUB",
      locale: "ru-RU"
    },
    transactions: [
      txSeed("Зарплата", 185000, "income", "income", 2, "bank", 0.99),
      txSeed("Обед с командой", 1480, "expense", "food", 0, "local", 0.92),
      txSeed("Такси после встречи", 760, "expense", "transport", 0, "local", 0.9),
      txSeed("Продукты на неделю", 5400, "expense", "groceries", 1, "local", 0.93),
      txSeed("Кофе и завтрак", 690, "expense", "food", 1, "local", 0.92),
      txSeed("Подписка на музыку", 399, "expense", "subscriptions", 2, "local", 0.94),
      txSeed("Аптека", 1260, "expense", "health", 3, "local", 0.89),
      txSeed("Ozon: кабель и блокнот", 2310, "expense", "shopping", 5, "local", 0.86),
      txSeed("Метро", 150, "expense", "transport", 6, "local", 0.9),
      txSeed("Ужин", 2100, "expense", "food", 7, "local", 0.88),
      txSeed("Интернет дома", 850, "expense", "home", 8, "local", 0.94)
    ]
  };
}

function txSeed(title, amount, type, category, daysAgo, source, confidence) {
  return {
    id: crypto.randomUUID(),
    rawText: title,
    title,
    amount,
    type,
    category,
    vendor: "",
    note: "",
    occurredAt: dayIso(daysAgo),
    createdAt: dayIso(daysAgo),
    confidence,
    source
  };
}

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(createEmptyStore(), null, 2), "utf8");
  }
}

async function readStore() {
  if (isSupabaseConfigured()) {
    const store = await readSupabaseStore();
    const migrated = normalizeStore(store);
    if (migrated.changed) await writeSupabaseStore(migrated.store);
    return migrated.store;
  }

  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  let store = JSON.parse(raw);
  const migrated = normalizeStore(store);
  store = migrated.store;
  if (migrated.changed) await writeStore(store);
  return store;
}

async function writeStore(store) {
  if (isSupabaseConfigured()) {
    await writeSupabaseStore(store);
    return;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && supabaseSecretKey());
}

function supabaseSecretKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function supabaseRestBase() {
  return String(process.env.SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "") + "/rest/v1";
}

async function supabaseRequest(pathname, options = {}) {
  const response = await fetch(`${supabaseRestBase()}${pathname}`, {
    ...options,
    headers: {
      apikey: supabaseSecretKey(),
      authorization: `Bearer ${supabaseSecretKey()}`,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = json?.message || json?.error || text || `Supabase ${response.status}`;
    throw new Error(message);
  }
  return json;
}

async function readSupabaseStore() {
  const [users, sessions, categories, transactions] = await Promise.all([
    supabaseRequest("/users?select=*"),
    supabaseRequest("/sessions?select=*"),
    supabaseRequest("/categories?select=*"),
    supabaseRequest("/transactions?select=*")
  ]);

  const customByUser = groupBy(categories, "user_id");
  const transactionsByUser = groupBy(transactions, "user_id");

  return {
    schemaVersion: 3,
    sessions: sessions.map(rowToSession),
    users: users.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash,
      passwordSalt: row.password_salt,
      createdAt: row.created_at,
      settings: row.settings || defaultSettings(),
      customCategories: (customByUser.get(row.id) || []).map(rowToCategory),
      transactions: (transactionsByUser.get(row.id) || []).map(rowToTransaction)
    }))
  };
}

async function writeSupabaseStore(store) {
  const normalized = normalizeStore(store).store;
  const userRows = normalized.users.map(userToRow);
  const sessionRows = normalized.sessions.map(sessionToRow);
  const categoryRows = normalized.users.flatMap((user) => normalizeCustomCategories(user.customCategories).map((category) => categoryToRow(user.id, category)));
  const transactionRows = normalized.users.flatMap((user) => user.transactions.map((transaction) => transactionToRow(user.id, transaction)));

  await syncTable("users", userRows);
  await syncTable("sessions", sessionRows);
  await syncTable("categories", categoryRows);
  await syncTable("transactions", transactionRows);
}

async function syncTable(table, rows) {
  const existing = await supabaseRequest(`/${table}?select=id`);
  const desiredIds = new Set(rows.map((row) => String(row.id)));
  const staleIds = existing.map((row) => String(row.id)).filter((id) => !desiredIds.has(id));

  for (const id of staleIds) {
    await supabaseRequest(`/${table}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  if (!rows.length) return;
  await supabaseRequest(`/${table}?on_conflict=id`, {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(rows)
  });
}

function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows || []) {
    const value = row[key];
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return groups;
}

function userToRow(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    password_hash: user.passwordHash,
    password_salt: user.passwordSalt,
    settings: normalizeSettings(user.settings),
    created_at: user.createdAt || nowIso()
  };
}

function sessionToRow(session) {
  return {
    id: session.id,
    user_id: session.userId,
    created_at: session.createdAt || nowIso(),
    expires_at: session.expiresAt
  };
}

function categoryToRow(userId, category) {
  return {
    id: category.id,
    user_id: userId,
    label: category.label,
    color: category.color,
    icon: category.icon || "dot",
    custom: true
  };
}

function transactionToRow(userId, transaction) {
  return {
    id: transaction.id,
    user_id: userId,
    raw_text: transaction.rawText,
    title: transaction.title,
    amount: transaction.amount,
    type: transaction.type,
    category: transaction.category,
    vendor: transaction.vendor || "",
    note: transaction.note || "",
    occurred_at: transaction.occurredAt,
    created_at: transaction.createdAt || nowIso(),
    confidence: transaction.confidence,
    source: transaction.source
  };
}

function rowToSession(row) {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}

function rowToCategory(row) {
  return {
    id: row.id,
    label: row.label,
    icon: row.icon || "dot",
    color: row.color,
    custom: Boolean(row.custom)
  };
}

function rowToTransaction(row) {
  return {
    id: row.id,
    rawText: row.raw_text,
    title: row.title,
    amount: roundMoney(row.amount),
    type: row.type,
    category: row.category,
    vendor: row.vendor || "",
    note: row.note || "",
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    confidence: Number(row.confidence || 0.74),
    source: row.source || "local"
  };
}

function createEmptyStore() {
  return {
    schemaVersion: 3,
    users: [],
    sessions: []
  };
}

function defaultSettings() {
  return {
    monthlyBudget: 120000,
    categoryBudgets: {},
    currency: "RUB",
    locale: "ru-RU"
  };
}

function sanitizeCategoryBudgets(input, allowedIds = null) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const result = {};
  for (const [id, value] of Object.entries(source)) {
    if (allowedIds && !allowedIds.has(id)) continue;
    const amount = roundMoney(Number(value));
    if (Number.isFinite(amount) && amount > 0) result[id] = amount;
  }
  return result;
}

function normalizeSettings(settings) {
  const defaults = defaultSettings();
  const source = settings && typeof settings === "object" ? settings : {};
  const monthlyBudget = Number(source.monthlyBudget);
  return {
    ...defaults,
    ...source,
    monthlyBudget: Number.isFinite(monthlyBudget) && monthlyBudget >= 0 ? roundMoney(monthlyBudget) : defaults.monthlyBudget,
    categoryBudgets: sanitizeCategoryBudgets(source.categoryBudgets)
  };
}

function categoriesFor(user) {
  return [
    ...CATEGORIES,
    ...normalizeCustomCategories(user?.customCategories || [])
  ];
}

function categoryIdsFor(user) {
  return new Set(categoriesFor(user).map((category) => category.id));
}

function normalizeCustomCategories(categories) {
  if (!Array.isArray(categories)) return [];
  return categories
    .filter((category) => category && typeof category === "object")
    .map((category, index) => ({
      id: String(category.id || "").startsWith("custom_")
        ? String(category.id)
        : `custom_${crypto.createHash("sha1").update(String(category.label || index)).digest("hex").slice(0, 10)}`,
      label: cleanTitle(category.label || "").slice(0, 32),
      icon: "dot",
      color: category.color || CUSTOM_CATEGORY_COLORS[index % CUSTOM_CATEGORY_COLORS.length],
      custom: true
    }))
    .filter((category) => category.label.length >= 2);
}

function categoryLabelKey(label) {
  return String(label || "").trim().toLocaleLowerCase("ru-RU");
}

function normalizeStore(store) {
  let changed = false;
  if (!Array.isArray(store.users)) {
    const seed = createSeedData();
    const legacyUser = {
      id: crypto.randomUUID(),
      name: "Demo",
      email: "demo@finley.local",
      passwordHash: null,
      passwordSalt: null,
      createdAt: nowIso(),
      settings: normalizeSettings(store.settings || seed.settings),
      customCategories: [],
      transactions: Array.isArray(store.transactions) ? store.transactions : seed.transactions
    };
    return {
      changed: true,
      store: {
        schemaVersion: 3,
        users: [legacyUser],
        sessions: []
      }
    };
  }

  if (!Array.isArray(store.sessions)) {
    store.sessions = [];
    changed = true;
  }
  store.schemaVersion = 3;
  const now = Date.now();
  const activeSessions = store.sessions.filter((session) => new Date(session.expiresAt).getTime() > now);
  if (activeSessions.length !== store.sessions.length) {
    store.sessions = activeSessions;
    changed = true;
  }
  for (const user of store.users) {
    if (!user.id) {
      user.id = crypto.randomUUID();
      changed = true;
    }
    const normalizedSettings = normalizeSettings(user.settings);
    if (JSON.stringify(user.settings || {}) !== JSON.stringify(normalizedSettings)) {
      user.settings = normalizedSettings;
      changed = true;
    }
    if (!Array.isArray(user.transactions)) {
      user.transactions = [];
      changed = true;
    }
    const normalizedCategories = normalizeCustomCategories(user.customCategories);
    if (JSON.stringify(user.customCategories || []) !== JSON.stringify(normalizedCategories)) {
      user.customCategories = normalizedCategories;
      changed = true;
    }
  }
  return { store, changed };
}

function monthRange(anchor = new Date()) {
  const parts = appDateParts(anchor);
  const start = zonedDateTimeToUtc(parts.year, parts.month - 1, 1, 0, 0, 0);
  const end = parts.month === 12
    ? zonedDateTimeToUtc(parts.year + 1, 0, 1, 0, 0, 0)
    : zonedDateTimeToUtc(parts.year, parts.month, 1, 0, 0, 0);
  return { start, end };
}

function isInRange(iso, start, end) {
  const time = new Date(iso).getTime();
  return time >= start.getTime() && time < end.getTime();
}

function daysBetween(from, to) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function summarize(store) {
  const today = businessToday();
  const { start, end } = monthRange(today);
  const settings = store.settings;
  const categories = categoriesFor(store);
  const categoryBudgets = sanitizeCategoryBudgets(settings.categoryBudgets, categoryIdsFor(store));
  const monthTransactions = store.transactions.filter((transaction) => isInRange(transaction.occurredAt, start, end));
  const expenses = monthTransactions.filter((transaction) => transaction.type === "expense");
  const incomeItems = monthTransactions.filter((transaction) => transaction.type === "income");
  const tomorrow = addDays(today, 1);
  const realizedExpenses = expenses.filter((transaction) => new Date(transaction.occurredAt) < tomorrow);
  const scheduledMonthExpenses = expenses.filter((transaction) => new Date(transaction.occurredAt) >= tomorrow);
  const spent = roundMoney(expenses.reduce((sum, transaction) => sum + transaction.amount, 0));
  const realizedSpent = roundMoney(realizedExpenses.reduce((sum, transaction) => sum + transaction.amount, 0));
  const scheduledMonthSpent = roundMoney(scheduledMonthExpenses.reduce((sum, transaction) => sum + transaction.amount, 0));
  const income = roundMoney(incomeItems.reduce((sum, transaction) => sum + transaction.amount, 0));
  const baseBudget = Number(settings.monthlyBudget || 0);
  const budget = roundMoney(baseBudget + income);
  const remaining = roundMoney(budget - spent);
  const daysElapsed = daysBetween(start, today);
  const daysInMonth = Math.round((end - start) / 86400000);
  const daysLeft = Math.max(0, daysInMonth - daysElapsed);
  const projectedDailySpend = daysLeft > 0 ? (realizedSpent / Math.max(1, daysElapsed)) * daysLeft : 0;
  const projected = roundMoney(realizedSpent + scheduledMonthSpent + projectedDailySpend);
  const dailySafeSpend = roundMoney(remaining > 0 ? remaining / Math.max(1, daysLeft || 1) : 0);
  const budgetRatio = budget > 0 ? spent / budget : 0;
  const projectedRatio = budget > 0 ? projected / budget : 0;
  const status = projectedRatio > 1.05 ? "over" : projectedRatio > 0.92 ? "watch" : "on-track";

  const categoryTotals = categories.map((category) => {
    const total = expenses
      .filter((transaction) => transaction.category === category.id)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const categoryBudget = roundMoney(categoryBudgets[category.id] || 0);
    const categoryBudgetRatio = categoryBudget > 0 ? total / categoryBudget : 0;
    return {
      ...category,
      total: roundMoney(total),
      share: spent ? total / spent : 0,
      budget: categoryBudget,
      budgetRemaining: categoryBudget > 0 ? roundMoney(categoryBudget - total) : 0,
      budgetRatio: categoryBudgetRatio,
      budgetStatus: categoryBudgetRatio > 1 ? "over" : categoryBudgetRatio >= 0.8 ? "watch" : "on-track"
    };
  })
    .filter((category) => category.total > 0 || category.budget > 0)
    .sort((a, b) => (b.total - a.total) || (b.budget - a.budget));

  const weekStart = addDays(today, -6);
  const weekEnd = addDays(today, 1);
  const weekExpenses = store.transactions.filter((transaction) => (
    transaction.type === "expense"
    && new Date(transaction.occurredAt) >= weekStart
    && new Date(transaction.occurredAt) < weekEnd
  ));
  const weekSpent = roundMoney(weekExpenses.reduce((sum, transaction) => sum + transaction.amount, 0));
  const topWeekCategory = categoryTotalsFor(weekExpenses, categories)[0] || null;
  const futureExpenses = store.transactions
    .filter((transaction) => transaction.type === "expense" && new Date(transaction.occurredAt) >= tomorrow)
    .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));
  const futureSpent = roundMoney(futureExpenses.reduce((sum, transaction) => sum + transaction.amount, 0));

  return {
    currency: settings.currency || "RUB",
    monthLabel: today.toLocaleDateString(settings.locale || "ru-RU", { month: "long", year: "numeric", timeZone: APP_TIME_ZONE }),
    baseBudget,
    budget,
    spent,
    income,
    remaining,
    projected,
    dailySafeSpend,
    daysElapsed,
    daysInMonth,
    daysLeft,
    budgetRatio,
    projectedRatio,
    status,
    categoryTotals,
    week: {
      spent: weekSpent,
      topCategory: topWeekCategory,
      transactionCount: weekExpenses.length
    },
    future: {
      spent: futureSpent,
      transactionCount: futureExpenses.length,
      nextAt: futureExpenses[0]?.occurredAt || null
    }
  };
}

function categoryTotalsFor(transactions, categories = CATEGORIES) {
  const expenses = transactions.filter((transaction) => transaction.type === "expense");
  const spent = expenses.reduce((sum, transaction) => sum + transaction.amount, 0);
  return categories.map((category) => {
    const total = expenses
      .filter((transaction) => transaction.category === category.id)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    return {
      ...category,
      total: roundMoney(total),
      share: spent ? total / spent : 0
    };
  })
    .filter((category) => category.total > 0)
    .sort((a, b) => b.total - a.total);
}

function buildInsights(store, summary) {
  const insights = [];
  const top = summary.categoryTotals[0];
  const variableCategories = ["food", "groceries", "delivery", "transport", "shopping"];
  const variableTop = summary.categoryTotals.find((category) => variableCategories.includes(category.id));
  const other = summary.categoryTotals.find((category) => category.id === "other");
  const budgetedCategories = summary.categoryTotals
    .filter((category) => category.budget > 0)
    .sort((a, b) => b.budgetRatio - a.budgetRatio);
  const overBudgetCategory = budgetedCategories.find((category) => category.budgetRatio > 1);
  const nearBudgetCategory = budgetedCategories.find((category) => category.budgetRatio >= 0.8 && category.budgetRatio <= 1);

  if (overBudgetCategory) {
    insights.push({
      tone: "danger",
      title: `${overBudgetCategory.label} выше лимита на ${formatRub(Math.abs(overBudgetCategory.budgetRemaining))}`,
      body: `Лимит категории: ${formatRub(overBudgetCategory.budget)}. Уже потрачено ${formatRub(overBudgetCategory.total)}, поэтому новые траты здесь сразу давят на общий бюджет.`,
      action: "Смотреть операции",
      metric: `${Math.round(overBudgetCategory.budgetRatio * 100)}%`,
      detail: "Это самый точный сигнал для поведения: режьте не весь месяц сразу, а конкретную категорию с превышением.",
      impact: formatRub(Math.abs(overBudgetCategory.budgetRemaining))
    });
  } else if (nearBudgetCategory) {
    insights.push({
      tone: "warn",
      title: `${nearBudgetCategory.label} близко к лимиту`,
      body: `Лимит ${formatRub(nearBudgetCategory.budget)}, осталось ${formatRub(Math.max(0, nearBudgetCategory.budgetRemaining))}. Проверьте следующую покупку в этой категории до оплаты.`,
      action: "Смотреть операции",
      metric: `${Math.round(nearBudgetCategory.budgetRatio * 100)}%`,
      detail: "Категорийный лимит помогает поймать проблему раньше, чем общий месячный бюджет станет красным.",
      impact: formatRub(nearBudgetCategory.budgetRemaining)
    });
  }

  if (summary.projected > summary.budget && summary.budget > 0) {
    const monthlyGap = summary.projected - summary.budget;
    const dailyCorrection = roundMoney(monthlyGap / Math.max(1, summary.daysLeft || 1));
    insights.push({
      tone: "danger",
      title: `Снизить темп на ${formatRub(dailyCorrection)} в день`,
      body: `Текущий прогноз: ${formatRub(summary.projected)} при бюджете ${formatRub(summary.budget)}. Самый быстрый рычаг - ограничить переменные расходы до конца месяца.`,
      action: "Держать дневной лимит",
      metric: `${Math.round(summary.projectedRatio * 100)}%`,
      detail: `Ориентир на сегодня: не больше ${formatRub(summary.dailySafeSpend)}. Все, что выше, увеличит перерасход.`,
      impact: formatRub(monthlyGap)
    });
  } else {
    insights.push({
      tone: "good",
      title: `Можно тратить до ${formatRub(summary.dailySafeSpend)} в день`,
      body: `Финальный прогноз сейчас ${formatRub(summary.projected)}. При таком темпе месяц закрывается внутри бюджета.`,
      action: "Сохранить темп",
      metric: `${Math.round(summary.projectedRatio * 100)}%`,
      detail: `Запас до бюджета: ${formatRub(Math.max(0, summary.budget - summary.projected))}. Не тратьте его на мелкие импульсные покупки.`,
      impact: formatRub(summary.remaining)
    });
  }

  if (summary.future.transactionCount > 0) {
    insights.push({
      tone: summary.future.spent > summary.dailySafeSpend * 2 ? "warn" : "neutral",
      title: "Будущие списания уже давят на прогноз",
      body: `Запланировано ${summary.future.transactionCount} операций на ${formatRub(summary.future.spent)}. Проверьте, останется ли дневной лимит положительным после этих списаний.`,
      action: "Проверить будущие",
      metric: formatRub(summary.future.spent),
      detail: "Если это обязательные платежи, лучше считать их уже потраченными.",
      impact: `${summary.future.transactionCount} шт.`
    });
  }

  if (top) {
    const share = Math.round(top.share * 100);
    insights.push({
      tone: share > 42 ? "warn" : "neutral",
      title: `${top.label} забирает ${share}% расходов`,
      body: share > 42
        ? `Это главный драйвер недели. Сокращение этой категории на 15% освободит примерно ${formatRub(top.total * 0.15)}.`
        : `Категория выглядит контролируемо, но она все еще первая по сумме: ${formatRub(top.total)}.`,
      action: "Смотреть траты",
      metric: formatRub(top.total),
      detail: `Практичный тест: следующие 3 операции в этой категории добавляйте до покупки, а не после.`,
      impact: formatRub(top.total * 0.15)
    });
  }

  if (variableTop && variableTop.total > 0) {
    insights.push({
      tone: variableTop.share > 0.28 ? "warn" : "neutral",
      title: `Поставить мягкий потолок на ${variableTop.label.toLowerCase()}`,
      body: `Категория гибкая, значит ее проще всего корректировать без боли. Минус 10% даст ${formatRub(variableTop.total * 0.1)} запаса.`,
      action: "Смотреть операции",
      metric: `-${formatRub(variableTop.total * 0.1)}`,
      detail: "Лучше один конкретный лимит на неделю, чем обещание «тратить меньше».",
      impact: formatRub(variableTop.total)
    });
  }

  if (other && other.share > 0.18) {
    insights.push({
      tone: "warn",
      title: "Слишком много уходит в «Другое»",
      body: `${formatRub(other.total)} не объясняют поведение. Разберите 2-3 операции и создайте отдельные категории, иначе советы будут терять точность.`,
      action: "Разобрать историю",
      metric: `${Math.round(other.share * 100)}%`,
      detail: "Когда «Другое» меньше 10%, картина бюджета становится намного честнее.",
      impact: formatRub(other.total)
    });
  }

  const subscriptions = summary.categoryTotals.find((category) => category.id === "subscriptions");
  if (subscriptions && subscriptions.total > summary.budget * 0.04) {
    insights.push({
      tone: "warn",
      title: "Подписки стали заметной строкой",
      body: `На подписки уже ушло ${formatRub(subscriptions.total)}. Проверьте сервисы, которыми не пользовались последние 30 дней.`,
      action: "Почистить подписки",
      metric: formatRub(subscriptions.total),
      detail: `Даже отмена одной подписки на ${formatRub(subscriptions.total * 0.25)} улучшит прогноз.`,
      impact: formatRub(subscriptions.total * 0.25)
    });
  }

  if (summary.week.transactionCount < 3) {
    insights.push({
      tone: "neutral",
      title: "Данных пока мало",
      body: "Добавьте 3-5 реальных операций за неделю, и Finley начнет давать более точные рекомендации по поведению.",
      action: "Добавить операции",
      metric: `${summary.week.transactionCount}/5`,
      detail: "Минимум для полезных советов: еда, транспорт, дом и один любой регулярный платеж.",
      impact: "точность"
    });
  }

  return insights.slice(0, 7);
}

function formatRub(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(value);
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function responseJson(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...headers
  });
  res.end(body);
}

function responseError(res, status, message, details = null) {
  responseJson(res, status, { error: message, details });
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      throw new Error("Payload too large");
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(header.split(";").map((part) => {
    const [name, ...value] = part.trim().split("=");
    return [name, decodeURIComponent(value.join("=") || "")];
  }).filter(([name]) => name));
}

function sessionCookie(value, maxAgeSeconds) {
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase().slice(0, 160);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}

function passwordDigest(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key.toString("hex"));
    });
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await passwordDigest(password, salt);
  return { salt, hash };
}

async function verifyPassword(password, user) {
  if (!user?.passwordHash || !user?.passwordSalt) return false;
  const hash = await passwordDigest(password, user.passwordSalt);
  const left = Buffer.from(hash, "hex");
  const right = Buffer.from(user.passwordHash, "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createSession(store, userId) {
  const session = {
    id: crypto.randomBytes(32).toString("hex"),
    userId,
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString()
  };
  store.sessions.push(session);
  return session;
}

async function getAuthContext(req) {
  const store = await readStore();
  const sessionId = parseCookies(req)[SESSION_COOKIE];
  if (!sessionId) return { store, user: null, session: null };
  const session = store.sessions.find((item) => item.id === sessionId && new Date(item.expiresAt).getTime() > Date.now());
  if (!session) return { store, user: null, session: null };
  const user = store.users.find((item) => item.id === session.userId) || null;
  return { store, user, session };
}

async function requireAuth(req, res) {
  const context = await getAuthContext(req);
  if (!context.user) {
    responseError(res, 401, "Нужно войти в профиль.");
    return null;
  }
  return context;
}

async function apiMe(req, res) {
  const context = await getAuthContext(req);
  responseJson(res, 200, { user: context.user ? publicUser(context.user) : null });
}

async function apiSignup(req, res) {
  const body = await readJson(req);
  const name = String(body.name || "").trim().slice(0, 60);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  if (name.length < 2) return responseError(res, 422, "Введите имя профиля.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return responseError(res, 422, "Введите корректную почту.");
  if (password.length < 8) return responseError(res, 422, "Пароль должен быть не короче 8 символов.");

  const store = await readStore();
  if (store.users.some((user) => user.email === email)) {
    return responseError(res, 409, "Профиль с такой почтой уже существует.");
  }

  const passwordRecord = await hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash: passwordRecord.hash,
    passwordSalt: passwordRecord.salt,
    createdAt: nowIso(),
    settings: defaultSettings(),
    customCategories: [],
    transactions: []
  };
  store.users.push(user);
  const session = createSession(store, user.id);
  await writeStore(store);
  responseJson(res, 201, { user: publicUser(user) }, {
    "set-cookie": sessionCookie(session.id, Math.floor(SESSION_MAX_AGE_MS / 1000))
  });
}

async function apiLogin(req, res) {
  const body = await readJson(req);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const store = await readStore();
  const user = store.users.find((item) => item.email === email);
  if (!user || !(await verifyPassword(password, user))) {
    return responseError(res, 401, "Почта или пароль не подходят.");
  }

  const session = createSession(store, user.id);
  await writeStore(store);
  responseJson(res, 200, { user: publicUser(user) }, {
    "set-cookie": sessionCookie(session.id, Math.floor(SESSION_MAX_AGE_MS / 1000))
  });
}

async function apiLogout(req, res) {
  const store = await readStore();
  const sessionId = parseCookies(req)[SESSION_COOKIE];
  if (sessionId) {
    store.sessions = store.sessions.filter((session) => session.id !== sessionId);
    await writeStore(store);
  }
  responseJson(res, 200, { ok: true }, {
    "set-cookie": sessionCookie("", 0)
  });
}

async function apiState(req, res) {
  const context = await requireAuth(req, res);
  if (!context) return;
  const user = context.user;
  const summary = summarize(user);
  responseJson(res, 200, {
    user: publicUser(user),
    settings: user.settings,
    categories: categoriesFor(user),
    summary,
    insights: buildInsights(user, summary),
    transactions: user.transactions
      .slice()
      .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
  });
}

async function apiCreateTransaction(req, res) {
  const context = await requireAuth(req, res);
  if (!context) return;
  const body = await readJson(req);
  const rawText = String(body.text || "").trim().slice(0, 240);
  if (rawText.length < 2) {
    return responseError(res, 422, "Введите транзакцию одной фразой.");
  }

  const requestedOccurredAt = normalizeDate(body.occurredAt || body.date);
  const classification = await classifyTransaction(rawText, context.user);
  const transaction = {
    id: crypto.randomUUID(),
    rawText,
    title: classification.title,
    amount: classification.amount,
    type: classification.type,
    category: classification.category,
    vendor: classification.vendor || "",
    note: classification.note || "",
    occurredAt: requestedOccurredAt || classification.occurredAt,
    createdAt: nowIso(),
    confidence: classification.confidence,
    source: classification.source
  };

  context.user.transactions.push(transaction);
  await writeStore(context.store);
  const summary = summarize(context.user);
  responseJson(res, 201, {
    transaction,
    summary,
    insights: buildInsights(context.user, summary),
    ai: classification.ai
  });
}

async function apiPatchTransaction(req, res, id) {
  const context = await requireAuth(req, res);
  if (!context) return;
  const body = await readJson(req);
  const transaction = context.user.transactions.find((item) => item.id === id);
  if (!transaction) return responseError(res, 404, "Транзакция не найдена.");

  if (body.title !== undefined) transaction.title = String(body.title).trim().slice(0, 80) || transaction.title;
  if (body.category !== undefined && categoryIdsFor(context.user).has(body.category)) transaction.category = body.category;
  if (body.amount !== undefined && Number(body.amount) > 0) transaction.amount = roundMoney(Number(body.amount));
  if (body.type !== undefined && ["expense", "income"].includes(body.type)) transaction.type = body.type;
  if (body.occurredAt !== undefined && !Number.isNaN(new Date(body.occurredAt).getTime())) {
    transaction.occurredAt = new Date(body.occurredAt).toISOString();
  }

  await writeStore(context.store);
  const summary = summarize(context.user);
  responseJson(res, 200, {
    transaction,
    summary,
    insights: buildInsights(context.user, summary)
  });
}

async function apiDeleteTransaction(req, res, id) {
  return apiDeleteUserTransaction(req, res, id);
}

async function apiClearTransactions(req, res) {
  const context = await requireAuth(req, res);
  if (!context) return;

  context.user.transactions = [];
  await writeStore(context.store);
  const summary = summarize(context.user);
  responseJson(res, 200, {
    ok: true,
    transactions: [],
    summary,
    insights: buildInsights(context.user, summary)
  });
}

async function apiDeleteUserTransaction(req, res, id) {
  const context = await requireAuth(req, res);
  if (!context) return;
  const before = context.user.transactions.length;
  context.user.transactions = context.user.transactions.filter((item) => item.id !== id);
  if (context.user.transactions.length === before) return responseError(res, 404, "Транзакция не найдена.");

  await writeStore(context.store);
  const summary = summarize(context.user);
  responseJson(res, 200, {
    ok: true,
    summary,
    insights: buildInsights(context.user, summary)
  });
}

async function apiUpdateSettings(req, res) {
  const context = await requireAuth(req, res);
  if (!context) return;
  const body = await readJson(req);

  context.user.settings = normalizeSettings(context.user.settings);

  if (body.monthlyBudget !== undefined) {
    const monthlyBudget = Number(body.monthlyBudget);
    if (!Number.isFinite(monthlyBudget) || monthlyBudget < 0) {
      return responseError(res, 422, "Бюджет должен быть числом.");
    }
    context.user.settings.monthlyBudget = roundMoney(monthlyBudget);
  }

  if (body.categoryBudgets !== undefined) {
    context.user.settings.categoryBudgets = sanitizeCategoryBudgets(
      body.categoryBudgets,
      categoryIdsFor(context.user)
    );
  }

  context.user.settings.categoryBudgets = sanitizeCategoryBudgets(
    context.user.settings.categoryBudgets,
    categoryIdsFor(context.user)
  );

  await writeStore(context.store);
  const summary = summarize(context.user);
  responseJson(res, 200, {
    settings: context.user.settings,
    summary,
    insights: buildInsights(context.user, summary)
  });
}

async function apiCreateCategory(req, res) {
  const context = await requireAuth(req, res);
  if (!context) return;
  const body = await readJson(req);
  const label = cleanTitle(body.label || "").slice(0, 32);
  if (label.length < 2) return responseError(res, 422, "Введите название категории.");

  const existing = categoriesFor(context.user);
  const requestedKey = categoryLabelKey(label);
  if (existing.some((category) => categoryLabelKey(category.label) === requestedKey)) {
    return responseError(res, 409, "Такая категория уже есть.");
  }

  context.user.customCategories = normalizeCustomCategories(context.user.customCategories);
  const category = {
    id: `custom_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
    label,
    icon: "dot",
    color: CUSTOM_CATEGORY_COLORS[context.user.customCategories.length % CUSTOM_CATEGORY_COLORS.length],
    custom: true
  };
  context.user.customCategories.push(category);
  await writeStore(context.store);

  const summary = summarize(context.user);
  responseJson(res, 201, {
    category,
    categories: categoriesFor(context.user),
    summary,
    insights: buildInsights(context.user, summary)
  });
}

async function apiDeleteCategory(req, res, id) {
  const context = await requireAuth(req, res);
  if (!context) return;
  if (!String(id || "").startsWith("custom_")) return responseError(res, 403, "Базовые категории нельзя удалить.");

  context.user.customCategories = normalizeCustomCategories(context.user.customCategories);
  const before = context.user.customCategories.length;
  context.user.customCategories = context.user.customCategories.filter((category) => category.id !== id);
  if (context.user.customCategories.length === before) return responseError(res, 404, "Категория не найдена.");

  for (const transaction of context.user.transactions) {
    if (transaction.category === id) transaction.category = "other";
  }
  if (context.user.settings?.categoryBudgets) {
    delete context.user.settings.categoryBudgets[id];
  }

  await writeStore(context.store);
  const summary = summarize(context.user);
  responseJson(res, 200, {
    ok: true,
    categories: categoriesFor(context.user),
    settings: context.user.settings,
    summary,
    insights: buildInsights(context.user, summary),
    transactions: context.user.transactions
      .slice()
      .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
  });
}

async function classifyTransaction(rawText, user = null) {
  const explicitOccurredAt = parseExplicitDate(rawText);
  const heuristic = classifyByRules(rawText, user);
  if (!shouldUseLLM(heuristic)) {
    return {
      ...heuristic,
      occurredAt: explicitOccurredAt || heuristic.occurredAt,
      source: "local",
      ai: { provider: "Local rules", used: false, reason: "confident local match" }
    };
  }
  try {
    const llm = await classifyByLLM(rawText, heuristic);
    const normalized = normalizeClassification(rawText, heuristic, llm, user);
    return {
      ...normalized,
      occurredAt: explicitOccurredAt || normalized.occurredAt,
      source: "llm",
      ai: { provider: "Pollinations GPT", used: true }
    };
  } catch (error) {
    return {
      ...heuristic,
      occurredAt: explicitOccurredAt || heuristic.occurredAt,
      source: "local",
      ai: { provider: "Local rules", used: false, reason: error.message }
    };
  }
}

function shouldUseLLM(heuristic) {
  if (process.env.FINLEY_LLM_MODE === "always") return true;
  if (process.env.FINLEY_LLM_MODE === "off") return false;
  if (!process.env.OPENAI_API_KEY && process.env.FINLEY_USE_POLLINATIONS !== "true") return false;
  if (!heuristic.amount) return true;
  if (heuristic.type === "income") return false;
  if (heuristic.category && heuristic.category !== "other") return false;
  return true;
}

async function classifyByLLM(rawText, heuristic) {
  if (process.env.OPENAI_API_KEY) {
    return classifyByOpenAI(rawText, heuristic);
  }
  return classifyByPollinations(rawText, heuristic);
}

async function classifyByOpenAI(rawText, heuristic) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: llmSystemPrompt() },
          { role: "user", content: llmUserPrompt(rawText, heuristic) }
        ]
      })
    });
    if (!response.ok) throw new Error(`OpenAI ${response.status}`);
    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    return JSON.parse(content);
  } finally {
    clearTimeout(timeout);
  }
}

async function classifyByPollinations(rawText, heuristic) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "accept": "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.POLLINATIONS_MODEL || "openai",
        temperature: 0,
        messages: [
          { role: "system", content: llmSystemPrompt() },
          { role: "user", content: llmUserPrompt(rawText, heuristic) }
        ]
      })
    });
    if (!response.ok) throw new Error(`LLM ${response.status}`);
    const json = await response.json();
    return parseJsonFromText(json.choices?.[0]?.message?.content || "");
  } finally {
    clearTimeout(timeout);
  }
}

function llmSystemPrompt() {
  return [
    "You classify personal finance transactions from short Russian or English phrases.",
    "Return only valid minified JSON. No markdown.",
    "Allowed categories: food, groceries, delivery, transport, home, health, subscriptions, shopping, travel, income, other.",
    "Schema: {\"title\":\"short human label\",\"amount\":number,\"type\":\"expense|income\",\"category\":\"one allowed category\",\"vendor\":\"optional merchant\",\"note\":\"optional note\",\"confidence\":number,\"occurredAt\":\"ISO datetime or empty\"}.",
    "Use RUB unless another currency is explicit. Amount must be positive. If phrase means salary, refund, transfer received, or income, type is income and category is income."
  ].join(" ");
}

function llmUserPrompt(rawText, heuristic) {
  return JSON.stringify({
    today: businessToday().toISOString(),
    timeZone: APP_TIME_ZONE,
    phrase: rawText,
    ruleGuess: heuristic
  });
}

function parseJsonFromText(text) {
  const trimmed = String(text || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("LLM did not return JSON");
    return JSON.parse(match[0]);
  }
}

function normalizeClassification(rawText, heuristic, llm, user = null) {
  const amount = Number(llm.amount) > 0 ? roundMoney(Number(llm.amount)) : heuristic.amount;
  const type = ["expense", "income"].includes(llm.type) ? llm.type : heuristic.type;
  const categoryIds = categoryIdsFor(user);
  let category = categoryIds.has(llm.category)
    ? (type === "income" ? "income" : llm.category)
    : heuristic.category;
  if (type === "expense" && heuristic.category !== "other") {
    const shouldTrustRules = heuristic.category.startsWith("custom_")
      || llm.category === "other"
      || ["delivery", "groceries"].includes(heuristic.category);
    if (shouldTrustRules) category = heuristic.category;
  }
  const llmTitle = cleanTitle(llm.title);
  const title = isWeakTitle(llmTitle) ? heuristic.title : llmTitle || heuristic.title;
  const occurredAt = normalizeDate(llm.occurredAt) || heuristic.occurredAt;
  const confidence = clamp(Number(llm.confidence) || heuristic.confidence, 0.55, 0.99);

  return {
    title,
    amount,
    type,
    category,
    vendor: cleanTitle(llm.vendor || ""),
    note: cleanTitle(llm.note || ""),
    occurredAt,
    confidence
  };
}

function classifyByRules(rawText, user = null) {
  const lowered = normalizeKeywordText(rawText);
  const amount = parseAmount(lowered);
  const type = /(зарплат|пенси|пенсион|пособи|стипенди|получил|получила|доход|преми|возврат|кэшбек|кешбек|перевели|пришло|income|salary|pension|benefit|refund)/i.test(lowered)
    ? "income"
    : "expense";
  const category = type === "income" ? "income" : inferCategory(lowered, user);
  const title = inferTitle(rawText, category, type, user);
  return {
    title,
    amount,
    type,
    category,
    vendor: "",
    note: "",
    occurredAt: inferDate(lowered),
    confidence: amount > 0 ? 0.74 : 0.56,
    source: "local"
  };
}

function explicitDateRegex(flags = "iu") {
  return new RegExp(`(?:^|\\s)(\\d{1,2})\\s+(${MONTH_PATTERN})(?:\\s+(\\d{4}))?(?=\\s|$|[.,])`, flags);
}

function stripExplicitDates(text) {
  return String(text || "").replace(explicitDateRegex("giu"), " ");
}

function parseAmount(text) {
  const normalized = stripExplicitDates(text)
    .replace(/\u00a0/g, " ")
    .replace(/(\d)\s+(\d{3})(?!\d)/g, "$1$2");
  const match = normalized.match(/(?:^|\s)(\d+(?:[.,]\d+)?)(?:\s*)(к|k|тыс|тысяч)?/i);
  if (!match) return 0;
  const base = Number(match[1].replace(",", "."));
  if (!Number.isFinite(base)) return 0;
  const multiplier = match[2] ? 1000 : 1;
  return roundMoney(base * multiplier);
}

function normalizeKeywordText(value) {
  return String(value || "")
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryKeywordGroups(user = null) {
  return [
    ...customKeywordCategories(user),
    ...keywordCategories
  ];
}

function customKeywordCategories(user = null) {
  return normalizeCustomCategories(user?.customCategories)
    .map((category) => [category.id, customCategoryKeywords(category.label)]);
}

function customCategoryKeywords(label) {
  const normalized = normalizeKeywordText(label);
  const keywords = new Set(
    normalized
      .split(/[^a-zа-я0-9]+/i)
      .filter((word) => word.length > 2)
  );

  if (/(мобил|связ|телефон|сотов|оператор|сим)/i.test(normalized)) {
    [
      "мтс", "mts", "билайн", "beeline", "мегафон", "megafon",
      "теле2", "tele2", "йота", "yota", "тинькофф мобайл",
      "сбермобайл", "мобиль", "связ", "сотов", "сим", "телефон", "номер"
    ].forEach((word) => keywords.add(word));
  }

  if (/(интернет|провайдер|связ)/i.test(normalized)) {
    ["интернет", "провайдер", "wifi", "вайфай", "роутер"].forEach((word) => keywords.add(word));
  }

  if (/(питом|животн|кот|собак)/i.test(normalized)) {
    ["зоомагазин", "зоотовары", "питом", "вет", "корм", "лапы", "четыре лапы"].forEach((word) => keywords.add(word));
  }

  return [...keywords].map(normalizeKeywordText);
}

function inferCategory(lowered, user = null) {
  const normalized = normalizeKeywordText(lowered);
  if (/(^|\s)(квартир|квартплат|аренд|ипотек|жкх|коммун|жилье|съем|снимаю|электрич|свет|газ|вод[ауеы]?)(?=\s|$)/i.test(normalized)) {
    return "home";
  }
  for (const [category, words] of categoryKeywordGroups(user)) {
    if (words.some((word) => normalized.includes(normalizeKeywordText(word)))) return category;
  }
  return "other";
}

function inferTitle(rawText, category, type, user = null) {
  const withoutAmount = stripExplicitDates(rawText)
    .replace(/\d+(?:[\s.,]\d+)?\s*(?:рублей|рубля|руб|р|₽|к|k|тыс|тысяч)?/gi, "")
    .replace(/(^|\s)(потратил|потратила|потратилa|купил|купила|заплатил|заплатила|на|за|в|получил|получила|сегодня|вчера|позавчера|today|yesterday|spent|paid|bought|on|at)(?=\s|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (withoutAmount.length > 2) return cleanTitle(withoutAmount);
  const fallback = categoriesFor(user).find((item) => item.id === category)?.label || "Операция";
  return type === "income" ? "Доход" : fallback;
}

function parseExplicitDate(text) {
  const match = String(text || "").toLowerCase().match(explicitDateRegex());
  if (!match) return null;

  const day = Number(match[1]);
  const month = MONTH_INDEX.get(match[2]);
  if (!Number.isInteger(day) || month === undefined || day < 1 || day > 31) return null;

  const now = new Date();
  const nowParts = appDateParts(now);
  let year = match[3] ? Number(match[3]) : nowParts.year;
  let date = zonedDateTimeToUtc(year, month, day, 12, 0, 0);
  const parsedParts = appDateParts(date);
  if (parsedParts.year !== year || parsedParts.month !== month + 1 || parsedParts.day !== day) return null;

  if (!match[3]) {
    if (date < businessToday(now)) {
      year += 1;
      date = zonedDateTimeToUtc(year, month, day, 12, 0, 0);
    }
  }

  return date.toISOString();
}

function inferDate(lowered) {
  const explicit = parseExplicitDate(lowered);
  if (explicit) return explicit;

  let offset = 0;
  if (lowered.includes("позавчера")) offset = -2;
  else if (lowered.includes("вчера")) offset = -1;
  else if (lowered.includes("завтра")) offset = 1;
  const dayStart = addDays(businessToday(), offset);
  return new Date(dayStart.getTime() + 12 * 60 * 60 * 1000).toISOString();
}

function normalizeDate(value) {
  if (!value || typeof value !== "string") return null;
  const dayOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dayOnly) {
    const year = Number(dayOnly[1]);
    const month = Number(dayOnly[2]);
    const day = Number(dayOnly[3]);
    const date = zonedDateTimeToUtc(year, month - 1, day, 12, 0, 0);
    const parts = appDateParts(date);
    if (parts.year !== year || parts.month !== month || parts.day !== day) return null;
    return date.toISOString();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function cleanTitle(value) {
  const cleaned = String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 72);
  return cleaned ? cleaned[0].toLocaleUpperCase("ru-RU") + cleaned.slice(1) : "";
}

function isWeakTitle(value) {
  return !value
    || /\d/.test(value)
    || /(потратил|потратила|заплатил|заплатила|купил|купила|spent|paid|bought)/i.test(value);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

async function serveStatic(req, res, url) {
  const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const decoded = decodeURIComponent(requestPath);
  const safePath = path.resolve(PUBLIC_DIR, `.${decoded}`);
  if (!safePath.startsWith(path.resolve(PUBLIC_DIR))) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    const stat = await fs.stat(safePath);
    const filePath = stat.isDirectory() ? path.join(safePath, "index.html") : safePath;
    const ext = path.extname(filePath).toLowerCase();
    const body = await fs.readFile(filePath);
    res.writeHead(200, {
      "content-type": MIME_TYPES[ext] || "application/octet-stream",
      "cache-control": ext === ".html" ? "no-cache" : "public, max-age=3600",
      "x-content-type-options": "nosniff"
    });
    res.end(body);
  } catch {
    const indexPath = path.join(PUBLIC_DIR, "index.html");
    const body = await fs.readFile(indexPath);
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache"
    });
    res.end(body);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === "/api/auth/me" && req.method === "GET") return await apiMe(req, res);
    if (url.pathname === "/api/auth/signup" && req.method === "POST") return await apiSignup(req, res);
    if (url.pathname === "/api/auth/login" && req.method === "POST") return await apiLogin(req, res);
    if (url.pathname === "/api/auth/logout" && req.method === "POST") return await apiLogout(req, res);
    if (url.pathname === "/healthz" && req.method === "GET") return responseJson(res, 200, { ok: true });
    if (url.pathname === "/api/state" && req.method === "GET") return await apiState(req, res);
    if (url.pathname === "/api/categories" && req.method === "POST") return await apiCreateCategory(req, res);
    if (url.pathname.startsWith("/api/categories/") && req.method === "DELETE") {
      return await apiDeleteCategory(req, res, url.pathname.split("/").pop());
    }
    if (url.pathname === "/api/transactions" && req.method === "POST") return await apiCreateTransaction(req, res);
    if (url.pathname === "/api/transactions" && req.method === "DELETE") return await apiClearTransactions(req, res);
    if (url.pathname.startsWith("/api/transactions/") && req.method === "PATCH") {
      return await apiPatchTransaction(req, res, url.pathname.split("/").pop());
    }
    if (url.pathname.startsWith("/api/transactions/") && req.method === "DELETE") {
      return await apiDeleteUserTransaction(req, res, url.pathname.split("/").pop());
    }
    if (url.pathname === "/api/settings" && req.method === "PUT") return await apiUpdateSettings(req, res);
    if (url.pathname.startsWith("/api/")) return responseError(res, 404, "API route not found.");
    return await serveStatic(req, res, url);
  } catch (error) {
    const status = error.message === "Payload too large" ? 413 : 500;
    responseError(res, status, "Finley не смог обработать запрос.", process.env.NODE_ENV === "development" ? error.stack : error.message);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Finley is running on http://localhost:${PORT}`);
});
