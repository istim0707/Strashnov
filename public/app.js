const app = document.querySelector("#app");

const views = [
  { id: "dashboard", label: "Обзор", short: "Бюджет" },
  { id: "quick", label: "Добавить", short: "Добавить" },
  { id: "history", label: "История", short: "История" },
  { id: "insights", label: "Советы", short: "Советы" }
];

const iconPaths = {
  dashboard: '<path d="M4 13a8 8 0 1 1 16 0"/><path d="M12 13l4-4"/><path d="M4 13h3"/><path d="M17 13h3"/><path d="M12 5v3"/>',
  quick: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/>',
  insights: '<path d="M12 2v5"/><path d="M12 17v5"/><path d="M4.93 4.93l3.54 3.54"/><path d="M15.54 15.54l3.53 3.53"/><path d="M2 12h5"/><path d="M17 12h5"/><path d="M4.93 19.07l3.54-3.53"/><path d="M15.54 8.46l3.53-3.53"/>',
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
  month: "short"
});

const weekdayFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "short"
});

init();

async function init() {
  activeView = location.hash.replace("#", "") || "dashboard";
  if (!views.some((view) => view.id === activeView)) activeView = "dashboard";
  window.addEventListener("hashchange", () => {
    activeView = location.hash.replace("#", "") || "dashboard";
    render();
  });
  await boot();
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
  const showTopAdd = activeView !== "quick" && !(activeView === "dashboard" && dashboardSummary?.isCurrentMonth && dashboardSummary.status === "over");
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
  if (summary.status === "over") return "Месяц требует коррекции";
  if (summary.status === "watch") return "Бюджет близко к границе";
  return "Вы укладываетесь в бюджет";
}

function renderActiveView() {
  if (activeView === "quick") return renderQuick();
  if (activeView === "history") return renderHistory();
  if (activeView === "insights") return renderInsights();
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
  const daysLeftValue = summary.isCurrentMonth ? String(summary.daysLeft) : "Архив";
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
                  <div class="runway-fill ${summary.status}" style="--fill:${ratio * 100}%"></div>
                </div>
                <div class="runway-labels"><span>${money(summary.spent)} потрачено</span><span>${money(summary.budget)} бюджет</span></div>
              </div>
            </div>
            ${renderBudgetMeter(summary)}
          </section>
          <div class="metric-grid">
            ${metric("Прогноз", money(summary.projected))}
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
        </section>
      </div>
    </section>
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
  const forecastPercent = Math.round(summary.projectedRatio * 100);
  const spentPercent = Math.round(summary.budgetRatio * 100);
  const marker = Math.min(100, Math.max(0, summary.projectedRatio * 100));
  return `
    <div class="budget-meter ${summary.status}" style="--marker:${marker}%">
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
  const currentKey = monthKey(today);
  const availableKeys = new Set();
  for (let offset = 0; offset < 6; offset += 1) {
    availableKeys.add(monthKey(new Date(today.getFullYear(), today.getMonth() - offset, 1)));
  }
  for (const transaction of state.transactions) {
    availableKeys.add(monthKey(new Date(transaction.occurredAt)));
  }
  if (!availableKeys.has(dashboardMonthKey)) dashboardMonthKey = currentKey;
  return dashboardMonthKey === currentKey ? { ...state.summary, isCurrentMonth: true } : summarizeMonth(dashboardMonthKey);
}

function monthArchive() {
  const today = new Date();
  const keys = new Set();
  for (let offset = 0; offset < 6; offset += 1) {
    keys.add(monthKey(new Date(today.getFullYear(), today.getMonth() - offset, 1)));
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
    return {
      ...category,
      total: roundClientMoney(total),
      share: spent ? total / spent : 0
    };
  })
    .filter((category) => category.total > 0)
    .sort((a, b) => b.total - a.total);

  return {
    ...state.summary,
    monthLabel: fullMonthLabel(key),
    baseBudget,
    budget,
    spent,
    income,
    remaining,
    projected: spent,
    dailySafeSpend: 0,
    daysElapsed: daysInMonth,
    daysInMonth,
    daysLeft: 0,
    budgetRatio,
    projectedRatio: budgetRatio,
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
              <p>Например: потратил 1200 на обед вчера</p>
            </div>
          </div>
          <form class="quick-form" id="quick-form">
            <input class="quick-input" id="quick-input" autocomplete="off" maxlength="240" placeholder="потратил 1200 на обед" />
            <input class="date-input" id="quick-date" type="date" aria-label="Дата операции" title="Дата операции" />
            <button class="primary-button" id="quick-submit" type="submit">${icon("send")} Добавить</button>
          </form>
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
            ${metric("Прогноз", money(state.summary.projected))}
          </div>
          <div style="height:16px"></div>
          ${renderCategoryList(state.summary.categoryTotals.slice(0, 5))}
          ${renderCategoryManager()}
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
        <div class="parse-item"><span>Источник</span><strong>${result.ai.used ? "Модель" : "Правила"}</strong></div>
        <div class="parse-item"><span>Дата</span><strong>${dateFormatter.format(new Date(transaction.occurredAt))}</strong></div>
        <div class="parse-item"><span>Тип</span><strong>${transaction.type === "income" ? "Доход" : "Расход"}</strong></div>
      </div>
    </div>
  `;
}

