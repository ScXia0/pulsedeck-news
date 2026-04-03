import {
  buildDigest,
  entertainmentHotTopics,
  musicHotTracks,
  researchHotTopics,
  worldHotTopics,
} from "./data.js";

const STORAGE_KEY = "pulse-deck-settings";
const DESK_STORAGE_KEY = "xscnews-desk-state";
const VIEW_STORAGE_KEY = "xscnews-view-state";
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
const DEFAULT_VIEW_STATE = {
  query: "",
  scope: "all",
  sortMode: "smart",
  activeTypes: {
    world: true,
    research: true,
    music: true,
    entertainment: true,
  },
};

function cloneDefaultViewState() {
  return {
    query: DEFAULT_VIEW_STATE.query,
    scope: DEFAULT_VIEW_STATE.scope,
    sortMode: DEFAULT_VIEW_STATE.sortMode,
    activeTypes: { ...DEFAULT_VIEW_STATE.activeTypes },
  };
}

const state = {
  settings: loadSettings(),
  desk: loadDeskState(),
  view: loadViewState(),
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
  clearDismissedBtn: document.querySelector("#clearDismissedBtn"),
  clearViewFiltersBtn: document.querySelector("#clearViewFiltersBtn"),
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
  globalSearchInput: document.querySelector("#globalSearchInput"),
  focusSummary: document.querySelector("#focusSummary"),
  focusResultHint: document.querySelector("#focusResultHint"),
  spotlightLead: document.querySelector("#spotlightLead"),
  spotlightRail: document.querySelector("#spotlightRail"),
  savedDeskList: document.querySelector("#savedDeskList"),
  laterDeskList: document.querySelector("#laterDeskList"),
  deskStats: document.querySelector("#deskStats"),
  savedCountBadge: document.querySelector("#savedCountBadge"),
  laterCountBadge: document.querySelector("#laterCountBadge"),
  worldPulse: document.querySelector("#worldPulse"),
  researchPulse: document.querySelector("#researchPulse"),
  musicPulse: document.querySelector("#musicPulse"),
  entertainmentPulse: document.querySelector("#entertainmentPulse"),
  backToTopBtn: document.querySelector("#backToTopBtn"),
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
  jumpLinks: document.querySelectorAll("[data-section]"),
  viewButtons: document.querySelectorAll("[data-view-action]"),
};

void initialize();

async function initialize() {
  syncControlsFromSettings();
  syncViewControls();
  seedFallbackFeeds();
  renderAll();
  bindEvents();
  bindScrollExperience();
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

function loadDeskState() {
  try {
    const raw = localStorage.getItem(DESK_STORAGE_KEY);
    if (!raw) {
      return {
        saved: {},
        later: {},
        dismissed: {},
      };
    }

    const parsed = JSON.parse(raw);
    return {
      saved: parsed.saved || {},
      later: parsed.later || {},
      dismissed: parsed.dismissed || {},
    };
  } catch {
    return {
      saved: {},
      later: {},
      dismissed: {},
    };
  }
}

function saveDeskState() {
  localStorage.setItem(DESK_STORAGE_KEY, JSON.stringify(state.desk));
}

function loadViewState() {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    if (!raw) return cloneDefaultViewState();
    const parsed = JSON.parse(raw);
    return {
      query: parsed.query || "",
      scope: parsed.scope || "all",
      sortMode: parsed.sortMode || "smart",
      activeTypes: {
        ...DEFAULT_VIEW_STATE.activeTypes,
        ...(parsed.activeTypes || {}),
      },
    };
  } catch {
    return cloneDefaultViewState();
  }
}

function saveViewState() {
  localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(state.view));
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

function syncViewControls() {
  if (elements.globalSearchInput) {
    elements.globalSearchInput.value = state.view.query;
  }

  elements.viewButtons.forEach((button) => {
    const action = button.dataset.viewAction;
    const value = button.dataset.value;
    let active = false;

    if (action === "toggle-type") {
      active = Boolean(state.view.activeTypes[value]);
    } else if (action === "set-scope") {
      active = state.view.scope === value;
    } else if (action === "set-sort") {
      active = state.view.sortMode === value;
    }

    button.classList.toggle("is-active", active);
  });
}

