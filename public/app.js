const app = document.querySelector("#app");
const APP_TIME_ZONE = "Europe/Moscow";

const views = [
  { id: "dashboard", label: "Обзор", short: "Бюджет" },
  { id: "quick", label: "Добавить", short: "Добавить" },
  { id: "history", label: "История", short: "История" },
  { id: "insights", label: "Советы", short: "Советы" },
  { id: "admin", label: "Пользователи", short: "Люди", adminOnly: true }
];

const iconPaths = {
  dashboard: '<path d="M4 13a8 8 0 1 1 16 0"/><path d="M12 13l4-4"/><path d="M4 13h3"/><path d="M17 13h3"/><path d="M12 5v3"/>',
  quick: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/>',
  insights: '<path d="M12 2v5"/><path d="M12 17v5"/><path d="M4.93 4.93l3.54 3.54"/><path d="M15.54 15.54l3.53 3.53"/><path d="M2 12h5"/><path d="M17 12h5"/><path d="M4.93 19.07l3.54-3.53"/><path d="M15.54 8.46l3.53-3.53"/>',
  admin: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
  send: '<path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4 20-7Z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/>',
  utensils: '<path d="M4 3v7"/><path d="M8 3v7"/><path d="M6 3v18"/><path d="M14 3v8a4 4 0 0 0 4 4v6"/><path d="M18 3v18"/>',
  basket: '<path d="m5 11 2-6"/><path d="m19 11-2-6"/><path d="M3 11h18l-2 9H5l-2-9Z"/><path d="M9 15v2"/><path d="M15 15v2"/>',
  truck: '<path d="M10 17h4V5H2v12h3"/><path d="M14 8h4l4 4v5h-3"/><path d="M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z"/><path d="M15 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z"/>',
  route: '<path d="M6 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M18 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M6 13V8a3 3 0 0 1 3-3h6"/><path d="M18 11v5a3 3 0 0 1-3 3H9"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  bag: '<path d="M6 8h12l1 13H5L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  plane: '<path d="M17.8 19.2 16 11l5-5a2 2 0 0 0-3-3l-5 5-8.2-1.8L3 8l6 4-4 4 3 1 1 3 4-4 4 6 1.8-2.8Z"/>',
  "arrow-down": '<path d="M12 3v18"/><path d="m6 15 6 6 6-6"/>',
  dot: '<circle cx="12" cy="12" r="3"/>'
};

let state = null;
let activeView = "dashboard";
let historyFilter = "week";
let historySearch = "";
let historyCategory = "all";
let historyWeekIndex = currentHistoryWeekIndex();
let dashboardMonthKey = monthKey(new Date());
let lastResult = null;
let toastTimer = null;
let authMode = "login";

const formatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0
});

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  timeZone: APP_TIME_ZONE
});

const weekdayFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "short",
  timeZone: APP_TIME_ZONE
});

init();

async function init() {
  activeView = currentHashView();
  window.addEventListener("hashchange", () => {
    activeView = currentHashView();
    render();
  });
  await boot();
}

function currentHashView() {
  const view = location.hash.replace("#", "") || "dashboard";
  return views.some((item) => item.id === view) ? view : "dashboard";
}

async function boot() {
  try {
    const session = await api("/api/auth/me");
    if (!session.user) {
      state = null;
      renderAuth();
      return;
    }
  } catch {}
  await loadState();
}

async function loadState() {
  try {
    state = await api("/api/state");
    render();
  } catch (error) {
    if (error.status === 401) {
      state = null;
      renderAuth();
      return;
    }
    app.innerHTML = `<div class="boot"><div class="boot-mark">F</div><div><strong>Finley</strong><span>${escapeHtml(error.message)}</span></div></div>`;
  }
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const json = await response.json();
  if (!response.ok) {
    const error = new Error(json.error || "Request failed");
    error.status = response.status;
    throw error;
  }
  return json;
}

function renderAuth() {
  const isSignup = authMode === "signup";
  app.className = "app-shell";
  app.innerHTML = `
    <main class="auth-shell">
      <section class="auth-hero">
        <div class="brand auth-brand">
          <div class="mark">F</div>
          <div><strong>Finley</strong><span>Личный ИИ-трекер финансов</span></div>
        </div>
        <div>
          <p class="eyebrow">${isSignup ? "Новый профиль" : "Вход"}</p>
          <h1>${isSignup ? "Создайте личный профиль" : "Войдите в свой профиль"}</h1>
          <p class="topbar-subtitle">Бюджет, история и советы теперь привязаны только к вашему аккаунту.</p>
        </div>
      </section>
      <section class="auth-card">
        <div class="panel-header">
          <div>
            <h2>${isSignup ? "Регистрация" : "Вход"}</h2>
            <p>${isSignup ? "Для каждого пользователя будет отдельный бюджет." : "Продолжите работу со своими транзакциями."}</p>
          </div>
        </div>
        <form class="auth-form" id="auth-form">
          ${isSignup ? `<label>Имя<input name="name" autocomplete="name" placeholder="Анна" required /></label>` : ""}
          <label>Почта<input name="email" type="email" autocomplete="email" placeholder="you@example.com" required /></label>
          <label>Пароль<input name="password" type="password" autocomplete="${isSignup ? "new-password" : "current-password"}" placeholder="Минимум 8 символов" required minlength="8" /></label>
          <button class="primary-button" type="submit">${isSignup ? "Создать профиль" : "Войти"}</button>
        </form>
        <button class="auth-switch" data-auth-mode="${isSignup ? "login" : "signup"}">
          ${isSignup ? "Уже есть профиль? Войти" : "Нет профиля? Создать"}
        </button>
      </section>
    </main>
  `;
  bindAuthEvents();
}

