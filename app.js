import {
  buildDigest,
  entertainmentHotTopics,
  musicHotTracks,
  researchHotTopics,
  worldHotTopics,
} from "./data.js";

const STORAGE_KEY = "pulse-deck-settings";
const DEFAULT_SETTINGS = {
  worldEnabled: true,
  worldInterval: 180,
  researchEnabled: true,
  researchInterval: 240,
  musicEnabled: true,
  musicInterval: 300,
  entertainmentEnabled: true,
  entertainmentInterval: 210,
  keywords: "OpenAI, agent, LLM, NLP, geopolitics, startup",
};
const DEFAULT_BATCH_SIZE = 6;
const STREAM_TYPES = ["world", "research", "music", "entertainment"];

const state = {
  settings: loadSettings(),
  worldItems: [],
  researchItems: [],
  musicItems: [],
  entertainmentItems: [],
  pools: {
    world: [],
    research: [],
    music: [],
    entertainment: [],
  },
  seenIds: {
    world: new Set(),
    research: new Set(),
    music: new Set(),
    entertainment: new Set(),
  },
  timers: {
    world: null,
    research: null,
    music: null,
    entertainment: null,
  },
  nextRuns: {
    world: null,
    research: null,
    music: null,
    entertainment: null,
  },
  loading: {
    world: false,
    research: false,
    music: false,
    entertainment: false,
  },
  batchSize: {
    world: DEFAULT_BATCH_SIZE,
    research: DEFAULT_BATCH_SIZE,
    music: DEFAULT_BATCH_SIZE,
    entertainment: DEFAULT_BATCH_SIZE,
  },
  sourceMeta: {
    world: fallbackMeta("本地后备"),
    research: fallbackMeta("本地后备"),
    music: fallbackMeta("本地后备"),
    entertainment: fallbackMeta("本地后备"),
  },
  latestNotifiedId: {
    world: null,
    research: null,
    music: null,
    entertainment: null,
  },
};

const elements = {
  notifyPermissionBtn: document.querySelector("#notifyPermissionBtn"),
  manualDigestBtn: document.querySelector("#manualDigestBtn"),
  saveSettingsBtn: document.querySelector("#saveSettingsBtn"),
  pauseAllBtn: document.querySelector("#pauseAllBtn"),
  refreshWorldBtn: document.querySelector("#refreshWorldBtn"),
  refreshResearchBtn: document.querySelector("#refreshResearchBtn"),
  refreshMusicBtn: document.querySelector("#refreshMusicBtn"),
  refreshEntertainmentBtn: document.querySelector("#refreshEntertainmentBtn"),
  nextWorldBtn: document.querySelector("#nextWorldBtn"),
  nextResearchBtn: document.querySelector("#nextResearchBtn"),
  nextMusicBtn: document.querySelector("#nextMusicBtn"),
  nextEntertainmentBtn: document.querySelector("#nextEntertainmentBtn"),
  worldToggle: document.querySelector("#worldToggle"),
  researchToggle: document.querySelector("#researchToggle"),
  musicToggle: document.querySelector("#musicToggle"),
  entertainmentToggle: document.querySelector("#entertainmentToggle"),
  worldInterval: document.querySelector("#worldInterval"),
  researchInterval: document.querySelector("#researchInterval"),
  musicInterval: document.querySelector("#musicInterval"),
  entertainmentInterval: document.querySelector("#entertainmentInterval"),
  keywordInput: document.querySelector("#keywordInput"),
  worldFeed: document.querySelector("#worldFeed"),
  researchFeed: document.querySelector("#researchFeed"),
  musicFeed: document.querySelector("#musicFeed"),
  entertainmentFeed: document.querySelector("#entertainmentFeed"),
  digestOutput: document.querySelector("#digestOutput"),
  worldCount: document.querySelector("#worldCount"),
  researchCount: document.querySelector("#researchCount"),
  musicCount: document.querySelector("#musicCount"),
  entertainmentCount: document.querySelector("#entertainmentCount"),
  worldNextRun: document.querySelector("#worldNextRun"),
  researchNextRun: document.querySelector("#researchNextRun"),
  musicNextRun: document.querySelector("#musicNextRun"),
  entertainmentNextRun: document.querySelector("#entertainmentNextRun"),
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
  await Promise.all(STREAM_TYPES.map((type) => refreshStream(type)));
  startSchedulers();
}