function bindEvents() {
  elements.notifyPermissionBtn.addEventListener("click", requestNotificationPermission);
  elements.manualDigestBtn.addEventListener("click", generateDigest);
  elements.saveSettingsBtn.addEventListener("click", handleSaveSettings);
  elements.pauseAllBtn.addEventListener("click", pauseAllSchedules);
  elements.clearDismissedBtn?.addEventListener("click", clearDismissedItems);
  elements.clearViewFiltersBtn?.addEventListener("click", clearViewFilters);
  elements.backToTopBtn?.addEventListener("click", scrollToTop);
  elements.globalSearchInput?.addEventListener("input", handleSearchInput);
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
  document.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (actionButton) {
      handleDeskAction(actionButton);
      return;
    }

    const viewButton = event.target.closest("[data-view-action]");
    if (viewButton) {
      handleViewAction(viewButton);
      return;
    }

    const link = event.target.closest("[data-section]");
    const sectionId = link?.dataset?.section;
    if (sectionId) {
      setActiveSection(sectionId);
    }
  });

  document.addEventListener("keydown", handleGlobalShortcuts);
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

  let candidates = pool.filter((item) => !state.seenIds[type].has(item.id) && !isDismissed(type, item.id));
  if (!candidates.length) {
    state.seenIds[type].clear();
    candidates = pool.filter((item) => !isDismissed(type, item.id));
  }

  const batch = (candidates.length ? candidates : pool).slice(0, state.batchSize[type] || DEFAULT_BATCH_SIZE);
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

function buildDeskKey(type, id) {
  return `${type}:${id}`;
}

function isDismissed(type, id) {
  return Boolean(state.desk.dismissed[buildDeskKey(type, id)]);
}

function serializeDeskItem(type, item) {
  return {
    id: item.id,
    type,
    title: item.title,
    summary: item.summary,
    url: item.url,
    provider: item.provider,
    linkLabel: item.linkLabel,
    region: item.region,
    relevance: item.relevance,
    timestamp: item.timestamp,
    savedAt: Date.now(),
  };
}

function toggleDeskShelf(shelf, type, item) {
  const key = buildDeskKey(type, item.id);
  if (state.desk[shelf][key]) {
    delete state.desk[shelf][key];
    saveDeskState();
    return false;
  }

  state.desk[shelf][key] = serializeDeskItem(type, item);
  saveDeskState();
  return true;
}

function dismissDeskItem(type, item) {
  const key = buildDeskKey(type, item.id);
  state.desk.dismissed[key] = {
    id: item.id,
    type,
    title: item.title,
    dismissedAt: Date.now(),
  };
  delete state.desk.saved[key];
  delete state.desk.later[key];
  saveDeskState();
}

function clearDismissedItems() {
  const count = Object.keys(state.desk.dismissed).length;
  state.desk.dismissed = {};
  saveDeskState();
  renderAll();
  showToastCard("隐藏内容已恢复", count ? `已恢复 ${count} 条内容。` : "当前没有被隐藏的内容。");
}

function handleDeskAction(button) {
  const action = button.dataset.action;
  const type = button.dataset.type;
  const itemId = button.dataset.itemId;
  if (!action || !type || !itemId) return;

  const item = findItem(type, itemId) || findDeskItem(type, itemId);
  if (!item) return;

  if (action === "save") {
    const active = toggleDeskShelf("saved", type, item);
    renderAll();
    showToastCard(active ? "已加入收藏" : "已取消收藏", item.title);
    return;
  }

  if (action === "later") {
    const active = toggleDeskShelf("later", type, item);
    renderAll();
    showToastCard(active ? "已加入稍后看" : "已取消稍后看", item.title);
    return;
  }

  if (action === "dismiss") {
    dismissDeskItem(type, item);
    renderAll();
    showToastCard("已隐藏该内容", "之后的换一批和精选会尽量避开它。");
    return;
  }

  if (action === "remove") {
    const shelf = button.dataset.shelf;
    const key = buildDeskKey(type, itemId);
    if (shelf && state.desk[shelf]?.[key]) {
      delete state.desk[shelf][key];
      saveDeskState();
      renderAll();
      showToastCard("已从情报桌移除", item.title);
    }
  }
}

function findItem(type, itemId) {
  return state.pools[type].find((item) => item.id === itemId) || state[`${type}Items`].find((item) => item.id === itemId);
}