function render() {
  if (activeView === "admin" && !isAdmin()) activeView = "dashboard";
  const nav = renderNav("nav");
  const mobileNav = renderNav("mobile-nav", true);
  app.className = "app-shell";
  app.innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">
          <div class="mark">F</div>
          <div><strong>Finley</strong><span>ИИ-трекер финансов</span></div>
        </div>
        ${nav}
        <div class="sidebar-footer">
          ${renderUserProfile()}
          ${renderBudgetEditor()}
        </div>
      </aside>
      <main class="main">
        <div class="mobile-brand">
          <div class="mark">F</div>
          <div><strong>Finley</strong><span>${escapeHtml(state.user?.name || "Профиль")} · ${escapeHtml(state.summary.monthLabel)}</span></div>
        </div>
        ${renderTopbar()}
        ${mobileNav}
        ${renderActiveView()}
      </main>
    </div>
  `;
  bindEvents();
}

function renderTopbar() {
  const dashboardSummary = activeView === "dashboard" ? getDashboardSummary() : null;
  const showTopAdd = activeView !== "quick" && activeView !== "admin" && !(activeView === "dashboard" && dashboardSummary?.isCurrentMonth && dashboardSummary.status === "over");
  const copy = {
    dashboard: {
      eyebrow: "Обзор",
      title: dashboardTitle(),
      subtitle: "Один ответ на экран: укладываетесь ли вы в бюджет в этом месяце."
    },
    quick: {
      eyebrow: "Быстрое добавление",
      title: "Добавьте операцию одной фразой",
      subtitle: "Finley сам извлечет сумму, тип, дату и категорию, затем обновит картину месяца."
    },
    history: {
      eyebrow: "История",
      title: "Куда ушли деньги и что спишется дальше",
      subtitle: "Прошлые операции и будущие списания собраны в одном месте, чтобы бюджет не удивлял в конце месяца."
    },
    insights: {
      eyebrow: "Советы",
      title: "Что изменить в поведении",
      subtitle: "Один главный рычаг на сейчас, без бухгалтерского шума."
    },
    admin: {
      eyebrow: "Администрирование",
      title: "Информация о пользователях",
      subtitle: "Кто зарегистрирован, сколько активных сессий и как хранятся пароли."
    }
  }[activeView];

  return `
    <header class="topbar">
      <div class="topbar-text">
        <p class="eyebrow">${copy.eyebrow}</p>
        <h1>${escapeHtml(copy.title)}</h1>
        <p class="topbar-subtitle">${escapeHtml(copy.subtitle)}</p>
      </div>
      <div class="topbar-actions">
        ${showTopAdd ? `<button class="primary-button" data-view-link="quick" title="Добавить транзакцию">${icon("quick")} Добавить</button>` : ""}
        <button class="ghost-button" data-logout type="button">Выйти</button>
      </div>
    </header>
  `;
}

function dashboardTitle() {
  const summary = getDashboardSummary();
  if (summary.status === "learning") return "Нужно больше данных";
  if (summary.status === "over") return "Месяц требует коррекции";
  if (summary.status === "watch") return "Бюджет близко к границе";
  return "Вы укладываетесь в бюджет";
}

function renderActiveView() {
  if (activeView === "quick") return renderQuick();
  if (activeView === "history") return renderHistory();
  if (activeView === "insights") return renderInsights();
  if (activeView === "admin" && isAdmin()) return renderAdminUsers();
  return renderDashboard();
}

function renderDashboard() {
  const months = monthArchive();
  if (!months.some((month) => month.key === dashboardMonthKey)) {
    dashboardMonthKey = months[0]?.key || monthKey(new Date());
  }
  const summary = getDashboardSummary();
  const statusMeta = statusCopy(summary.status, !summary.isCurrentMonth);
  const ratio = Math.min(summary.budgetRatio, 1.18);
  const spentZone = budgetRiskZone(summary.budgetRatio);
  const daysLeftValue = summary.isCurrentMonth ? String(summary.daysLeft) : "Архив";
  const forecastValue = summary.isCurrentMonth && !summary.forecastReady ? "—" : money(summary.projected);
  const forecastHint = summary.isCurrentMonth && !summary.forecastReady
    ? `после ${summary.minimumForecastExpenses || 3} трат`
    : "";
  const upcoming = dashboardFutureExpenses(summary);
  return `
    <section class="view">
      <div class="dashboard-grid">
        <div>
          ${renderForecastBanner(summary)}
          <section class="hero-panel">
            <div class="decision-copy">
              <div>
                <div class="status-pill ${summary.status}"><span class="dot"></span>${statusMeta.label}</div>
                <div class="hero-metric ${summary.remaining < 0 ? "negative" : ""}">${money(summary.remaining)}</div>
                <p class="hero-caption">${statusMeta.body}</p>
              </div>
              <div class="runway">
                <div class="runway-track">
                  <div class="runway-fill ${spentZone}" style="--fill:${ratio * 100}%"></div>
                </div>
                <div class="runway-labels"><span>${runwaySpentLabel(summary)}</span><span>${money(summary.budget)} бюджет</span></div>
              </div>
            </div>
            ${renderBudgetMeter(summary)}
          </section>
          <div class="metric-grid">
            ${metric("Прогноз", forecastValue, forecastHint)}
            ${metric("Доход", money(summary.income))}
            ${metric("Дневной лимит", money(summary.dailySafeSpend))}
            ${metric(summary.isCurrentMonth ? "Дней осталось" : "Период", daysLeftValue)}
          </div>
        </div>
        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>Драйверы расходов</h2>
              <p>${escapeHtml(summary.monthLabel)}${summary.isCurrentMonth ? "" : " · сохранённый месяц"}</p>
            </div>
          </div>
          ${renderMonthArchive(months)}
          ${summary.categoryTotals.length ? renderCategoryList(summary.categoryTotals) : `<div class="empty small">В этом месяце расходов не было</div>`}
          ${renderDashboardFuture(upcoming)}
        </section>
      </div>
    </section>
  `;
}

function budgetRiskZone(ratio) {
  if (ratio > 0.8) return "over";
  if (ratio > 0.6) return "watch";
  return "on-track";
}

function runwaySpentLabel(summary) {
  if (Number(summary.scheduledMonthSpent) > 0) {
    return `${money(summary.spent)} учтено, включая ${money(summary.scheduledMonthSpent)} будущих`;
  }
  return `${money(summary.spent)} потрачено`;
}

function dashboardFutureExpenses(summary) {
  if (!summary.isCurrentMonth) return [];
  const { start, end } = monthBounds(dashboardMonthKey);
  return futureTransactions()
    .filter((transaction) => (
      transaction.type === "expense"
      && new Date(transaction.occurredAt) >= start
      && new Date(transaction.occurredAt) < end
    ));
}

function renderDashboardFuture(transactions) {
  if (!transactions.length) return "";
  const total = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  return `
    <section class="upcoming-card">
      <div class="upcoming-head">
        <div>
          <span>Ближайшие списания</span>
          <strong>${money(total)}</strong>
        </div>
        <button class="ghost-button compact" data-open-future type="button">Открыть</button>
      </div>
      <div class="upcoming-list">
        ${transactions.slice(0, 3).map(renderUpcomingExpense).join("")}
      </div>
      ${transactions.length > 3 ? `<p>Ещё ${transactions.length - 3} операций в истории</p>` : ""}
    </section>
  `;
}

function renderUpcomingExpense(transaction) {
  const category = categoryById(transaction.category);
  return `
    <article class="upcoming-row" style="--cat:${category.color}">
      <div class="cat-icon" style="--cat:${category.color}">${icon(category.icon)}</div>
      <div>
        <strong>${escapeHtml(transaction.title)}</strong>
        <span>${dateFormatter.format(new Date(transaction.occurredAt))} · ${escapeHtml(category.label)}</span>
      </div>
      <b>${money(transaction.amount)}</b>
    </article>
  `;
}

function renderForecastBanner(summary) {
  if (!summary.isCurrentMonth || summary.status !== "over") return "";
  const overspend = Math.max(0, summary.projected - summary.budget);
  const overPercent = Math.max(1, Math.round((summary.projectedRatio - 1) * 100));
  return `
    <aside class="forecast-banner">
      <div>
        <span>Нужно действие</span>
        <strong>Прогноз выше бюджета на ${money(overspend)}</strong>
        <p>Текущий темп ведёт к перерасходу на ${overPercent}%. Найдите одну категорию, где проще всего срезать расходы уже сейчас.</p>
      </div>
      <button class="primary-button" data-view-link="insights" type="button">Посмотреть, где срезать</button>
    </aside>
  `;
}

function renderBudgetMeter(summary) {
  if (summary.isCurrentMonth && !summary.forecastReady) {
    const current = summary.forecastExpenseCount || 0;
    const required = summary.minimumForecastExpenses || 3;
    const marker = Math.min(100, Math.max(0, summary.budgetRatio * 100));
    return `
      <div class="budget-meter learning" style="--marker:${marker}%">
        <span>Данных для прогноза</span>
        <strong>${current}/${required}</strong>
        <p>трат добавлено</p>
        <div class="zone-track" aria-hidden="true"><i></i></div>
        <div class="zone-labels"><span>0</span><span>60</span><span>80</span><span>100%</span></div>
        <small>Прогноз темпа появится после ${required} трат. Пока показываю только фактически потраченные ${Math.round(summary.budgetRatio * 100)}% бюджета.</small>
      </div>
    `;
  }
  const forecastPercent = Math.round(summary.projectedRatio * 100);
  const spentPercent = Math.round(summary.budgetRatio * 100);
  const marker = Math.min(100, Math.max(0, summary.projectedRatio * 100));
  const paceZone = budgetRiskZone(summary.projectedRatio);
  return `
    <div class="budget-meter ${paceZone}" style="--marker:${marker}%">
      <span>Темп месяца</span>
      <strong>${forecastPercent}%</strong>
      <p>прогноз к бюджету</p>
      <div class="zone-track" aria-hidden="true"><i></i></div>
      <div class="zone-labels"><span>0</span><span>60</span><span>80</span><span>100%</span></div>
      <small>Сейчас потрачено ${spentPercent}% бюджета</small>
    </div>
  `;
}

function renderMonthArchive(months) {
  return `
    <div class="month-archive" aria-label="Архив месяцев">
      ${months.map((month) => `
        <button class="${month.key === dashboardMonthKey ? "active" : ""}" data-dashboard-month="${month.key}" type="button">
          <strong>${escapeHtml(month.shortLabel)}</strong>
          <span>${money(month.spent)}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function getDashboardSummary() {
  const today = new Date();
  const todayParts = appDateParts(today);
  const currentKey = monthKey(today);
  const availableKeys = new Set();
  for (let offset = 0; offset < 6; offset += 1) {
    availableKeys.add(monthKey(zonedDateTimeToUtc(todayParts.year, todayParts.month - 1 - offset, 1, 12, 0, 0)));
  }
  for (const transaction of state.transactions) {
    availableKeys.add(monthKey(new Date(transaction.occurredAt)));
  }
  if (!availableKeys.has(dashboardMonthKey)) dashboardMonthKey = currentKey;
  if (dashboardMonthKey !== currentKey) return summarizeMonth(dashboardMonthKey);
  const summary = { ...state.summary, isCurrentMonth: true };
  return applyClientForecastSample(summary, currentKey);
}

function applyClientForecastSample(summary, key) {
  const { start, end } = monthBounds(key);
  const expenses = state.transactions.filter((transaction) => (
    transaction.type === "expense"
    && new Date(transaction.occurredAt) >= start
    && new Date(transaction.occurredAt) < end
  ));
  const required = summary.minimumForecastExpenses || 3;
  const count = expenses.length;
  const ready = count >= required || summary.spent > summary.budget;
  const projectedStatus = summary.projectedRatio > 1.05 ? "over" : summary.projectedRatio > 0.92 ? "watch" : "on-track";
  return {
    ...summary,
    forecastExpenseCount: count,
    minimumForecastExpenses: required,
    forecastReady: ready,
    status: ready ? (summary.status === "learning" ? projectedStatus : summary.status) : "learning"
  };
}

function monthArchive() {
  const today = new Date();
  const todayParts = appDateParts(today);
  const keys = new Set();
  for (let offset = 0; offset < 6; offset += 1) {
    keys.add(monthKey(zonedDateTimeToUtc(todayParts.year, todayParts.month - 1 - offset, 1, 12, 0, 0)));
  }
  for (const transaction of state.transactions) {
    keys.add(monthKey(new Date(transaction.occurredAt)));
  }
  return [...keys]
    .sort((a, b) => b.localeCompare(a))
    .map((key) => {
      const summary = key === monthKey(new Date()) ? state.summary : summarizeMonth(key);
      return {
        key,
        shortLabel: shortMonthLabel(key),
        spent: summary.spent
      };
    });
}

function summarizeMonth(key) {
  const { start, end } = monthBounds(key);
  const expenses = state.transactions.filter((transaction) => (
    transaction.type === "expense"
    && new Date(transaction.occurredAt) >= start
    && new Date(transaction.occurredAt) < end
  ));
  const incomeItems = state.transactions.filter((transaction) => (
    transaction.type === "income"
    && new Date(transaction.occurredAt) >= start
    && new Date(transaction.occurredAt) < end
  ));
  const spent = roundClientMoney(expenses.reduce((sum, transaction) => sum + transaction.amount, 0));
  const income = roundClientMoney(incomeItems.reduce((sum, transaction) => sum + transaction.amount, 0));
  const baseBudget = Number(state.settings?.monthlyBudget || state.summary.baseBudget || 0);
  const budget = roundClientMoney(baseBudget + income);
  const remaining = roundClientMoney(budget - spent);
  const daysInMonth = Math.round((end - start) / 86400000);
  const budgetRatio = budget > 0 ? spent / budget : 0;
  const status = budgetRatio > 1.05 ? "over" : budgetRatio > 0.92 ? "watch" : "on-track";
  const categoryTotals = state.categories.map((category) => {
    const total = expenses
      .filter((transaction) => transaction.category === category.id)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const budget = categoryBudgetFor(category.id);
    const budgetRatio = budget > 0 ? total / budget : 0;
    return {
      ...category,
      total: roundClientMoney(total),
      share: spent ? total / spent : 0,
      budget,
      budgetRemaining: budget > 0 ? roundClientMoney(budget - total) : 0,
      budgetRatio,
      budgetStatus: budgetRatio > 1 ? "over" : budgetRatio >= 0.8 ? "watch" : "on-track"
    };
  })
    .filter((category) => category.total > 0 || category.budget > 0)
    .sort((a, b) => (b.total - a.total) || (b.budget - a.budget));

  return {
    ...state.summary,
    monthLabel: fullMonthLabel(key),
    baseBudget,
    budget,
    spent,
    realizedSpent: spent,
    scheduledMonthSpent: 0,
    income,
    remaining,
    projected: spent,
    dailySafeSpend: 0,
    daysElapsed: daysInMonth,
    daysInMonth,
    daysLeft: 0,
    budgetRatio,
    projectedRatio: budgetRatio,
    forecastReady: true,
    forecastExpenseCount: expenses.length,
    minimumForecastExpenses: 3,
    status,
    categoryTotals,
    isCurrentMonth: key === monthKey(new Date())
  };
}

function renderQuick() {
  return `
    <section class="view">
      <div class="quick-shell">
        <section class="panel quick-panel">
          <div class="panel-header">
            <div>
              <h2>Операция за 5 секунд</h2>
            </div>
          </div>
          <form class="quick-form" id="quick-form">
            <input class="quick-input" id="quick-input" autocomplete="off" maxlength="240" placeholder="потратил 1200 на обед" />
            <input class="date-input" id="quick-date" type="date" aria-label="Дата операции" title="Дата операции" />
            <button class="primary-button" id="quick-submit" type="submit">${icon("send")} Добавить</button>
          </form>
          <div class="suggestion-label">Примеры</div>
          <div class="suggestions">
            ${["пятёрочка 1800", "доставка 490", "12 мая интернет 1200", "такси 760 вчера", "зарплата 185000"].map((text) => `<button class="chip" data-example="${escapeAttr(text)}">${escapeHtml(text)}</button>`).join("")}
          </div>
          ${lastResult ? renderResult(lastResult) : ""}
        </section>
        <section class="panel">
          <div class="panel-header">
            <div>
              <h2>После добавления</h2>
              <p>Картина месяца пересчитывается сразу</p>
            </div>
          </div>
          <div class="metric-grid" style="grid-template-columns:1fr 1fr">
            ${metric("Осталось", money(state.summary.remaining))}
            ${metric(
              "Прогноз",
              state.summary.forecastReady ? money(state.summary.projected) : "—",
              state.summary.forecastReady ? "" : `Появится после ${state.summary.minimumForecastExpenses || 3} трат`
            )}
          </div>
          <div style="height:16px"></div>
          ${renderCategoryList(state.summary.categoryTotals.slice(0, 5))}
          ${renderCategoryManager()}
          ${renderCategoryLimitEditor()}
        </section>
      </div>
    </section>
  `;
}

function renderResult(result) {
  const transaction = result.transaction;
  const category = categoryById(transaction.category);
  return `
    <div class="result-card">
      <div class="result-top">
        <div class="result-title">
          <strong>${escapeHtml(transaction.title)}</strong>
          <span>${escapeHtml(category.label)} · точность ${Math.round(transaction.confidence * 100)}%</span>
        </div>
        <div class="result-amount ${transaction.type}">${transaction.type === "income" ? "+" : "-"}${money(transaction.amount)}</div>
      </div>
      <div class="parse-grid">
        <div class="parse-item"><span>Разбор</span><strong>${parseSourceLabel(result)}</strong></div>
        <div class="parse-item"><span>Дата</span><strong>${dateFormatter.format(new Date(transaction.occurredAt))}</strong></div>
        <div class="parse-item"><span>Тип</span><strong>${transaction.type === "income" ? "Доход" : "Расход"}</strong></div>
      </div>
    </div>
  `;
}

function parseSourceLabel(result) {
  return result?.ai?.used ? "ИИ-разбор" : "Авторазбор";
}

function renderHistory() {
  if (historyCategory !== "all" && !state.categories.some((category) => category.id === historyCategory)) {
    historyCategory = "all";
  }
  const transactions = filteredTransactions();
  const scheduled = futureTransactions();
  const filteredScheduled = scheduled.filter(matchesHistoryQueryAndCategory);
  const week = historyWeekSummary();
  const visibleScheduled = scheduledOutsideSelectedWeek(filteredScheduled);
  const weekTop = week.topCategory;
  return `
    <section class="view">
      <div class="history-grid">
        <section class="panel week-hero">
          <div class="panel-header">
            <div>
              <h2>История за 7 дней</h2>
              <p>${escapeHtml(week.label)} · ${week.transactionCount} операций</p>
            </div>
            <div class="week-switch" aria-label="Переключить период">
              <button data-history-week="-1" type="button" title="Предыдущие 7 дней">←</button>
              <strong>${escapeHtml(week.label)}</strong>
              <button data-history-week="1" type="button" title="Следующие 7 дней">→</button>
            </div>
          </div>
          <div class="week-amount">${money(week.spent)}</div>
          ${renderWeekPulse(week)}
          <div class="week-row">
            <span>${weekTop ? "Больше всего ушло в" : "Главная категория"}</span>
            <strong>${weekTop ? escapeHtml(weekTop.label) : "нет данных"}</strong>
          </div>
          ${weekTop ? renderCategoryList([weekTop]) : ""}
          ${renderFutureSummary(scheduled)}
        </section>
        <section class="panel">
          <div class="history-controls">
            <div class="history-toolbar">
              <input class="search-input" id="history-search" placeholder="Поиск по операциям" value="${escapeAttr(historySearch)}" />
              <select class="history-category-select" id="history-category" aria-label="Категория операций">
                ${renderHistoryCategoryOptions()}
              </select>
              <div class="segmented">
                <button data-history-filter="week" class="${historyFilter === "week" ? "active" : ""}">Неделя</button>
                <button data-history-filter="month" class="${historyFilter === "month" ? "active" : ""}">Месяц</button>
                <button data-history-filter="future" class="${historyFilter === "future" ? "active" : ""}">Будущие</button>
                <button data-history-filter="all" class="${historyFilter === "all" ? "active" : ""}">Все</button>
              </div>
            </div>
            <button class="clear-history-button" data-clear-history type="button" ${state.transactions.length ? "" : "disabled"}>${icon("trash")} Очистить историю</button>
          </div>
          ${visibleScheduled.length && historyFilter === "week" ? renderScheduledBlock(visibleScheduled) : ""}
          ${transactions.length ? `<div class="tx-list">${transactions.map(renderTransaction).join("")}</div>` : renderHistoryEmptyState()}
        </section>
      </div>
    </section>
  `;
}

function renderHistoryCategoryOptions() {
  return [
    `<option value="all"${historyCategory === "all" ? " selected" : ""}>Все категории</option>`,
    ...state.categories.map((category) => (
      `<option value="${escapeAttr(category.id)}"${historyCategory === category.id ? " selected" : ""}>${escapeHtml(category.label)}</option>`
    ))
  ].join("");
}

function renderHistoryEmptyState() {
  if (state.transactions.length) {
    return `<div class="empty">Операции не найдены</div>`;
  }
  return `
    <div class="empty action-empty">
      <div>
        <strong>Попробуйте добавить первую операцию</strong>
        <p>История, категории и динамика появятся здесь сразу после добавления.</p>
      </div>
      <button class="ghost-button" data-view-link="quick" type="button">Добавить операцию →</button>
    </div>
  `;
}

function renderInsights() {
  const fallback = {
    tone: "neutral",
    title: "Добавьте несколько операций",
    body: "Finley покажет конкретные рычаги, когда увидит ваши реальные расходы.",
    action: "Добавить операции",
    metric: "0/5",
    detail: "Начните с еды, транспорта, дома и регулярных платежей."
  };
  const [primary = fallback, ...rest] = state.insights.length ? state.insights : [fallback];
  const summary = state.summary;
  const topCategories = summary.categoryTotals.slice(0, 4);
  const spendRate = summary.budget > 0 ? Math.round(summary.projectedRatio * 100) : 0;
  const primaryMetric = state.transactions.length ? primary.metric : "";
  return `
    <section class="view">
      <div class="advice-grid">
        <article class="insight-card primary ${primary.tone}">
          <div class="insight-meta">
            <span>Главный рычаг</span>
            ${primaryMetric ? `<strong class="insight-pace"><span>темп</span>${escapeHtml(primaryMetric)}</strong>` : ""}
          </div>
          <div>
            <h2>${escapeHtml(primary.title)}</h2>
            <p>${escapeHtml(primary.body)}</p>
            ${primary.detail ? `<small>${escapeHtml(primary.detail)}</small>` : ""}
          </div>
        </article>
        <section class="panel advice-plan">
          <div class="panel-header">
            <div>
              <h2>План на сегодня</h2>
              <p>Что держать в голове до следующей покупки</p>
            </div>
          </div>
          <div class="advice-kpis">
            ${metric("Дневной лимит", money(summary.dailySafeSpend))}
            ${metric("До конца месяца", `${summary.daysLeft} дн.`)}
            ${metric("Темп бюджета", `${spendRate}%`)}
          </div>
          <div class="advice-rule">
            <strong>${summary.remaining >= 0 ? "Правило дня" : "Стоп-сигнал"}</strong>
            <span>${summary.remaining >= 0
              ? `Держите необязательные покупки в пределах ${money(summary.dailySafeSpend)} за день. Если одна покупка выше этого, она уже съедает завтрашний лимит.`
              : `Бюджет уже в минусе на ${money(Math.abs(summary.remaining))}. Новые необязательные расходы лучше переносить.`}</span>
          </div>
        </section>
      </div>

      <div class="advice-board">
        <section class="panel advice-section">
          <div class="panel-header">
            <div>
              <h2>Что сделать дальше</h2>
              <p>Конкретные действия вместо общих наблюдений</p>
            </div>
          </div>
          <div class="advice-list">
            ${rest.length ? rest.map(renderAdviceItem).join("") : renderAdviceItem(fallback)}
          </div>
        </section>

        <section class="panel advice-section">
          <div class="panel-header">
            <div>
              <h2>Категории риска</h2>
              <p>Где маленькое изменение даст заметный эффект</p>
            </div>
          </div>
          ${topCategories.length ? `<div class="risk-list">${topCategories.map(renderRiskCategory).join("")}</div>` : `<div class="empty small">Пока нет расходов за месяц</div>`}
        </section>
      </div>
    </section>
  `;
}

function renderAdminUsers() {
  const admin = state.admin || { userCount: 0, adminCount: 0, activeSessionCount: 0, users: [] };
  const users = Array.isArray(admin.users) ? admin.users : [];
  return `
    <section class="view">
      <div class="admin-grid">
        <section class="panel admin-summary">
          <div class="panel-header">
            <div>
              <h2>Сводка</h2>
              <p>Всего зарегистрированных профилей: ${admin.userCount}</p>
            </div>
          </div>
          <div class="metric-grid admin-metrics">
            ${metric("Пользователей", String(admin.userCount || users.length))}
            ${metric("Админов", String(admin.adminCount || users.filter((user) => user.isAdmin).length))}
            ${metric("Активных сессий", String(admin.activeSessionCount || 0))}
          </div>
        </section>

        <section class="panel admin-users-panel">
          <div class="panel-header">
            <div>
              <h2>Пользователи</h2>
              <p>Почта, роль и состояние пароля</p>
            </div>
          </div>
          ${users.length ? `<div class="admin-user-list">${users.map(renderAdminUser).join("")}</div>` : `<div class="empty small">Пользователей пока нет</div>`}
        </section>
      </div>
    </section>
  `;
}

function renderAdminUser(user) {
  const initial = (user.name || user.email || "?").trim().slice(0, 1).toLocaleUpperCase("ru-RU");
  const createdAt = user.createdAt ? compactDateLabel(new Date(user.createdAt)) : "нет даты";
  return `
    <article class="admin-user-row ${user.isAdmin ? "admin" : ""}">
      <div class="admin-user-main">
        <div class="admin-avatar">${escapeHtml(initial)}</div>
        <div>
          <strong>${escapeHtml(user.name || "Без имени")}</strong>
          <span>${escapeHtml(user.email || "почта не указана")}</span>
        </div>
      </div>
      <div class="admin-user-meta">
        <span><b>${user.isAdmin ? "Админ" : "Пользователь"}</b> роль</span>
        <span><b>${escapeHtml(user.passwordLabel || "Скрыт")}</b> пароль</span>
        <span><b>${user.transactionsCount || 0}</b> операций</span>
        <span><b>${user.activeSessions || 0}</b> сессий</span>
        <span><b>${escapeHtml(createdAt)}</b> создан</span>
      </div>
    </article>
  `;
}

function renderAdviceItem(insight) {
  return `
    <article class="advice-item ${escapeAttr(insight.tone || "neutral")}">
      <div class="advice-item-top">
        <span>${toneLabel(insight.tone)}</span>
        <strong>${escapeHtml(insight.metric)}</strong>
      </div>
      <h3>${escapeHtml(insight.title)}</h3>
      <p>${escapeHtml(insight.body)}</p>
      ${insight.detail ? `<small>${escapeHtml(insight.detail)}</small>` : ""}
      <button class="ghost-button compact" data-view-link="${insight.tone === "neutral" ? "quick" : "history"}">${escapeHtml(insight.action || "Открыть")}</button>
    </article>
  `;
}

function renderRiskCategory(category) {
  const hasLimit = Number(category.budget) > 0;
  const share = hasLimit ? Math.round(category.budgetRatio * 100) : Math.round(category.share * 100);
  const fill = hasLimit ? Math.min(100, category.budgetRatio * 100) : Math.min(100, share);
  const saveTen = money(category.total * 0.1);
  const limitText = hasLimit
    ? `${share}% лимита · ${category.budgetRemaining >= 0 ? `осталось ${money(category.budgetRemaining)}` : `сверх ${money(Math.abs(category.budgetRemaining))}`}`
    : `${share}% расходов · минус 10% даст ${saveTen}`;
  return `
    <article class="risk-row">
      <div class="cat-icon" style="--cat:${category.color}">${icon(category.icon)}</div>
      <div class="risk-main">
        <div class="risk-title">
          <strong>${escapeHtml(category.label)}</strong>
          <span>${money(category.total)}</span>
        </div>
        <div class="mini-track"><div class="mini-fill" style="--fill:${fill}%;--cat:${category.color}"></div></div>
        <p>${escapeHtml(limitText)}</p>
      </div>
    </article>
  `;
}

function renderTransaction(transaction) {
  const category = categoryById(transaction.category);
  const amountPrefix = transaction.type === "income" ? "+" : "-";
  const isFuture = new Date(transaction.occurredAt) > new Date();
  return `
    <article class="tx-row ${isFuture ? "planned" : ""}" data-id="${transaction.id}">
      <div class="cat-icon" style="--cat:${category.color}">${icon(category.icon)}</div>
      <div class="tx-main">
        <strong>${escapeHtml(transaction.title)}</strong>
        <span>${dateFormatter.format(new Date(transaction.occurredAt))} · ${escapeHtml(transaction.rawText)}${isFuture ? " · Запланировано" : ""}</span>
      </div>
      <div class="tx-amount ${transaction.type}">${amountPrefix}${money(transaction.amount)}</div>
      <select class="tx-select" data-category-select="${transaction.id}" title="Категория">
        ${state.categories.filter((item) => transaction.type === "income" ? item.id === "income" : item.id !== "income").map((item) => `<option value="${item.id}" ${item.id === transaction.category ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
      </select>
      <button class="danger-button" data-delete="${transaction.id}" title="Удалить">${icon("trash")}</button>
    </article>
  `;
}

function renderScheduledBlock(transactions) {
  const total = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  return `
    <section class="scheduled-block">
      <div class="scheduled-header">
        <div>
          <strong>Будущие списания</strong>
          <span>${transactions.length} операций · ${money(total)}</span>
        </div>
        <button class="ghost-button" data-history-filter="future" type="button">Показать</button>
      </div>
      <div class="tx-list">${transactions.slice(0, 3).map(renderTransaction).join("")}</div>
    </section>
  `;
}

function renderWeekPulse(stats) {
  const max = Math.max(...stats.days.map((day) => day.total), 1);
  const top = stats.days.reduce((best, day) => (day.total > best.total ? day : best), stats.days[0]);
  const delta = stats.weekSpent - stats.previousSpent;
  const deltaTone = stats.previousSpent === 0 ? "flat" : delta > 0 ? "bad" : delta < 0 ? "good" : "flat";
  const deltaText = stats.previousSpent > 0
    ? `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${money(Math.abs(delta))}`
    : "";

  if (stats.weekSpent <= 0) {
    return `
    <section class="week-pulse empty-week" aria-label="Динамика расходов за неделю">
      <div class="week-empty-state">
        <span></span>
        <strong>Нет операций</strong>
        <p>Добавьте первую трату, чтобы увидеть динамику за этот период.</p>
      </div>
    </section>
  `;
  }

  return `
    <section class="week-pulse" aria-label="Динамика расходов за неделю">
      <div class="week-bars">
        ${stats.days.map((day) => `
          <div class="week-bar" title="${escapeAttr(day.label)} · ${escapeAttr(money(day.total))}" style="--bar:${Math.max(6, (day.total / max) * 100)}%">
            <i></i>
            <span><b>${escapeHtml(day.weekday)}</b><small>${escapeHtml(day.dateLabel)}</small></span>
          </div>
        `).join("")}
      </div>
      <div class="week-facts">
        <div><span>Средние расходы за день</span><strong>${money(stats.average)}</strong></div>
        <div><span>Пик недели</span><strong>${escapeHtml(top.weekday)} · ${escapeHtml(top.dateLabel)} · ${money(top.total)}</strong></div>
        ${deltaText ? `<div><span>К прошлой неделе</span><strong class="${deltaTone}">${escapeHtml(deltaText)}</strong></div>` : ""}
      </div>
    </section>
  `;
}

function historyWeekSummary() {
  const { start, end } = historyWeekRange();
  const rangeTransactions = state.transactions.filter((transaction) => {
    const occurredAt = new Date(transaction.occurredAt);
    return occurredAt >= start && occurredAt < end;
  });
  const expenses = rangeTransactions.filter((transaction) => transaction.type === "expense");
  const spent = roundClientMoney(expenses.reduce((sum, transaction) => sum + transaction.amount, 0));
  const topCategory = state.categories.map((category) => {
    const total = expenses
      .filter((transaction) => transaction.category === category.id)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    return {
      ...category,
      total: roundClientMoney(total),
      share: spent ? total / spent : 0
    };
  })
    .filter((category) => category.total > 0)
    .sort((a, b) => b.total - a.total)[0] || null;
  const pulse = weekPulseStats(start, end);

  return {
    ...pulse,
    label: historyWeekLabel(start, end),
    spent,
    transactionCount: rangeTransactions.length,
    topCategory
  };
}

function weekPulseStats(start, end) {
  const previousStart = addDays(start, -7);
  const previousEnd = new Date(start);
  const expenseTransactions = state.transactions.filter((transaction) => transaction.type === "expense");
  const days = Array.from({ length: 7 }, (_, index) => {
    const dayStart = addDays(start, index);
    const dayEnd = addDays(dayStart, 1);
    const total = expenseTransactions
      .filter((transaction) => {
        const occurredAt = new Date(transaction.occurredAt);
        return occurredAt >= dayStart && occurredAt < dayEnd;
      })
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    return {
      weekday: weekdayFormatter.format(dayStart).replace(".", ""),
      dateLabel: compactDateLabel(dayStart),
      label: dateFormatter.format(dayStart),
      total: roundClientMoney(total)
    };
  });
  const weekSpent = roundClientMoney(days.reduce((sum, day) => sum + day.total, 0));
  const previousSpent = roundClientMoney(expenseTransactions
    .filter((transaction) => {
      const occurredAt = new Date(transaction.occurredAt);
      return occurredAt >= previousStart && occurredAt < previousEnd;
    })
    .reduce((sum, transaction) => sum + transaction.amount, 0));

  return {
    days,
    weekSpent,
    previousSpent,
    average: roundClientMoney(weekSpent / 7)
  };
}

function renderFutureSummary(transactions) {
  const total = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const next = transactions[0];
  return `
    <section class="future-summary">
      <div>
        <span>Будущие списания</span>
        <strong>${money(total)}</strong>
      </div>
      <p>${next ? `${dateFormatter.format(new Date(next.occurredAt))} · ${escapeHtml(next.title)} · ${money(next.amount)}` : "Запланированных расходов пока нет"}</p>
    </section>
  `;
}

function renderCategoryList(categories) {
  if (!categories.length) return `<div class="empty">Расходов пока нет</div>`;
  const max = Math.max(...categories.map((category) => category.total), 1);
  return `
    <div class="category-list">
      ${categories.map((category) => {
        const hasLimit = Number(category.budget) > 0;
        const fill = hasLimit
          ? Math.min(100, (Number(category.total) / Number(category.budget || 1)) * 100)
          : Math.max(5, (category.total / max) * 100);
        const caption = hasLimit
          ? `${Math.round((Number(category.budgetRatio) || 0) * 100)}% лимита · ${money(category.budget)}`
          : `${Math.round(categoryShare(category, max) * 100)}% расходов`;
        return `
        <div class="category-row ${hasLimit ? `limit-${category.budgetStatus}` : ""}" style="--cat:${category.color}">
          <div class="cat-icon" style="--cat:${category.color}">${icon(category.icon)}</div>
          <div>
            <strong>${escapeHtml(category.label)}</strong>
            <span>${escapeHtml(caption)}</span>
            <div class="mini-track"><div class="mini-fill" style="--fill:${hasLimit ? Math.max(0, fill) : Math.max(5, fill)}%"></div></div>
          </div>
          <div class="category-amount">${money(category.total)}</div>
        </div>
      `;
      }).join("")}
    </div>
  `;
}

function categoryShare(category, max) {
  const share = Number(category.share);
  if (Number.isFinite(share) && share >= 0 && share <= 1) return share;
  const total = Number(category.total) || 0;
  return max > 0 ? total / max : 0;
}

function renderBudgetEditor() {
  const baseBudget = Number(state.settings?.monthlyBudget ?? state.summary.baseBudget ?? 0);
  return `
    <form class="budget-editor" id="budget-form">
      <label for="budget-input">Бюджет месяца</label>
      <div class="budget-editor-row">
        <input id="budget-input" value="${Math.round(baseBudget)}" inputmode="numeric" />
        <button class="icon-button" title="Сохранить бюджет">${icon("save")}</button>
      </div>
    </form>
  `;
}

function renderCategoryManager() {
  const customCategories = state.categories.filter((category) => category.custom);
  return `
    <form class="category-editor" data-category-form>
      <label>Своя категория</label>
      <div class="category-editor-row">
        <input name="label" maxlength="32" placeholder="Например: питомцы" autocomplete="off" />
        <button class="icon-button" title="Добавить категорию" type="submit">${icon("quick")}</button>
      </div>
      ${customCategories.length ? `<div class="custom-category-list">${customCategories.map((category) => `
        <span style="--cat:${category.color}">
          ${escapeHtml(category.label)}
          <button class="category-remove" data-category-delete="${category.id}" title="Удалить категорию ${escapeAttr(category.label)}" type="button">×</button>
        </span>
      `).join("")}</div>` : ""}
    </form>
  `;
}

function renderCategoryLimitEditor() {
  const categories = state.categories.filter((category) => category.id !== "income");
  return `
    <form class="limit-editor" id="category-limit-form">
      <div class="limit-editor-head">
        <label>Лимиты категорий</label>
        <span>Месячный ориентир для еды, доставки, дома и других трат</span>
      </div>
      <div class="limit-list">
        ${categories.map((category) => {
          const value = categoryBudgetFor(category.id);
          return `
            <label class="limit-row" style="--cat:${category.color}">
              <span><i>${icon(category.icon)}</i>${escapeHtml(category.label)}</span>
              <input data-category-limit="${escapeAttr(category.id)}" inputmode="numeric" value="${value ? Math.round(value) : ""}" placeholder="0" />
            </label>
          `;
        }).join("")}
      </div>
      <button class="ghost-button compact" type="submit">Сохранить лимиты</button>
    </form>
  `;
}

function renderUserProfile() {
  const user = state.user || {};
  return `
    <section class="profile-card">
      <span>Профиль</span>
      <strong>${escapeHtml(user.name || "Пользователь")}${isAdmin() ? `<em>Админ</em>` : ""}</strong>
      <small>${escapeHtml(user.email || "")}</small>
      <button class="ghost-button" data-logout type="button">Выйти</button>
    </section>
  `;
}

function renderAiPill() {
  const hasLLM = lastResult?.ai?.used;
  return `<div class="ai-pill ${hasLLM ? "" : "local"}"><span class="dot"></span>${hasLLM ? "Модель активна" : "Модель при добавлении"}</div>`;
}

function renderNav(className, short = false) {
  const availableViews = views.filter((view) => !view.adminOnly || isAdmin());
  return `
    <nav class="${className}" aria-label="Разделы Finley">
      ${availableViews.map((view) => `
        <button class="nav-button" data-view-link="${view.id}" aria-current="${activeView === view.id ? "page" : "false"}" title="${view.label}">
          ${icon(view.id)}
          <span>${short ? view.short : view.label}</span>
        </button>
      `).join("")}
    </nav>
  `;
}

function isAdmin() {
  return Boolean(state?.user?.isAdmin);
}

function bindAuthEvents() {
  document.querySelector("[data-auth-mode]")?.addEventListener("click", (event) => {
    authMode = event.currentTarget.dataset.authMode;
    renderAuth();
  });
  document.querySelector("#auth-form")?.addEventListener("submit", submitAuth);
}

function bindEvents() {
  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", logout);
  });

  document.querySelectorAll("[data-view-link]").forEach((button) => {
    button.addEventListener("click", () => {
      location.hash = button.dataset.viewLink;
    });
  });

  document.querySelectorAll("[data-example]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.querySelector("#quick-input");
      if (!input) return;
      input.value = button.dataset.example;
      input.focus();
    });
  });

  const quickForm = document.querySelector("#quick-form");
  if (quickForm) quickForm.addEventListener("submit", submitQuick);

  const budgetForm = document.querySelector("#budget-form");
  if (budgetForm) budgetForm.addEventListener("submit", submitBudget);

  const limitForm = document.querySelector("#category-limit-form");
  if (limitForm) limitForm.addEventListener("submit", submitCategoryLimits);

  document.querySelectorAll("[data-category-form]").forEach((form) => {
    form.addEventListener("submit", submitCategory);
  });

  document.querySelectorAll("[data-category-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteCategory(button.dataset.categoryDelete));
  });

  document.querySelectorAll("[data-history-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      historyFilter = button.dataset.historyFilter;
      render();
    });
  });

  document.querySelectorAll("[data-history-week]").forEach((button) => {
    button.addEventListener("click", () => {
      historyWeekIndex += Number(button.dataset.historyWeek || 0);
      historyFilter = "week";
      render();
    });
  });

  document.querySelectorAll("[data-dashboard-month]").forEach((button) => {
    button.addEventListener("click", () => {
      dashboardMonthKey = button.dataset.dashboardMonth;
      render();
    });
  });

  document.querySelector("[data-clear-history]")?.addEventListener("click", clearHistory);

  document.querySelectorAll("[data-open-future]").forEach((button) => {
    button.addEventListener("click", () => {
      historyFilter = "future";
      location.hash = "history";
    });
  });

  const search = document.querySelector("#history-search");
  if (search) {
    search.addEventListener("input", (event) => {
      historySearch = event.target.value;
      render();
      const nextSearch = document.querySelector("#history-search");
      if (nextSearch) {
        nextSearch.focus();
        nextSearch.setSelectionRange(nextSearch.value.length, nextSearch.value.length);
      }
    });
  }

  document.querySelector("#history-category")?.addEventListener("change", (event) => {
    historyCategory = event.target.value;
    render();
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteTransaction(button.dataset.delete));
  });

  document.querySelectorAll("[data-category-select]").forEach((select) => {
    select.addEventListener("change", () => updateTransaction(select.dataset.categorySelect, { category: select.value }));
  });
}