function fallbackMeta(provider) {
  return {
    mode: "fallback",
    provider,
    fetchedAt: null,
    error: null,
    poolSize: DEFAULT_BATCH_SIZE,
    providers: [provider],
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
  elements.musicToggle.checked = state.settings.musicEnabled;
  elements.entertainmentToggle.checked = state.settings.entertainmentEnabled;
  elements.worldInterval.value = state.settings.worldInterval;
  elements.researchInterval.value = state.settings.researchInterval;
  elements.musicInterval.value = state.settings.musicInterval;
  elements.entertainmentInterval.value = state.settings.entertainmentInterval;
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
  elements.refreshMusicBtn.addEventListener("click", () => refreshStream("music", { manual: true }));
  elements.refreshEntertainmentBtn.addEventListener("click", () =>
    refreshStream("entertainment", { manual: true }),
  );
  elements.nextWorldBtn.addEventListener("click", () => nextBatch("world", { manual: true }));
  elements.nextResearchBtn.addEventListener("click", () => nextBatch("research", { manual: true }));
  elements.nextMusicBtn.addEventListener("click", () => nextBatch("music", { manual: true }));
  elements.nextEntertainmentBtn.addEventListener("click", () =>
    nextBatch("entertainment", { manual: true }),
  );
}

function seedFallbackFeeds() {
  STREAM_TYPES.forEach((type) => {
    const pool = buildFallbackItems(type);
    state.pools[type] = pool;
    state.sourceMeta[type] = {
      ...fallbackMeta("本地后备"),
      poolSize: pool.length,
      providers: ["本地后备"],
    };
    nextBatch(type, { resetSeen: true });
  });
}

function buildFallbackItems(type) {
  const source =
    type === "world"
      ? worldHotTopics
      : type === "research"
        ? researchHotTopics
        : type === "music"
          ? musicHotTracks
          : entertainmentHotTopics;

  return source.map((item, index) => ({
    id: `fallback-${type}-${index}`,
    title: item.title,
    summary: item.summary,
    timestamp: formatTime(new Date()),
    url: buildItemLink(type, item.title, "", item.artist || ""),
    provider: "本地后备",
    linkLabel: buildLinkLabel(type, ""),
    region:
      type === "world"
        ? item.region
        : type === "research"
          ? item.domain
          : type === "music"
            ? item.genre
            : item.category,
    signal: item.signal,
    relevance: item.relevance || item.artist || "",
  }));
}

async function refreshStream(type, { manual = false } = {}) {
  if (state.loading[type]) return;

  state.loading[type] = true;
  updateButtonState(type);
  renderFeed(type);

  const endpoint = `/api/${type}?keywords=${encodeURIComponent(state.settings.keywords)}${
    manual ? `&force=1&_ts=${Date.now()}` : ""
  }`;

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const pool = normalizeItems(type, payload.items);

    if (pool.length) {
      state.pools[type] = pool;
      state.batchSize[type] = payload.batchSize || DEFAULT_BATCH_SIZE;
      state.seenIds[type].clear();
      nextBatch(type, { resetSeen: true });
    }

    state.sourceMeta[type] = {
      mode: payload.mode || "live",
      provider: payload.provider || "实时源",
      fetchedAt: payload.fetchedAt || new Date().toISOString(),
      error: payload.error || null,
      poolSize: payload.poolSize || pool.length,
      providers: payload.providers || [payload.provider || "实时源"],
    };

    const currentTop = state[`${type}Items`][0];
    if (
      currentTop &&
      state.settings[`${type}Enabled`] &&
      "Notification" in window &&
      Notification.permission === "granted" &&
      state.latestNotifiedId[type] !== currentTop.id &&
      !manual
    ) {
      maybeNotify(type, currentTop);
    }

    state.latestNotifiedId[type] = currentTop?.id || null;
    scheduleNextRun(type);

    if (manual) {
      showToastCard(
        streamTitle(type) + "资源池已刷新",
        `${state.sourceMeta[type].provider} · ${state.sourceMeta[type].poolSize} 条内容`,
      );
    }
  } catch (error) {
    if (!state.pools[type].length) {
      state.pools[type] = buildFallbackItems(type);
      state.seenIds[type].clear();
      nextBatch(type, { resetSeen: true });
    }

    state.sourceMeta[type] = {
      mode: "fallback",
      provider: state.pools[type].length ? "沿用当前内容池" : "本地后备",
      fetchedAt: new Date().toISOString(),
      error: error.message,
      poolSize: state.pools[type].length,
      providers: [state.pools[type].length ? "当前资源池" : "本地后备"],
    };
    scheduleNextRun(type);

    if (manual) {
      showToastCard(
        "实时源暂不可用",
        `${streamShortName(type)}保留当前内容，你仍然可以点“换一批”。`,
      );
    }
  } finally {
    state.loading[type] = false;
    updateButtonState(type);
    renderFeed(type);
    renderMetrics();
  }
}

