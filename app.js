import { buildDigest, researchHotTopics, worldHotTopics } from "./data.js";

const STORAGE_KEY = "pulse-deck-settings";
const DEFAULT_SETTINGS = {
  worldEnabled: true,
  worldInterval: 180,
  researchEnabled: true,
  researchInterval: 240,
  keywords: "OpenAI, agent, LLM, NLP, geopolitics, startup",
};

const state = {
  settings: loadSettings(),
  worldItems: [],
  researchItems: [],
  timers: {
    world: null,
    research: null,
  },
  nextRuns: {
    world: null,
    research: null,
  },
  loading: {
    world: false,
    research: false,
  },
  sourceMeta: {
    world: fallbackMeta("本地后备"),
    research: fallbackMeta("本地后备"),
  },
  latestNotifiedId: {
    world: null,
    research: null,
  },
};

const elements = {
  notifyPermissionBtn: document.querySelector("#notifyPermissionBtn"),
  manualDigestBtn: document.querySelector("#manualDigestBtn"),
  saveSettingsBtn: document.querySelector("#saveSettingsBtn"),
  pauseAllBtn: document.querySelector("#pauseAllBtn"),
  refreshWorldBtn: document.querySelector("#refreshWorldBtn"),
  refreshResearchBtn: document.querySelector("#refreshResearchBtn"),
  worldToggle: document.querySelector("#worldToggle"),
  researchToggle: document.querySelector("#researchToggle"),
  worldInterval: document.querySelector("#worldInterval"),
  researchInterval: document.querySelector("#researchInterval"),
  keywordInput: document.querySelector("#keywordInput"),
  worldFeed: document.querySelector("#worldFeed"),
  researchFeed: document.querySelector("#researchFeed"),
  digestOutput: document.querySelector("#digestOutput"),
  worldCount: document.querySelector("#worldCount"),
  researchCount: document.querySelector("#researchCount"),
  worldNextRun: document.querySelector("#worldNextRun"),
  researchNextRun: document.querySelector("#researchNextRun"),
  notificationState: document.querySelector("#notificationState"),
  systemMode: document.querySelector("#systemMode"),
  lastDigestTime: document.querySelector("#lastDigestTime"),
  dataModeBadge: document.querySelector("#dataModeBadge"),
  sourceSummary: document.querySelector("#sourceSummary"),
};

void initialize();

async function initialize() {
  syncControlsFromSettings();
  seedFallbackFeeds();
  renderAll();
  bindEvents();
  updateNotificationState();
  registerServiceWorker();
  await Promise.all([refreshStream("world"), refreshStream("research")]);
  startSchedulers();
}

function fallbackMeta(provider) {
  return {
    mode: "fallback",
    provider,
    fetchedAt: null,
    error: null,
  };
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
}

function syncControlsFromSettings() {
  elements.worldToggle.checked = state.settings.worldEnabled;
  elements.researchToggle.checked = state.settings.researchEnabled;
  elements.worldInterval.value = state.settings.worldInterval;
  elements.researchInterval.value = state.settings.researchInterval;
  elements.keywordInput.value = state.settings.keywords;
}

function bindEvents() {
  elements.notifyPermissionBtn.addEventListener("click", requestNotificationPermission);
  elements.manualDigestBtn.addEventListener("click", generateDigest);
  elements.saveSettingsBtn.addEventListener("click", handleSaveSettings);
  elements.pauseAllBtn.addEventListener("click", pauseAllSchedules);
  elements.refreshWorldBtn.addEventListener("click", () => refreshStream("world", { manual: true }));
  elements.refreshResearchBtn.addEventListener("click", () =>
    refreshStream("research", { manual: true }),
  );
}

function seedFallbackFeeds() {
  state.worldItems = buildFallbackItems("world");
  state.researchItems = buildFallbackItems("research");
}

function buildFallbackItems(type) {
  const source = type === "world" ? worldHotTopics : researchHotTopics;
  return source.slice(0, 6).map((item, index) => ({
    id: `fallback-${type}-${index}`,
    title: item.title,
    summary: item.summary,
    timestamp: formatTime(new Date()),
    url: buildItemLink(type, item.title, ""),
    provider: "本地后备",
    linkLabel: buildLinkLabel(type, ""),
    region: type === "world" ? item.region : item.domain,
    signal: item.signal,
    relevance: item.relevance,
  }));
}