function findDeskItem(type, itemId) {
  const key = buildDeskKey(type, itemId);
  return state.desk.saved[key] || state.desk.later[key] || null;
}

function getDeskEntries(shelf) {
  return Object.values(state.desk[shelf]).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

function handleSearchInput(event) {
  state.view.query = event.target.value.trim();
  saveViewState();
  renderAll();
}

function clearViewFilters() {
  state.view = cloneDefaultViewState();
  saveViewState();
  syncViewControls();
  renderAll();
  showToastCard("筛选已清空", "已经恢复默认视图。");
}

function handleViewAction(button) {
  const action = button.dataset.viewAction;
  const value = button.dataset.value;
  if (!action || !value) return;

  if (action === "toggle-type") {
    state.view.activeTypes[value] = !state.view.activeTypes[value];
    if (!Object.values(state.view.activeTypes).some(Boolean)) {
      state.view.activeTypes[value] = true;
      showToastCard("至少保留一个信息流", "不能把所有流都一起关掉。");
    }
  } else if (action === "set-scope") {
    state.view.scope = value;
  } else if (action === "set-sort") {
    state.view.sortMode = value;
  }

  saveViewState();
  syncViewControls();
  renderAll();
}

function handleGlobalShortcuts(event) {
  const target = event.target;
  const isTypingTarget =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target?.isContentEditable;

  if (isTypingTarget && document.activeElement !== elements.globalSearchInput) {
    return;
  }

  if (event.key === "/" && document.activeElement !== elements.globalSearchInput) {
    event.preventDefault();
    elements.globalSearchInput?.focus();
    elements.globalSearchInput?.select();
    return;
  }

  if (event.key === "Escape" && document.activeElement === elements.globalSearchInput) {
    elements.globalSearchInput.blur();
    if (state.view.query) {
      state.view.query = "";
      saveViewState();
      syncViewControls();
      renderAll();
    }
  }
}

function getScopedRankedItems(type) {
  const query = state.view.query.toLowerCase();
  const baseItems =
    state.view.scope === "saved"
      ? getDeskEntries("saved").filter((item) => item.type === type)
      : state.view.scope === "later"
        ? getDeskEntries("later").filter((item) => item.type === type)
        : state.pools[type].length
          ? state.pools[type]
          : state[`${type}Items`];

  return baseItems
    .filter((item) => matchesViewFilters(type, item, query))
    .sort((a, b) => compareItems(type, a, b));
}

function matchesViewFilters(type, item, query) {
  if (!state.view.activeTypes[type]) return false;
  if (isDismissed(type, item.id)) return false;

  if (state.view.scope === "saved" && !state.desk.saved[buildDeskKey(type, item.id)]) return false;
  if (state.view.scope === "later" && !state.desk.later[buildDeskKey(type, item.id)]) return false;

  if (!query) return true;

  const haystack = [item.title, item.summary, item.provider, item.region, item.relevance, item.signal]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function compareItems(type, first, second) {
  if (state.view.sortMode === "recent") {
    return parseItemTimestamp(second.timestamp) - parseItemTimestamp(first.timestamp);
  }

  return scoreItem(type, second) - scoreItem(type, first);
}

function scoreItem(type, item) {
  let score = type === "world" ? 18 : type === "research" ? 17 : type === "music" ? 15 : 16;
  const key = buildDeskKey(type, item.id);
  const focusTerms = state.settings.keywords
    .split(",")
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
  const text = [item.title, item.summary, item.provider, item.relevance, item.signal]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  focusTerms.forEach((term) => {
    if (text.includes(term)) score += 2.5;
  });

  if (state.view.query && text.includes(state.view.query.toLowerCase())) {
    score += 6;
  }

  if (state.desk.saved[key]) score += 8;
  if (state.desk.later[key]) score += 5;
  if ((item.signal || "").includes("后备")) score -= 2;

  return score;
}

function parseItemTimestamp(timestamp) {
  if (!timestamp) return 0;
  const match = String(timestamp).match(/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/);
  if (!match) return 0;
  const [, month, day, hour, minute] = match.map(Number);
  const year = new Date().getFullYear();
  return new Date(year, month - 1, day, hour, minute).getTime();
}

function renderAll() {
  STREAM_TYPES.forEach((type) => renderFeed(type));
  renderMetrics();
  renderPulseRail();
  renderSpotlight();
  renderDesk();
  renderFocusConsole();
}

function renderFeed(type) {
  const container = elements[`${type}Feed`];
  const defaultMode = isDefaultView();
  const items = defaultMode
    ? state[`${type}Items`].filter((item) => matchesViewFilters(type, item, state.view.query.toLowerCase()))
    : getScopedRankedItems(type).slice(0, state.batchSize[type] || DEFAULT_BATCH_SIZE);
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
  const itemClass = `feed-item feed-item-${type}`;
  const linkClass = `feed-link feed-link-${type}`;
  const regionTagClass = `tag stream-chip stream-chip-${type}`;

  if (state.loading[type] && !items.length) {
    container.innerHTML = '<div class="empty-state">正在构建多源内容池...</div>';
    renderPulseRail();
    return;
  }

  if (!items.length) {
    container.innerHTML = '<div class="empty-state">当前这一批内容都被隐藏或已空，点“换一批”试试。</div>';
    renderPulseRail();
    return;
  }

  container.innerHTML = `
    <div class="feed-status ${meta.mode === "live" ? "live" : "fallback"}">
      <span>${meta.mode === "live" ? "多源资源池在线" : "后备模式"}</span>
      <span>${escapeHtml(buildSourceLine(meta))}</span>
    </div>
    ${items
      .map(
        ({ title, summary, region, signal, relevance, timestamp, url, provider, linkLabel }, index) => {
          const item = items[index];
          const itemId = item?.id || "";
          const heat = buildHeatState(type, index, meta);
          const savedActive = Boolean(state.desk.saved[buildDeskKey(type, itemId)]);
          const laterActive = Boolean(state.desk.later[buildDeskKey(type, itemId)]);
          return `
          <article class="${itemClass}${index === 0 ? " featured" : ""}">
            <div class="feed-item-header">
              <div class="feed-item-headline">
                <span class="feed-priority">${index === 0 ? "TOP PICK" : "LIVE"}</span>
                <span class="${regionTagClass}">${escapeHtml(region)}</span>
                <span class="tag heat-tag ${escapeHtml(heat.tone)}">${escapeHtml(heat.label)}</span>
              </div>
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
              <a class="${linkClass}" href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${escapeHtml(linkLabel)}</a>
            </div>
            <div class="feed-actions">
              <button class="item-action ${savedActive ? "is-active" : ""}" type="button" data-action="save" data-type="${type}" data-item-id="${escapeAttribute(itemId)}">
                ${savedActive ? "已收藏" : "收藏"}
              </button>
              <button class="item-action ${laterActive ? "is-active" : ""}" type="button" data-action="later" data-type="${type}" data-item-id="${escapeAttribute(itemId)}">
                ${laterActive ? "已加入稍后看" : "稍后看"}
              </button>
              <button class="item-action item-action-muted" type="button" data-action="dismiss" data-type="${type}" data-item-id="${escapeAttribute(itemId)}">
                不感兴趣
              </button>
            </div>
          </article>
        `;
        },
      )
      .join("")}
  `;
  renderPulseRail();
  renderSpotlight();
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
  elements.sourceSummary.innerHTML = buildSourceSummaryMarkup();
  renderPulseRail();
  renderSpotlight();
  renderFocusConsole();
}

function buildSourceLine(meta) {
  const provider = meta.provider || "未知来源";
  const fetched = meta.fetchedAt ? formatTime(new Date(meta.fetchedAt)) : "尚未拉取";
  const poolSize = meta.poolSize ? `${meta.poolSize} 条` : "0 条";
  const providers = Array.isArray(meta.providers) ? meta.providers.slice(0, 3).join(" / ") : provider;
  const error = meta.error ? ` · ${meta.error}` : "";
  return `${provider} · ${poolSize} · ${fetched} · ${providers}${error}`;
}

function buildSourceSummaryMarkup() {
  return STREAM_TYPES.map((type) => {
    const meta = state.sourceMeta[type];
    const title =
      type === "world"
        ? "热点"
        : type === "research"
          ? "研究"
          : type === "music"
            ? "音乐"
            : "娱乐";
    const provider = meta.provider || "未知来源";
    const poolSize = meta.poolSize ? `${meta.poolSize} 条` : "0 条";
    const fetched = meta.fetchedAt ? formatTime(new Date(meta.fetchedAt)) : "未拉取";
    const providers = Array.isArray(meta.providers) ? meta.providers.slice(0, 2).join(" / ") : provider;
    const error = meta.error ? "暂时异常" : meta.mode === "live" ? "在线" : "后备";

    return `
      <div class="source-summary-item source-${type}">
        <div class="source-summary-top">
          <span class="source-summary-name">${escapeHtml(title)}</span>
          <span class="source-summary-state">${escapeHtml(error)}</span>
        </div>
        <div class="source-summary-meta">${escapeHtml(provider)} · ${escapeHtml(poolSize)} · ${escapeHtml(fetched)}</div>
        <div class="source-summary-sub">${escapeHtml(providers)}</div>
      </div>
    `;
  }).join("");
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
  elements.digestOutput.dataset.plaintext = digest;
  elements.digestOutput.innerHTML = buildDigestMarkup();
  elements.lastDigestTime.textContent = `最近摘要: ${formatTime(new Date())}`;
  showToastCard("今日摘要已生成", "当前简报已经根据最新信息流重组。");
}

function bindScrollExperience() {
  window.addEventListener("scroll", updateBackToTopButton, { passive: true });
  updateBackToTopButton();
  setActiveSection("section-focus");

  const sections = document.querySelectorAll("#section-focus, #section-spotlight, #section-desk, #section-world, #section-research, #section-music, #section-entertainment, #section-digest");
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visible?.target?.id) {
        setActiveSection(visible.target.id);
      }
    },
    {
      root: null,
      threshold: [0.25, 0.45, 0.7],
      rootMargin: "-14% 0px -55% 0px",
    },
  );

  sections.forEach((section) => observer.observe(section));
}