function nextBatch(type, { resetSeen = false, manual = false } = {}) {
  const pool = state.pools[type];
  if (!pool.length) return;

  if (resetSeen) {
    state.seenIds[type].clear();
  }

  let candidates = pool.filter((item) => !state.seenIds[type].has(item.id));
  if (!candidates.length) {
    state.seenIds[type].clear();
    candidates = [...pool];
  }

  const batch = candidates.slice(0, state.batchSize[type] || DEFAULT_BATCH_SIZE);
  batch.forEach((item) => state.seenIds[type].add(item.id));
  state[`${type}Items`] = batch;
  renderFeed(type);
  renderMetrics();

  if (manual) {
    showToastCard(
      streamTitle(type) + "已换一批",
      `当前内容池还有 ${Math.max(pool.length - state.seenIds[type].size, 0)} 条未看过的内容。`,
    );
  }
}

function normalizeItems(type, items = []) {
  return items.map((item, index) => ({
    id: item.id || `${type}-${index}-${item.title || "entry"}`,
    title: item.title || "未命名条目",
    summary: item.summary || "暂无摘要。",
    timestamp: item.timestamp || formatTime(new Date()),
    url: buildItemLink(type, item.title || "", item.url || "", item.artist || item.relevance || ""),
    provider: item.provider || defaultProvider(type),
    linkLabel: item.linkLabel || buildLinkLabel(type, item.url || ""),
    region:
      type === "world"
        ? item.region || "Global"
        : type === "research"
          ? item.domain || "Research"
          : type === "music"
            ? item.genre || item.region || "Trending"
            : item.category || item.region || "Entertainment",
    signal: item.signal || defaultSignal(type),
    relevance: item.relevance || item.artist || "",
  }));
}

function buildItemLink(type, title, existingUrl, extra = "") {
  if (existingUrl) return existingUrl;

  const query = encodeURIComponent(`${title} ${extra}`.trim());
  if (type === "world") {
    return `https://www.bing.com/news/search?q=${query}`;
  }

  if (type === "research") {
    return `https://www.semanticscholar.org/search?q=${query}&sort=relevance`;
  }

  if (type === "entertainment") {
    return `https://www.bing.com/news/search?q=${query}`;
  }

  return `https://www.youtube.com/results?search_query=${query}%20official%20audio`;
}

function buildLinkLabel(type, existingUrl) {
  if (existingUrl) {
    if (type === "world") return "查看原文";
    if (type === "research") return "查看论文";
    if (type === "entertainment") return "查看新闻";
    return "听歌 / 视频";
  }

  if (type === "world") return "查看线索";
  if (type === "research") return "搜索论文";
  if (type === "entertainment") return "查看娱乐线索";
  return "搜索歌曲";
}