async function submitAuth(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const payload = Object.fromEntries(new FormData(form).entries());
  button.disabled = true;
  button.textContent = authMode === "signup" ? "Создаем" : "Входим";
  try {
    await api(authMode === "signup" ? "/api/auth/signup" : "/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    lastResult = null;
    historySearch = "";
    historyCategory = "all";
    historyWeekIndex = currentHistoryWeekIndex();
    await loadState();
  } catch (error) {
    toast("Не получилось", error.message);
    button.disabled = false;
    button.textContent = authMode === "signup" ? "Создать профиль" : "Войти";
  }
}

async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
  } catch {}
  state = null;
  lastResult = null;
  renderAuth();
}

async function submitQuick(event) {
  event.preventDefault();
  const input = document.querySelector("#quick-input");
  const dateInput = document.querySelector("#quick-date");
  const button = document.querySelector("#quick-submit");
  const text = input.value.trim();
  if (!text) return;
  button.disabled = true;
  button.innerHTML = `${icon("send")} Добавляем`;
  try {
    const payload = { text };
    const selectedDate = dateInputToIso(dateInput?.value);
    if (selectedDate) payload.occurredAt = selectedDate;
    const result = await api("/api/transactions", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    lastResult = result;
    state.transactions = [result.transaction, ...state.transactions]
      .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
    state.summary = result.summary;
    state.insights = result.insights;
    activeView = "quick";
    location.hash = "quick";
    render();
    toast("Добавлено", `${result.transaction.title} · ${money(result.transaction.amount)}`);
  } catch (error) {
    toast("Не добавлено", error.message);
    render();
  }
}

async function submitBudget(event) {
  event.preventDefault();
  const input = document.querySelector("#budget-input");
  try {
    const result = await api("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ monthlyBudget: Number(input.value.replace(/\s/g, "")) })
    });
    state.settings = result.settings;
    state.summary = result.summary;
    state.insights = result.insights;
    render();
    toast("Бюджет сохранен", money(state.summary.budget));
  } catch (error) {
    toast("Бюджет не сохранен", error.message);
  }
}