async function refreshStream(type, { manual = false } = {}) {
  if (state.loading[type]) return;

  state.loading[type] = true;
  updateRefreshButtonState(type);
  renderFeed(type);

  const previousTopId = state[`${type}Items`][0]?.id;
  const endpoint = `/api/${type}?keywords=${encodeURIComponent(state.settings.keywords)}${
    manual ? `&force=1&_ts=${Date.now()}` : ""
  }`;

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const items = normalizeItems(type, payload.items);
    state[`${type}Items`] = items.length ? items : buildFallbackItems(type);
    state.sourceMeta[type] = {
      mode: payload.mode || "live",
      provider: payload.provider || "实时源",
      fetchedAt: payload.fetchedAt || new Date().toISOString(),
      error: payload.error || null,
    };

    const currentTop = state[`${type}Items`][0];
    if (
      previousTopId &&
      currentTop &&
      currentTop.id !== previousTopId &&
      state.settings[`${type}Enabled`] &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      maybeNotify(type, currentTop);
    }

    state.latestNotifiedId[type] = currentTop?.id || null;
    scheduleNextRun(type);

    if (manual) {
      showToastCard(
        type === "world" ? "世界热点已更新" : "AI / NLP 前沿已更新",
        `${state.sourceMeta[type].provider} 已返回最新数据。`,
      );
    }
  } catch (error) {
    state[`${type}Items`] = buildFallbackItems(type);
    state.sourceMeta[type] = {
      mode: "fallback",
      provider: "本地后备",
      fetchedAt: new Date().toISOString(),
      error: error.message,
    };
    scheduleNextRun(type);

    if (manual) {
      showToastCard(
        "实时源暂不可用",
        `${type === "world" ? "新闻流" : "论文流"} 已切回本地后备数据。`,
      );
    }
  } finally {
    state.loading[type] = false;
    updateRefreshButtonState(type);
    renderFeed(type);
    renderMetrics();
  }
}

function updateRefreshButtonState(type) {
  const button = type === "world" ? elements.refreshWorldBtn : elements.refreshResearchBtn;
  if (!button) return;
  button.disabled = state.loading[type];
  button.textContent = state.loading[type] ? "刷新中..." : "刷新";
}

function normalizeItems(type, items = []) {
  return items.slice(0, 6).map((item, index) => ({
    id: item.id || `${type}-${index}-${item.title || "entry"}`,
    title: item.title || "未命名条目",
    summary: item.summary || "暂无摘要。",
    timestamp: item.timestamp || formatTime(new Date()),
    url: buildItemLink(type, item.title || "", item.url || ""),
    provider: item.provider || (type === "world" ? "新闻源" : "论文源"),
    linkLabel: item.linkLabel || buildLinkLabel(type, item.url || ""),
    region: type === "world" ? item.region || "Global" : item.domain || "Research",
    signal: item.signal || "实时更新",
    relevance: item.relevance || "",
  }));
}

function buildItemLink(type, title, existingUrl) {
  if (existingUrl) return existingUrl;

  const encodedTitle = encodeURIComponent(title);
  if (type === "world") {
    return `https://www.bing.com/news/search?q=${encodedTitle}`;
  }

  return `https://www.semanticscholar.org/search?q=${encodedTitle}&sort=relevance`;
}

function buildLinkLabel(type, existingUrl) {
  if (existingUrl) {
    return type === "world" ? "查看原文" : "查看论文";
  }

  return type === "world" ? "查看线索" : "搜索论文";
}

function renderAll() {
  renderFeed("world");
  renderFeed("research");
  renderMetrics();
}

function renderFeed(type) {
  const container = type === "world" ? elements.worldFeed : elements.researchFeed;
  const items = state[`${type}Items`];
  const meta = state.sourceMeta[type];
  const regionLabel = type === "world" ? "影响面" : "落地方向";

  if (state.loading[type] && !items.length) {
    container.innerHTML = '<div class="empty-state">正在连接真实数据源...</div>';
    return;
  }

  if (!items.length) {
    container.innerHTML = '<div class="empty-state">当前没有内容，等待下一次推送。</div>';
    return;
  }

  container.innerHTML = `
    <div class="feed-status ${meta.mode === "live" ? "live" : "fallback"}">
      <span>${meta.mode === "live" ? "实时源在线" : "本地后备模式"}</span>
      <span>${escapeHtml(buildSourceLine(meta))}</span>
    </div>
    ${items
      .map(
        ({ title, summary, region, signal, relevance, timestamp, url, provider, linkLabel }) => `
          <article class="feed-item">
            <div class="feed-item-header">
              <span class="tag">${escapeHtml(region)}</span>
              <span class="muted">${escapeHtml(timestamp)}</span>
            </div>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(summary)}</p>
            <div class="feed-meta">
              <span class="tag ${type === "world" ? "warning" : "success"}">${escapeHtml(signal)}</span>
              <span>${regionLabel}: ${escapeHtml(relevance || provider)}</span>
            </div>
            <div class="feed-footer">
              <span class="muted">${escapeHtml(provider)}</span>
              ${
                url
                  ? `<a class="feed-link" href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${escapeHtml(linkLabel)}</a>`
                  : ""
              }
            </div>
          </article>
        `,
      )
      .join("")}
  `;
}