function renderAll() {
  STREAM_TYPES.forEach((type) => renderFeed(type));
  renderMetrics();
}

function renderFeed(type) {
  const container = elements[`${type}Feed`];
  const items = state[`${type}Items`];
  const meta = state.sourceMeta[type];
  const regionLabel =
    type === "world"
      ? "影响面"
      : type === "research"
        ? "落地方向"
        : type === "music"
          ? "热度线索"
          : "关注面";
  const signalClass =
    type === "world"
      ? "warning"
      : type === "research"
        ? "success"
        : type === "music"
          ? "music"
          : "entertainment";

  if (state.loading[type] && !items.length) {
    container.innerHTML = '<div class="empty-state">正在构建多源内容池...</div>';
    return;
  }

  if (!items.length) {
    container.innerHTML = '<div class="empty-state">当前没有内容，等待下一次推送。</div>';
    return;
  }

  container.innerHTML = `
    <div class="feed-status ${meta.mode === "live" ? "live" : "fallback"}">
      <span>${meta.mode === "live" ? "多源资源池在线" : "后备模式"}</span>
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
              <span class="tag ${signalClass}">${escapeHtml(signal)}</span>
              <span>${regionLabel}: ${escapeHtml(relevance || provider)}</span>
            </div>
            <div class="feed-footer">
              <span class="muted">${escapeHtml(provider)}</span>
              <a class="feed-link" href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${escapeHtml(linkLabel)}</a>
            </div>
          </article>
        `,
      )
      .join("")}
  `;
}

function renderMetrics() {
  elements.worldCount.textContent = String(state.sourceMeta.world.poolSize || state.pools.world.length);
  elements.researchCount.textContent = String(
    state.sourceMeta.research.poolSize || state.pools.research.length,
  );
  elements.musicCount.textContent = String(state.sourceMeta.music.poolSize || state.pools.music.length);
  elements.entertainmentCount.textContent = String(
    state.sourceMeta.entertainment.poolSize || state.pools.entertainment.length,
  );
  elements.worldNextRun.textContent = formatNextRunText(state.nextRuns.world, state.settings.worldEnabled);
  elements.researchNextRun.textContent = formatNextRunText(
    state.nextRuns.research,
    state.settings.researchEnabled,
  );
  elements.musicNextRun.textContent = formatNextRunText(state.nextRuns.music, state.settings.musicEnabled);
  elements.entertainmentNextRun.textContent = formatNextRunText(
    state.nextRuns.entertainment,
    state.settings.entertainmentEnabled,
  );

  const liveCount = STREAM_TYPES.map((type) => state.sourceMeta[type]).filter(
    (entry) => entry.mode === "live",
  ).length;
  elements.systemMode.textContent = liveCount === STREAM_TYPES.length ? "四流轮换" : "混合模式";
  elements.dataModeBadge.textContent =
    liveCount === STREAM_TYPES.length ? "4 STREAMS LIVE" : "MIXED SOURCES";
  elements.sourceSummary.textContent = [
    `热点: ${buildSourceLine(state.sourceMeta.world)}`,
    `研究: ${buildSourceLine(state.sourceMeta.research)}`,
    `音乐: ${buildSourceLine(state.sourceMeta.music)}`,
    `娱乐: ${buildSourceLine(state.sourceMeta.entertainment)}`,
  ].join(" | ");
}

function buildSourceLine(meta) {
  const provider = meta.provider || "未知来源";
  const fetched = meta.fetchedAt ? formatTime(new Date(meta.fetchedAt)) : "尚未拉取";
  const poolSize = meta.poolSize ? `${meta.poolSize} 条` : "0 条";
  const providers = Array.isArray(meta.providers) ? meta.providers.slice(0, 3).join(" / ") : provider;
  const error = meta.error ? ` · ${meta.error}` : "";
  return `${provider} · ${poolSize} · ${fetched} · ${providers}${error}`;
}

function handleSaveSettings() {
  state.settings = {
    worldEnabled: elements.worldToggle.checked,
    researchEnabled: elements.researchToggle.checked,
    musicEnabled: elements.musicToggle.checked,
    entertainmentEnabled: elements.entertainmentToggle.checked,
    worldInterval: clampMinutes(elements.worldInterval.value),
    researchInterval: clampMinutes(elements.researchInterval.value),
    musicInterval: clampMinutes(elements.musicInterval.value),
    entertainmentInterval: clampMinutes(elements.entertainmentInterval.value),
    keywords: elements.keywordInput.value.trim(),
  };
  syncControlsFromSettings();
  saveSettings();
  startSchedulers();
  void Promise.all(STREAM_TYPES.map((type) => refreshStream(type)));
  showToastCard("设置已保存", "新的关键词和轮询节奏已经开始生效。");
}

function pauseAllSchedules() {
  STREAM_TYPES.forEach((type) => {
    state.settings[`${type}Enabled`] = false;
    clearTimer(type);
    state.nextRuns[type] = null;
  });
  syncControlsFromSettings();
  saveSettings();
  renderMetrics();
  showToastCard("推送已暂停", "四个信息流都已停止自动更新。");
}

function startSchedulers() {
  STREAM_TYPES.forEach((type) => {
    clearTimer(type);
    if (state.settings[`${type}Enabled`]) {
      scheduleNextRun(type);
      state.timers[type] = window.setInterval(
        () => void refreshStream(type),
        minutesToMs(state.settings[`${type}Interval`]),
      );
    } else {
      state.nextRuns[type] = null;
    }
  });

  renderMetrics();
}

function clearTimer(type) {
  if (state.timers[type]) {
    window.clearInterval(state.timers[type]);
    state.timers[type] = null;
  }
}

function scheduleNextRun(type) {
  state.nextRuns[type] = new Date(Date.now() + minutesToMs(state.settings[`${type}Interval`]));
}

function updateButtonState(type) {
  const refreshButton = elements[`refresh${capitalize(type)}Btn`];
  const nextButton = elements[`next${capitalize(type)}Btn`];

  if (refreshButton) {
    refreshButton.disabled = state.loading[type];
    refreshButton.textContent = state.loading[type] ? "刷新中..." : "刷新源";
  }

  if (nextButton) {
    nextButton.disabled = state.loading[type] || !state.pools[type].length;
    nextButton.textContent = "换一批";
  }
}

function maybeNotify(type, item) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  new Notification(streamNotificationTitle(type), {
    body: `${item.title} | ${item.summary}`,
    tag: `xscnews-${type}`,
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
  const digest = buildDigest(
    state.worldItems,
    state.researchItems,
    state.musicItems,
    state.entertainmentItems,
    state.settings.keywords,
  );
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

function streamTitle(type) {
  if (type === "world") return "世界热点";
  if (type === "research") return "AI / NLP 前沿";
  if (type === "entertainment") return "娱乐新闻";
  return "近期热门歌曲";
}

function streamShortName(type) {
  if (type === "world") return "新闻池";
  if (type === "research") return "研究池";
  if (type === "entertainment") return "娱乐池";
  return "音乐池";
}

function streamNotificationTitle(type) {
  if (type === "world") return "全球热点更新";
  if (type === "research") return "AI / NLP 前沿更新";
  if (type === "entertainment") return "娱乐新闻更新";
  return "热门歌曲更新";
}

function defaultProvider(type) {
  if (type === "world") return "新闻源";
  if (type === "research") return "论文源";
  if (type === "entertainment") return "娱乐媒体";
  return "音乐榜单";
}

function defaultSignal(type) {
  if (type === "world") return "多源资讯";
  if (type === "research") return "实时更新";
  if (type === "entertainment") return "娱乐资讯";
  return "热歌榜单";
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