async function submitCategoryLimits(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const categoryBudgets = {};
  form.querySelectorAll("[data-category-limit]").forEach((input) => {
    const value = Number(String(input.value || "").replace(/\s/g, ""));
    if (Number.isFinite(value) && value > 0) {
      categoryBudgets[input.dataset.categoryLimit] = value;
    }
  });
  try {
    const result = await api("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ categoryBudgets })
    });
    state.settings = result.settings;
    state.summary = result.summary;
    state.insights = result.insights;
    render();
    toast("Лимиты сохранены", "Категории теперь сравниваются с вашими ориентирами");
  } catch (error) {
    toast("Лимиты не сохранены", error.message);
  }
}

async function submitCategory(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const input = form.querySelector("input[name='label']");
  const button = form.querySelector("button[type='submit']");
  const label = input.value.trim();
  if (!label) return;
  button.disabled = true;
  try {
    const result = await api("/api/categories", {
      method: "POST",
      body: JSON.stringify({ label })
    });
    state.categories = result.categories;
    state.summary = result.summary;
    state.insights = result.insights;
    input.value = "";
    render();
    toast("Категория добавлена", result.category.label);
  } catch (error) {
    toast("Не добавлено", error.message);
    button.disabled = false;
  }
}

async function deleteCategory(id) {
  try {
    const result = await api(`/api/categories/${id}`, { method: "DELETE" });
    state.categories = result.categories;
    if (result.settings) state.settings = result.settings;
    state.transactions = result.transactions;
    state.summary = result.summary;
    state.insights = result.insights;
    render();
    toast("Категория удалена", "Операции перенесены в «Другое»");
  } catch (error) {
    toast("Не удалено", error.message);
  }
}