function renderMetrics() {
  elements.worldCount.textContent = String(state.worldItems.length);
  elements.researchCount.textContent = String(state.researchItems.length);
  elements.worldNextRun.textContent = formatNextRunText(state.nextRuns.world, state.settings.worldEnabled);
  elements.researchNextRun.textContent = formatNextRunText(
    state.nextRuns.research,
    state.settings.researchEnabled,
  );

  const liveCount = [state.sourceMeta.world, state.sourceMeta.research].filter(
    (entry) => entry.mode === "live",
  ).length;
  elements.systemMode.textContent = liveCount === 2 ? "真实源在线" : "混合模式";
  elements.dataModeBadge.textContent = liveCount === 2 ? "LIVE SOURCES" : "LIVE + FALLBACK";
  elements.sourceSummary.textContent = [
    `热点: ${buildSourceLine(state.sourceMeta.world)}`,
    `研究: ${buildSourceLine(state.sourceMeta.research)}`,
  ].join(" | ");
}

function buildSourceLine(meta) {
  const provider = meta.provider || "未知来源";
  const fetched = meta.fetchedAt ? formatTime(new Date(meta.fetchedAt)) : "尚未拉取";
  return meta.error ? `${provider} · ${fetched} · ${meta.error}` : `${provider} · ${fetched}`;
}

function handleSaveSettings() {
  state.settings = {
    worldEnabled: elements.worldToggle.checked,
    researchEnabled: elements.researchToggle.checked,
    worldInterval: clampMinutes(elements.worldInterval.value),
    researchInterval: clampMinutes(elements.researchInterval.value),
    keywords: elements.keywordInput.value.trim(),
  };
  syncControlsFromSettings();
  saveSettings();
  startSchedulers();
  void Promise.all([refreshStream("world"), refreshStream("research")]);
  showToastCard("设置已保存", "新的关键词和轮询节奏已经开始生效。");
}

function pauseAllSchedules() {
  state.settings.worldEnabled = false;
  state.settings.researchEnabled = false;
  clearTimer("world");
  clearTimer("research");
  state.nextRuns.world = null;
  state.nextRuns.research = null;
  syncControlsFromSettings();
  saveSettings();
  renderMetrics();
  showToastCard("推送已暂停", "两个信息流都已停止自动更新。");
}

function startSchedulers() {
  clearTimer("world");
  clearTimer("research");

  if (state.settings.worldEnabled) {
    scheduleNextRun("world");
    state.timers.world = window.setInterval(
      () => void refreshStream("world"),
      minutesToMs(state.settings.worldInterval),
    );
  } else {
    state.nextRuns.world = null;
  }

  if (state.settings.researchEnabled) {
    scheduleNextRun("research");
    state.timers.research = window.setInterval(
      () => void refreshStream("research"),
      minutesToMs(state.settings.researchInterval),
    );
  } else {
    state.nextRuns.research = null;
  }

  renderMetrics();
}

function clearTimer(type) {
  if (state.timers[type]) {
    window.clearInterval(state.timers[type]);
    state.timers[type] = null;
  }
}

function scheduleNextRun(type) {
  const minutes = type === "world" ? state.settings.worldInterval : state.settings.researchInterval;
  state.nextRuns[type] = new Date(Date.now() + minutesToMs(minutes));
}

function maybeNotify(type, item) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }
  if (state.latestNotifiedId[type] === item.id) {
    return;
  }

  const title = type === "world" ? "全球热点更新" : "AI / NLP 前沿更新";
  new Notification(title, {
    body: `${item.title} | ${item.summary}`,
    tag: `pulse-deck-${type}`,
    silent: false,
  });
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    showToastCard("当前浏览器不支持通知", "请换一个支持 Notification API 的浏览器。");
    return;
  }

  const permission = await Notification.requestPermission();
  updateNotificationState(permission);

  if (permission === "granted") {
    showToastCard("通知已开启", "后续自动刷新时会向你发送浏览器提醒。");
  } else {
    showToastCard("通知未授权", "你仍然可以在页面内查看持续更新的信息流。");
  }
}

function updateNotificationState(permission = "Notification" in window ? Notification.permission : "default") {
  const map = {
    granted: "已授权",
    denied: "已拒绝",
    default: "未授权",
  };
  elements.notificationState.textContent = map[permission] || "未授权";
}

function generateDigest() {
  const digest = buildDigest(state.worldItems, state.researchItems, state.settings.keywords);
  elements.digestOutput.textContent = digest;
  elements.lastDigestTime.textContent = `最近摘要: ${formatTime(new Date())}`;
  showToastCard("今日摘要已生成", "当前简报已经根据最新信息流重组。");
}

function showToastCard(title, message) {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
  stack.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
    if (!stack.childElementCount) {
      stack.remove();
    }
  }, 3200);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Service worker failure should not block the main app.
    });
  }
}

function minutesToMs(minutes) {
  return Number(minutes) * 60 * 1000;
}

function clampMinutes(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 60;
  return Math.min(1440, Math.max(1, Math.round(numeric)));
}

function formatTime(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatNextRunText(date, enabled) {
  if (!enabled) return "已暂停";
  if (!date) return "等待启动";
  return `下次更新 ${formatTime(date)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