function updateBackToTopButton() {
  if (!elements.backToTopBtn) return;
  elements.backToTopBtn.classList.toggle("visible", window.scrollY > 520);
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
  setActiveSection("section-focus");
}

function setActiveSection(sectionId) {
  elements.jumpLinks.forEach((link) => {
    const isActive = link.dataset.section === sectionId;
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  });
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

function renderSpotlight() {
  const leadElement = elements.spotlightLead;
  const railElement = elements.spotlightRail;
  if (!leadElement || !railElement) return;

  const spotlightItems = buildSpotlightItems();
  const lead = spotlightItems[0];

  if (!lead) {
    leadElement.innerHTML = `
      <div class="spotlight-empty">
        <strong>主编精选准备中</strong>
        <p>正在等待内容流完成初始化，稍后这里会自动挑出今天最值得先看的内容。</p>
      </div>
    `;
    railElement.innerHTML = "";
    return;
  }

  const leadHeat = buildHeatState(lead.type, 0, state.sourceMeta[lead.type]);
  leadElement.innerHTML = `
    <div class="spotlight-lead-top">
      <span class="tag stream-chip stream-chip-${lead.type}">${escapeHtml(streamTitle(lead.type))}</span>
      <span class="tag heat-tag ${escapeHtml(leadHeat.tone)}">${escapeHtml(leadHeat.label)}</span>
    </div>
    <h3>${escapeHtml(lead.title)}</h3>
    <p>${escapeHtml(lead.summary)}</p>
    <div class="spotlight-lead-meta">
      <span>${escapeHtml(lead.provider)}</span>
      <span>${escapeHtml(lead.relevance || lead.region || "持续跟进中")}</span>
    </div>
    <div class="spotlight-lead-actions">
      <a class="feed-link feed-link-${lead.type}" href="${escapeAttribute(lead.url)}" target="_blank" rel="noreferrer">${escapeHtml(lead.linkLabel)}</a>
      <a class="secondary-button spotlight-jump-button" href="#section-${lead.type}" data-section="section-${lead.type}">跳到该板块</a>
    </div>
  `;

  railElement.innerHTML = spotlightItems
    .slice(1)
    .map((item) => {
      const heat = buildHeatState(item.type, item.order, state.sourceMeta[item.type]);
      return `
        <article class="spotlight-mini stream-${item.type}">
          <div class="spotlight-mini-top">
            <span class="tag stream-chip stream-chip-${item.type}">${escapeHtml(streamTitle(item.type))}</span>
            <span class="tag heat-tag ${escapeHtml(heat.tone)}">${escapeHtml(heat.label)}</span>
          </div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary)}</p>
          <div class="spotlight-mini-actions">
            <a href="#section-${item.type}" class="mini-link" data-section="section-${item.type}">进入板块</a>
            <a href="${escapeAttribute(item.url)}" class="mini-link" target="_blank" rel="noreferrer">${escapeHtml(item.linkLabel)}</a>
          </div>
        </article>
      `;
    })
    .join("");
}

function buildSpotlightItems() {
  return STREAM_TYPES.map((type) => {
    const item = getScopedRankedItems(type)[0];
    if (!item) return null;
    const meta = state.sourceMeta[type];
    return {
      ...item,
      type,
      score: spotlightScore(type, item, meta),
      mode: meta.mode,
    };
  })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .map((item, index) => ({ ...item, order: index }));
}

function renderDesk() {
  const query = state.view.query.toLowerCase();
  const savedEntries = getDeskEntries("saved").filter((item) => matchesDeskQuery(item, query));
  const laterEntries = getDeskEntries("later").filter((item) => matchesDeskQuery(item, query));
  const dismissedCount = Object.keys(state.desk.dismissed).length;

  elements.savedCountBadge.textContent = String(savedEntries.length);
  elements.laterCountBadge.textContent = String(laterEntries.length);

  elements.savedDeskList.innerHTML = savedEntries.length
    ? savedEntries.slice(0, 5).map((item) => buildDeskItemMarkup(item, "saved")).join("")
    : '<div class="desk-empty">还没有收藏内容。看到喜欢的条目时，点一下“收藏”就会收进这里。</div>';

  elements.laterDeskList.innerHTML = laterEntries.length
    ? laterEntries.slice(0, 5).map((item) => buildDeskItemMarkup(item, "later")).join("")
    : '<div class="desk-empty">还没有稍后看内容。想晚点再读的资讯，可以先放到这里。</div>';

  elements.deskStats.innerHTML = `
    <div class="desk-stat">
      <strong>${savedEntries.length}</strong>
      <span>已收藏</span>
    </div>
    <div class="desk-stat">
      <strong>${laterEntries.length}</strong>
      <span>稍后看</span>
    </div>
    <div class="desk-stat">
      <strong>${dismissedCount}</strong>
      <span>已隐藏</span>
    </div>
  `;

  elements.clearDismissedBtn.disabled = dismissedCount === 0;
}

function buildDeskItemMarkup(item, shelf) {
  return `
    <article class="desk-item">
      <div class="desk-item-top">
        <span class="tag stream-chip stream-chip-${item.type}">${escapeHtml(streamTitle(item.type))}</span>
        <span class="muted">${escapeHtml(item.timestamp || "刚刚")}</span>
      </div>
      <h4>${escapeHtml(item.title)}</h4>
      <p>${escapeHtml(item.summary || "暂无摘要。")}</p>
      <div class="desk-item-actions">
        <a href="#section-${item.type}" class="mini-link" data-section="section-${item.type}">进入板块</a>
        <a href="${escapeAttribute(item.url)}" class="mini-link" target="_blank" rel="noreferrer">${escapeHtml(item.linkLabel || "查看内容")}</a>
        <button class="mini-link-button" type="button" data-action="remove" data-shelf="${shelf}" data-type="${item.type}" data-item-id="${escapeAttribute(item.id)}">移除</button>
      </div>
    </article>
  `;
}

function spotlightScore(type, item, meta) {
  const base = type === "world" ? 14 : type === "research" ? 13 : type === "entertainment" ? 12 : 11;
  const liveBonus = meta.mode === "live" ? 6 : 0;
  const titleBonus = Math.min((item.title || "").length / 24, 4);
  const signalBonus = (item.signal || "").includes("后备") ? 0 : 2;
  return base + liveBonus + titleBonus + signalBonus;
}

function renderPulseRail() {
  STREAM_TYPES.forEach((type) => {
    const element = elements[`${type}Pulse`];
    if (!element) return;
    const lead = getScopedRankedItems(type)[0];
    const meta = state.sourceMeta[type];
    const count = state.pools[type].length || state.sourceMeta[type].poolSize || 0;

    element.innerHTML = `
      <div class="signal-topline">
        <span class="signal-label">${escapeHtml(streamPulseLabel(type))}</span>
        <span class="signal-mode ${meta.mode === "live" ? "live" : "fallback"}">${meta.mode === "live" ? "LIVE" : "FALLBACK"}</span>
      </div>
      <h3>${escapeHtml(lead?.title || `${streamTitle(type)}正在准备中`)}</h3>
      <p>${escapeHtml(lead?.summary || "正在连接该流的实时数据与后备资源池。")}</p>
      <div class="signal-footer">
        <span>${escapeHtml(meta.provider || defaultProvider(type))}</span>
        <span>${count} 条池内内容</span>
      </div>
    `;
  });
}

function buildDigestMarkup() {
  return `
    <div class="digest-shell">
      <div class="digest-summary-head">
        <span class="digest-mark">Briefing</span>
        <strong>今日情报简报</strong>
        <span class="muted">关键词: ${escapeHtml(state.settings.keywords || "未设置")}</span>
      </div>
      <div class="digest-grid">
        ${buildDigestCard("world", state.worldItems, "影响面")}
        ${buildDigestCard("research", state.researchItems, "落地方向")}
        ${buildDigestCard("music", state.musicItems, "热度线索")}
        ${buildDigestCard("entertainment", state.entertainmentItems, "关注面")}
      </div>
    </div>
  `;
}

function renderFocusConsole() {
  if (!elements.focusSummary || !elements.focusResultHint) return;
  const activeStreams = STREAM_TYPES.filter((type) => state.view.activeTypes[type]).length;
  const totalResults = STREAM_TYPES.reduce((sum, type) => sum + getScopedRankedItems(type).length, 0);
  const scopeLabel =
    state.view.scope === "saved"
      ? "收藏内容"
      : state.view.scope === "later"
        ? "稍后看"
        : "全部内容";
  const sortLabel = state.view.sortMode === "recent" ? "最新优先" : "智能排序";

  elements.focusSummary.textContent = `${totalResults} RESULTS`;
  elements.focusResultHint.textContent = [
    `当前范围: ${scopeLabel}`,
    `开启流: ${activeStreams} 个`,
    `排序: ${sortLabel}`,
    state.view.query ? `搜索: ${state.view.query}` : "搜索: 未输入",
  ].join(" · ");
}

function matchesDeskQuery(item, query) {
  if (!query) return true;
  const text = [item.title, item.summary, item.provider, item.relevance, item.region]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return text.includes(query);
}

function isDefaultView() {
  return (
    !state.view.query &&
    state.view.scope === "all" &&
    state.view.sortMode === "smart" &&
    STREAM_TYPES.every((type) => state.view.activeTypes[type])
  );
}

function buildDigestCard(type, items, insightLabel) {
  const visibleItems = items.filter((item) => !isDismissed(type, item.id));
  const lead = visibleItems[0];
  const follow = visibleItems[1];
  const meta = state.sourceMeta[type];

  return `
    <article class="digest-card stream-${type}">
      <div class="digest-card-top">
        <span class="tag stream-chip stream-chip-${type}">${escapeHtml(streamTitle(type))}</span>
        <span class="muted">${escapeHtml(meta.mode === "live" ? "实时源在线" : "后备模式")}</span>
      </div>
      <h3>${escapeHtml(lead?.title || "暂无重点内容")}</h3>
      <p>${escapeHtml(lead?.summary || "等待下一次内容轮换。")}</p>
      <div class="digest-card-meta">
        <span>${escapeHtml(insightLabel)}: ${escapeHtml(lead?.relevance || lead?.provider || "待补充")}</span>
        <span>${escapeHtml(follow?.title || "暂无补充线索")}</span>
      </div>
    </article>
  `;
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

function streamPulseLabel(type) {
  if (type === "world") return "Global Pulse";
  if (type === "research") return "Research Pulse";
  if (type === "entertainment") return "Entertainment Pulse";
  return "Music Pulse";
}

function buildHeatState(type, index, meta) {
  if (index === 0 && meta.mode === "live") {
    if (type === "world") return { label: "Breaking", tone: "heat-hot" };
    if (type === "research") return { label: "Hot Paper", tone: "heat-hot" };
    if (type === "music") return { label: "Top Chart", tone: "heat-hot" };
    return { label: "Buzzing", tone: "heat-hot" };
  }

  if (index <= 1) {
    if (type === "music") return { label: "Rising", tone: "heat-rising" };
    return { label: "Trending", tone: "heat-rising" };
  }

  return { label: "Watchlist", tone: "heat-watch" };
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