function renderHistory() {
  const transactions = filteredTransactions();
  const scheduled = futureTransactions();
  const weekTop = state.summary.week.topCategory;
  return `
    <section class="view">
      <div class="history-grid">
        <section class="panel week-hero">
          <div class="panel-header">
            <div>
              <h2>Прошлые 7 дней</h2>
              <p>${state.summary.week.transactionCount} операций</p>
            </div>
          </div>
          <div class="week-amount">${money(state.summary.week.spent)}</div>
          ${renderWeekPulse()}
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
              <div class="segmented">
                <button data-history-filter="week" class="${historyFilter === "week" ? "active" : ""}">Неделя</button>
                <button data-history-filter="month" class="${historyFilter === "month" ? "active" : ""}">Месяц</button>
                <button data-history-filter="future" class="${historyFilter === "future" ? "active" : ""}">Будущие</button>
                <button data-history-filter="all" class="${historyFilter === "all" ? "active" : ""}">Все</button>
              </div>
            </div>
            <button class="clear-history-button" data-clear-history type="button" ${state.transactions.length ? "" : "disabled"}>${icon("trash")} Очистить историю</button>
          </div>
          ${scheduled.length && historyFilter === "week" ? renderScheduledBlock(scheduled) : ""}
          ${transactions.length ? `<div class="tx-list">${transactions.map(renderTransaction).join("")}</div>` : `<div class="empty">Операции не найдены</div>`}
        </section>
      </div>
    </section>
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
  return `
    <section class="view">
      <div class="advice-grid">
        <article class="insight-card primary ${primary.tone}">
          <div class="insight-meta">
            <span>Главный рычаг</span>
            <strong>${escapeHtml(primary.metric)}</strong>
          </div>
          <div>
            <h2>${escapeHtml(primary.title)}</h2>
            <p>${escapeHtml(primary.body)}</p>
            ${primary.detail ? `<small>${escapeHtml(primary.detail)}</small>` : ""}
          </div>
          <button class="ghost-button" data-view-link="${primary.tone === "neutral" ? "quick" : "history"}">${escapeHtml(primary.action)}</button>
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
  const share = Math.round(category.share * 100);
  const saveTen = money(category.total * 0.1);
  return `
    <article class="risk-row">
      <div class="cat-icon" style="--cat:${category.color}">${icon(category.icon)}</div>
      <div class="risk-main">
        <div class="risk-title">
          <strong>${escapeHtml(category.label)}</strong>
          <span>${money(category.total)}</span>
        </div>
        <div class="mini-track"><div class="mini-fill" style="--fill:${Math.min(100, share)}%;--cat:${category.color}"></div></div>
        <p>${share}% расходов · минус 10% даст ${saveTen}</p>
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

function renderWeekPulse() {
  const stats = weekPulseStats();
  const max = Math.max(...stats.days.map((day) => day.total), 1);
  const top = stats.days.reduce((best, day) => (day.total > best.total ? day : best), stats.days[0]);
  const delta = stats.weekSpent - stats.previousSpent;
  const deltaTone = stats.previousSpent === 0 ? "flat" : delta > 0 ? "bad" : delta < 0 ? "good" : "flat";
  const deltaText = stats.previousSpent > 0
    ? `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${money(Math.abs(delta))}`
    : stats.weekSpent > 0 ? "новая база" : "без трат";

  return `
    <section class="week-pulse" aria-label="Динамика расходов за неделю">
      <div class="week-bars">
        ${stats.days.map((day) => `
          <div class="week-bar" title="${escapeAttr(day.label)} · ${escapeAttr(money(day.total))}" style="--bar:${Math.max(6, (day.total / max) * 100)}%">
            <i></i>
            <span>${escapeHtml(day.short)}</span>
          </div>
        `).join("")}
      </div>
      <div class="week-facts">
        <div><span>Средний день</span><strong>${money(stats.average)}</strong></div>
        <div><span>Пик недели</span><strong>${escapeHtml(top.short)} · ${money(top.total)}</strong></div>
        <div><span>К прошлой неделе</span><strong class="${deltaTone}">${escapeHtml(deltaText)}</strong></div>
      </div>
    </section>
  `;
}

function weekPulseStats() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  const previousStart = new Date(start);
  previousStart.setDate(start.getDate() - 7);
  const previousEnd = new Date(start);
  const expenseTransactions = state.transactions.filter((transaction) => transaction.type === "expense");
  const days = Array.from({ length: 7 }, (_, index) => {
    const dayStart = new Date(start);
    dayStart.setDate(start.getDate() + index);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);
    const total = expenseTransactions
      .filter((transaction) => {
        const occurredAt = new Date(transaction.occurredAt);
        return occurredAt >= dayStart && occurredAt < dayEnd;
      })
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    return {
      short: weekdayFormatter.format(dayStart).replace(".", ""),
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
      ${categories.map((category) => `
        <div class="category-row" style="--cat:${category.color}">
          <div class="cat-icon" style="--cat:${category.color}">${icon(category.icon)}</div>
          <div>
            <strong>${escapeHtml(category.label)}</strong>
            <span>${Math.round(categoryShare(category, max) * 100)}% расходов</span>
            <div class="mini-track"><div class="mini-fill" style="--fill:${Math.max(5, (category.total / max) * 100)}%"></div></div>
          </div>
          <div class="category-amount">${money(category.total)}</div>
        </div>
      `).join("")}
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
  return `
    <form class="budget-editor" id="budget-form">
      <label for="budget-input">Бюджет месяца</label>
      <div class="budget-editor-row">
        <input id="budget-input" value="${Math.round(state.summary.budget)}" inputmode="numeric" />
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

function renderUserProfile() {
  const user = state.user || {};
  return `
    <section class="profile-card">
      <span>Профиль</span>
      <strong>${escapeHtml(user.name || "Пользователь")}</strong>
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
  return `
    <nav class="${className}" aria-label="Разделы Finley">
      ${views.map((view) => `
        <button class="nav-button" data-view-link="${view.id}" aria-current="${activeView === view.id ? "page" : "false"}" title="${view.label}">
          ${icon(view.id)}
          <span>${short ? view.short : view.label}</span>
        </button>
      `).join("")}
    </nav>
  `;
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

  document.querySelectorAll("[data-dashboard-month]").forEach((button) => {
    button.addEventListener("click", () => {
      dashboardMonthKey = button.dataset.dashboardMonth;
      render();
    });
  });

  document.querySelector("[data-clear-history]")?.addEventListener("click", clearHistory);

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
  const start = new Date(now);
  if (historyFilter === "week") start.setDate(now.getDate() - 6);
  if (historyFilter === "month") start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const query = historySearch.trim().toLowerCase();
  const transactions = state.transactions.filter((transaction) => {
    const occurredAt = new Date(transaction.occurredAt);
    const inRange = historyFilter === "all"
      || (historyFilter === "future" && occurredAt > now)
      || (historyFilter === "week" && occurredAt >= start && occurredAt <= now)
      || (historyFilter === "month" && occurredAt >= start);
    const matches = !query || `${transaction.title} ${transaction.rawText}`.toLowerCase().includes(query);
    return inRange && matches;
  });
  if (historyFilter === "future") {
    return transactions.sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));
  }
  return transactions;
}

function futureTransactions() {
  const now = new Date();
  return state.transactions
    .filter((transaction) => new Date(transaction.occurredAt) > now)
    .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));
}

function metric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
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

function money(value) {
  return formatter.format(Number(value) || 0);
}

function roundClientMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function monthKey(date) {
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return `${safeDate.getFullYear()}-${String(safeDate.getMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(key) {
  const [year, month] = String(key || monthKey(new Date())).split("-").map(Number);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end };
}

function fullMonthLabel(key) {
  const { start } = monthBounds(key);
  return start.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

function shortMonthLabel(key) {
  const { start } = monthBounds(key);
  return start.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" }).replace(".", "");
}

function dateInputToIso(value) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
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