async function deleteTransaction(id) {
  try {
    const result = await api(`/api/transactions/${id}`, { method: "DELETE" });
    state.transactions = state.transactions.filter((transaction) => transaction.id !== id);
    state.summary = result.summary;
    state.insights = result.insights;
    render();
    toast("Операция удалена", "Картина месяца обновлена");
  } catch (error) {
    toast("Не удалено", error.message);
  }
}

async function clearHistory() {
  if (!state.transactions.length) return;
  const ok = window.confirm("Удалить всю историю операций? Бюджет, профиль и категории останутся, но операции восстановить нельзя.");
  if (!ok) return;
  try {
    const result = await api("/api/transactions", { method: "DELETE" });
    state.transactions = result.transactions;
    state.summary = result.summary;
    state.insights = result.insights;
    lastResult = null;
    historySearch = "";
    historyCategory = "all";
    historyWeekIndex = currentHistoryWeekIndex();
    dashboardMonthKey = monthKey(new Date());
    render();
    toast("История очищена", "Бюджет и категории сохранены");
  } catch (error) {
    toast("Не очищено", error.message);
  }
}

async function updateTransaction(id, payload) {
  try {
    const result = await api(`/api/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    const index = state.transactions.findIndex((transaction) => transaction.id === id);
    if (index >= 0) state.transactions[index] = result.transaction;
    state.summary = result.summary;
    state.insights = result.insights;
    render();
    toast("Категория обновлена", result.transaction.title);
  } catch (error) {
    toast("Не обновлено", error.message);
    render();
  }
}

function filteredTransactions() {
  const now = new Date();
  const selectedWeek = historyWeekRange();
  const currentMonth = monthBounds(monthKey(now));
  const transactions = state.transactions.filter((transaction) => {
    const occurredAt = new Date(transaction.occurredAt);
    const inRange = historyFilter === "all"
      || (historyFilter === "future" && occurredAt > now)
      || (historyFilter === "week" && occurredAt >= selectedWeek.start && occurredAt < selectedWeek.end)
      || (historyFilter === "month" && occurredAt >= currentMonth.start && occurredAt < currentMonth.end);
    return inRange && matchesHistoryQueryAndCategory(transaction);
  });
  if (historyFilter === "future") {
    return transactions.sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));
  }
  return transactions;
}

function matchesHistoryQueryAndCategory(transaction) {
  const query = historySearch.trim().toLowerCase();
  const category = categoryById(transaction.category);
  const matchesCategory = historyCategory === "all" || transaction.category === historyCategory;
  const searchable = `${transaction.title} ${transaction.rawText} ${category?.label || ""} ${transaction.category}`.toLowerCase();
  const matches = !query || searchable.includes(query);
  return matchesCategory && matches;
}

function futureTransactions() {
  const now = new Date();
  return state.transactions
    .filter((transaction) => new Date(transaction.occurredAt) > now)
    .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));
}

function scheduledOutsideSelectedWeek(transactions) {
  const { start, end } = historyWeekRange();
  return transactions.filter((transaction) => {
    const occurredAt = new Date(transaction.occurredAt);
    return occurredAt < start || occurredAt >= end;
  });
}

function metric(label, value, hint = "") {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${hint ? `<small>${escapeHtml(hint)}</small>` : ""}</div>`;
}

function statusCopy(status, archived = false) {
  if (archived) {
    if (status === "over") {
      return {
        label: "Месяц закрыт выше бюджета",
        body: "Это сохранённый месяц. Посмотрите драйверы расходов и сравните их с текущим месяцем."
      };
    }
    if (status === "watch") {
      return {
        label: "Месяц был близко к лимиту",
        body: "Архив показывает, где бюджет почти вышел за границу. Эти категории стоит держать под наблюдением."
      };
    }
    return {
      label: "Месяц закрыт в бюджете",
      body: "Архив сохранён: можно сравнивать прошлые траты с текущим месяцем."
    };
  }
  if (status === "learning") {
    return {
      label: "Нужно больше данных",
      body: "Сделайте минимум 3 траты для расчёта темпа. Пока Finley показывает факт, но не делает жёсткий прогноз по одной операции."
    };
  }
  if (status === "over") {
    return {
      label: "Перерасход по прогнозу",
      body: "Если ничего не менять, месяц закончится выше бюджета. Смотрите раздел «Советы» для главного рычага."
    };
  }
  if (status === "watch") {
    return {
      label: "Зона внимания",
      body: "Бюджет пока держится, но дневной темп уже близко к границе."
    };
  }
  return {
    label: "В бюджете",
    body: "Текущий темп расходов оставляет запас до конца месяца."
  };
}

function toneLabel(tone) {
  return {
    danger: "Коррекция",
    warn: "Внимание",
    good: "Хорошо",
    neutral: "Наблюдение"
  }[tone] || "Совет";
}

function categoryById(id) {
  return state.categories.find((category) => category.id === id) || state.categories[state.categories.length - 1];
}

function categoryBudgetFor(id) {
  return roundClientMoney(Number(state.settings?.categoryBudgets?.[id] || 0));
}

function money(value) {
  return formatter.format(Number(value) || 0);
}

function roundClientMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
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

function currentHistoryWeekIndex(date = new Date()) {
  return Math.floor((appDateParts(date).day - 1) / 7);
}

function historyWeekRange() {
  const today = appDateParts();
  const start = zonedDateTimeToUtc(today.year, today.month - 1, 1 + historyWeekIndex * 7, 0, 0, 0);
  const end = addDays(start, 7);
  return { start, end };
}

function historyWeekLabel(start, end) {
  const lastDay = addDays(end, -1);
  const startParts = appDateParts(start);
  const lastParts = appDateParts(lastDay);
  const sameMonth = startParts.month === lastParts.month && startParts.year === lastParts.year;
  if (sameMonth) return `${startParts.day}-${lastParts.day} ${compactMonthLabel(start)}`;
  return `${compactDateLabel(start)} - ${compactDateLabel(lastDay)}`;
}

function compactDateLabel(date) {
  return dateFormatter.format(date).replace(".", "");
}

function compactMonthLabel(date) {
  return dateFormatter.formatToParts(date)
    .find((part) => part.type === "month")?.value
    .replace(".", "") || date.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "");
}

function monthKey(date) {
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = appDateParts(safeDate);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

function monthBounds(key) {
  const [year, month] = String(key || monthKey(new Date())).split("-").map(Number);
  const start = zonedDateTimeToUtc(year, month - 1, 1, 0, 0, 0);
  const end = zonedDateTimeToUtc(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1, 0, 0, 0);
  return { start, end };
}

function fullMonthLabel(key) {
  const { start } = monthBounds(key);
  return start.toLocaleDateString("ru-RU", { month: "long", year: "numeric", timeZone: APP_TIME_ZONE });
}

function shortMonthLabel(key) {
  const { start } = monthBounds(key);
  return start.toLocaleDateString("ru-RU", { month: "short", year: "2-digit", timeZone: APP_TIME_ZONE }).replace(".", "");
}

function dateInputToIso(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = zonedDateTimeToUtc(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.dot}</svg>`;
}

function toast(title, body) {
  clearTimeout(toastTimer);
  document.querySelector(".toast")?.remove();
  const node = document.createElement("div");
  node.className = "toast";
  node.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(body)}</span>`;
  document.body.appendChild(node);
  toastTimer = setTimeout(() => node.remove(), 3200);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
