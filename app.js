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
const PROFILE_STORAGE_KEY = "xscnews-profile-state";
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
  subscribedTopics: ["OpenAI", "Agents", "Startups"],
  digestMode: "morning",
};
const DEFAULT_BATCH_SIZE = 6;
const STREAM_TYPES = ["world", "research", "music", "entertainment"];
const PERSONALIZATION_STOP_WORDS = new Set([
  "about",
  "after",
  "agent",
  "analysis",
  "breaking",
  "briefing",
  "from",
  "global",
  "have",
  "latest",
  "more",
  "music",
  "news",
  "official",
  "paper",
  "research",
  "stream",
  "their",
  "today",
  "trend",
  "watch",
  "with",
  "world",
]);
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
  profile: loadProfileState(),
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
  topicInput: document.querySelector("#topicInput"),
  addTopicBtn: document.querySelector("#addTopicBtn"),
  topicChips: document.querySelector("#topicChips"),
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
  digestModeButtons: document.querySelectorAll("[data-digest-mode]"),
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

function loadProfileState() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      return {
        streamWeights: createDefaultStreamWeights(),
        termWeights: {},
        termLabels: {},
        opened: {},
        lastInteractedType: null,
      };
    }

    const parsed = JSON.parse(raw);
    return {
      streamWeights: {
        ...createDefaultStreamWeights(),
        ...(parsed.streamWeights || {}),
      },
      termWeights: parsed.termWeights || {},
      termLabels: parsed.termLabels || {},
      opened: parsed.opened || {},
      lastInteractedType: parsed.lastInteractedType || null,
    };
  } catch {
    return {
      streamWeights: createDefaultStreamWeights(),
      termWeights: {},
      termLabels: {},
      opened: {},
      lastInteractedType: null,
    };
  }
}

function saveProfileState() {
  pruneProfileState();
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(state.profile));
}

function createDefaultStreamWeights() {
  return {
    world: 0,
    research: 0,
    music: 0,
    entertainment: 0,
  };
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
  renderTopicChips();
  syncDigestModeControls();
}

function renderTopicChips() {
  if (!elements.topicChips) return;
  const topics = getSubscribedTopics();
  elements.topicChips.innerHTML = topics.length
    ? topics
        .map(
          (topic) => `
            <button class="topic-chip" type="button" data-topic-action="remove" data-topic="${escapeAttribute(topic)}">
              <span>${escapeHtml(topic)}</span>
              <span class="topic-chip-remove">×</span>
            </button>
          `,
        )
        .join("")
    : '<div class="topic-chip-empty">还没有订阅主题。加几个你真正关心的话题，首页会更像你的私人情报台。</div>';
}

function syncDigestModeControls() {
  elements.digestModeButtons?.forEach((button) => {
    const active = button.dataset.digestMode === normalizeDigestMode(state.settings.digestMode);
    button.classList.toggle("is-active", active);
  });
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
  elements.addTopicBtn?.addEventListener("click", handleAddTopic);
  elements.topicInput?.addEventListener("keydown", handleTopicInputKeydown);
  elements.digestModeButtons?.forEach((button) => {
    button.addEventListener("click", handleDigestModeToggle);
  });
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

    const topicButton = event.target.closest("[data-topic-action]");
    if (topicButton) {
      handleTopicChipAction(topicButton);
      return;
    }

    const trackedLink = event.target.closest("[data-track-link]");
    if (trackedLink) {
      trackItemVisit(trackedLink);
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
    artist: item.artist || "",
    artwork: item.artwork || "",
    image: item.image || "",
  }));
}

async function refreshStream(type, { manual = false } = {}) {
  if (state.loading[type]) return;

  state.loading[type] = true;
  updateButtonState(type);
  renderFeed(type);

  const endpoint = `/api/${type}?keywords=${encodeURIComponent(getFocusKeywordString())}${
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
    artist: item.artist || "",
    artwork: item.artwork || "",
    image: item.image || "",
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
  recordInterest(type, item, { weight: shelf === "saved" ? 5 : 3.5 });
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
  reduceInterest(type, item, 2.5);
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

function trackItemVisit(link) {
  const type = link.dataset.type;
  const itemId = link.dataset.itemId;
  if (!type || !itemId) return;

  const item = findItem(type, itemId) || findDeskItem(type, itemId);
  if (!item) return;

  recordInterest(type, item, { weight: 2.8 });
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
  const focusTerms = getFocusTerms().map((term) => term.toLowerCase());
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
  score += getProfileAffinity(type, item).score;

  return score;
}

function getProfileAffinity(type, item) {
  const profileSignals = buildProfileSignals(item);
  const streamScore = Math.min((state.profile.streamWeights[type] || 0) * 0.4, 6);
  const matchedSignals = profileSignals
    .map((signal) => ({
      ...signal,
      weight: state.profile.termWeights[signal.key] || 0,
    }))
    .filter((signal) => signal.weight > 0.4)
    .sort((first, second) => second.weight - first.weight);
  const tokenScore = Math.min(
    matchedSignals.slice(0, 3).reduce((sum, signal) => sum + signal.weight, 0) * 0.9,
    10,
  );
  const repeatScore = Math.min((state.profile.opened[buildDeskKey(type, item.id)] || 0) * 1.4, 4);
  const recentStreamBonus = state.profile.lastInteractedType === type ? 1.6 : 0;

  return {
    score: streamScore + tokenScore + repeatScore + recentStreamBonus,
    matchedSignals,
  };
}

function buildProfileSignals(item) {
  const signals = [];
  const seen = new Set();
  const fields = [item.provider, item.region, item.relevance, item.signal];

  fields
    .filter(Boolean)
    .forEach((value) => {
      const label = String(value).trim();
      const key = normalizeSignalKey(label);
      if (!key || seen.has(key)) return;
      seen.add(key);
      signals.push({ key, label });
    });

  const sourceText = [item.title, item.summary]
    .filter(Boolean)
    .join(" ");
  const matches = sourceText.match(/[A-Za-z][A-Za-z0-9+/.-]{2,}/g) || [];
  matches.slice(0, 10).forEach((token) => {
    const label = token.trim();
    const key = normalizeSignalKey(label);
    if (!key || seen.has(key) || PERSONALIZATION_STOP_WORDS.has(key)) return;
    seen.add(key);
    signals.push({ key, label });
  });

  return signals;
}

function normalizeSignalKey(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ").slice(0, 64);
}

function recordInterest(type, item, { weight = 1 } = {}) {
  state.profile.streamWeights[type] = (state.profile.streamWeights[type] || 0) + weight;
  state.profile.lastInteractedType = type;
  const itemKey = buildDeskKey(type, item.id);
  state.profile.opened[itemKey] = (state.profile.opened[itemKey] || 0) + 1;

  buildProfileSignals(item).forEach((signal, index) => {
    const delta = Math.max(weight - index * 0.18, 0.35);
    state.profile.termWeights[signal.key] = (state.profile.termWeights[signal.key] || 0) + delta;
    state.profile.termLabels[signal.key] = signal.label;
  });

  saveProfileState();
}

function reduceInterest(type, item, weight = 1) {
  state.profile.streamWeights[type] = Math.max((state.profile.streamWeights[type] || 0) - weight, 0);
  buildProfileSignals(item).forEach((signal) => {
    if (!state.profile.termWeights[signal.key]) return;
    state.profile.termWeights[signal.key] = Math.max(state.profile.termWeights[signal.key] - weight, 0);
  });
  saveProfileState();
}

function pruneProfileState() {
  const topTerms = Object.entries(state.profile.termWeights)
    .filter(([, value]) => value > 0.2)
    .sort((first, second) => second[1] - first[1])
    .slice(0, 140);
  state.profile.termWeights = Object.fromEntries(topTerms);
  state.profile.termLabels = Object.fromEntries(
    topTerms.map(([key]) => [key, state.profile.termLabels[key] || key]),
  );
  const topOpened = Object.entries(state.profile.opened)
    .sort((first, second) => second[1] - first[1])
    .slice(0, 160);
  state.profile.opened = Object.fromEntries(topOpened);
}

function buildRecommendationReason(type, item) {
  const reasons = [];
  const key = buildDeskKey(type, item.id);
  const keywordTerms = getManualKeywords();
  const subscribedTopics = getSubscribedTopics();
  const text = [item.title, item.summary, item.provider, item.region, item.relevance]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (state.desk.saved[key]) reasons.push("已加入你的收藏夹");
  if (state.desk.later[key]) reasons.push("已进入稍后看");
  if (state.profile.streamWeights[type] > 10) reasons.push(`你最近偏爱${streamTitle(type)}`);

  const keywordHit = keywordTerms.find((term) => text.includes(term.toLowerCase()));
  if (keywordHit) {
    reasons.push(`命中关键词 ${keywordHit}`);
  }

  const topicHit = subscribedTopics.find((term) => text.includes(term.toLowerCase()));
  if (!keywordHit && topicHit) {
    reasons.push(`贴近你订阅的 ${topicHit}`);
  }

  const affinity = getProfileAffinity(type, item);
  if (!keywordHit && !topicHit && affinity.matchedSignals.length && affinity.matchedSignals[0].weight >= 2.4) {
    reasons.push(
      `和你常看的 ${affinity.matchedSignals
        .slice(0, 2)
        .map((signal) => signal.label)
        .join(" / ")} 接近`,
    );
  }

  return reasons[0] || "";
}

function buildCoverLabel(type) {
  if (type === "world") return "Global Dispatch";
  if (type === "research") return "Lab Notes";
  if (type === "music") return "Now Spinning";
  return "Culture Watch";
}

function buildCoverCaption(type, item) {
  if (type === "research") return item.relevance || item.region || item.provider;
  if (type === "music") return item.artist || item.relevance || item.provider || item.region;
  return item.provider || item.region || item.relevance;
}

function buildCoverToken(type, item) {
  const raw = type === "music" ? item.title : item.region || item.relevance || item.provider;
  return String(raw || streamTitle(type))
    .replace(/[^\p{L}\p{N}\s/+.-]/gu, "")
    .trim()
    .slice(0, 30);
}

function buildMusicArtworkUrl(item) {
  if (item.artwork) return item.artwork;
  const title = encodeURIComponent(item.title || "");
  const artist = encodeURIComponent(item.artist || item.relevance || "");
  return `/api/music-art?title=${title}&artist=${artist}`;
}

function buildFeedCoverMarkup(type, item, index) {
  const recommendation = buildRecommendationReason(type, item);
  const coverToken = buildCoverToken(type, item);
  const coverCaption = buildCoverCaption(type, item);
  const artworkMarkup =
    type === "music"
      ? `
      <img
        class="feed-cover-art"
        src="${escapeAttribute(buildMusicArtworkUrl(item))}"
        alt="${escapeAttribute(`${item.title} cover`)}"
        loading="lazy"
        referrerpolicy="no-referrer"
      />
      <div class="feed-cover-art-overlay"></div>
    `
      : "";
  if (type === "music") {
    return `
    <div class="feed-cover feed-cover-music-card feed-cover-${type}${index === 0 ? " is-featured" : ""} has-artwork">
      ${artworkMarkup}
      <div class="feed-cover-copy">
        <div class="feed-cover-top">
          <span class="feed-cover-label">${escapeHtml(buildCoverLabel(type))}</span>
          <span class="feed-cover-provider">${escapeHtml(item.provider || streamTitle(type))}</span>
        </div>
        <strong>${escapeHtml(coverToken || streamTitle(type))}</strong>
        <div class="feed-cover-caption">${escapeHtml(coverCaption || recommendation || streamTitle(type))}</div>
        <div class="feed-cover-meta-line">${escapeHtml(item.region || "Trending")} · ${escapeHtml(item.signal || "Hot track")}</div>
      </div>
    </div>
  `;
  }

  if (type === "entertainment") {
    const imageMarkup = `
      <img
        class="feed-cover-art"
        src="${escapeAttribute(buildEntertainmentImageUrl(item))}"
        alt="${escapeAttribute(`${item.title} poster`)}"
        loading="lazy"
        referrerpolicy="no-referrer"
      />
      <div class="feed-cover-art-overlay"></div>
    `;
    return `
    <div class="feed-cover feed-cover-entertainment-card feed-cover-${type}${index === 0 ? " is-featured" : ""} has-artwork">
      ${imageMarkup}
      <div class="feed-cover-copy">
        <div class="feed-cover-top">
          <span class="feed-cover-label">${escapeHtml(buildCoverLabel(type))}</span>
          <span class="feed-cover-provider">${escapeHtml(item.provider || streamTitle(type))}</span>
        </div>
        <strong>${escapeHtml(item.title || streamTitle(type))}</strong>
        <div class="feed-cover-caption">${escapeHtml(item.region || item.relevance || recommendation || streamTitle(type))}</div>
        <div class="feed-cover-meta-line">${escapeHtml(item.signal || "Entertainment Watch")}</div>
      </div>
    </div>
  `;
  }

  return `
    <div class="feed-cover feed-cover-${type}${index === 0 ? " is-featured" : ""}">
      <div class="feed-cover-top">
        <span class="feed-cover-label">${escapeHtml(buildCoverLabel(type))}</span>
        <span class="feed-cover-provider">${escapeHtml(item.provider || streamTitle(type))}</span>
      </div>
      <strong>${escapeHtml(coverToken || streamTitle(type))}</strong>
      <div class="feed-cover-caption">${escapeHtml(coverCaption || recommendation)}</div>
    </div>
  `;
}

function buildEntertainmentImageUrl(item) {
  if (item.image) return item.image;
  return buildEntertainmentPosterDataUrl(item.title || streamTitle("entertainment"), item.region || item.relevance || "Buzz");
}

function buildEntertainmentPosterDataUrl(title, accent) {
  const safeTitle = String(title || "Entertainment").trim().slice(0, 32);
  const safeAccent = String(accent || "Buzz").trim().slice(0, 20);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320" role="img" aria-label="${safeTitle}">
      <defs>
        <linearGradient id="entbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ff7eb6"/>
          <stop offset="100%" stop-color="#ffb067"/>
        </linearGradient>
      </defs>
      <rect width="480" height="320" rx="36" fill="#170a1f"/>
      <rect x="18" y="18" width="444" height="284" rx="28" fill="url(#entbg)"/>
      <circle cx="356" cy="110" r="92" fill="#ffffff" fill-opacity="0.12"/>
      <rect x="54" y="64" width="170" height="206" rx="24" fill="#0d1328" fill-opacity="0.88"/>
      <circle cx="139" cy="126" r="42" fill="#f6fbff" fill-opacity="0.92"/>
      <path d="M102 196c12-21 31-32 57-32 26 0 45 11 57 32" stroke="#f6fbff" stroke-width="16" stroke-linecap="round" fill="none"/>
      <text x="262" y="108" fill="#fff9fd" font-family="Avenir Next, PingFang SC, sans-serif" font-size="22" letter-spacing="4">ENTERTAINMENT</text>
      <text x="262" y="165" fill="#fff9fd" font-family="Avenir Next, PingFang SC, sans-serif" font-size="34" font-weight="700">${escapeSvgText(safeTitle)}</text>
      <text x="262" y="207" fill="#fff9fd" fill-opacity="0.8" font-family="Avenir Next, PingFang SC, sans-serif" font-size="20">${escapeSvgText(safeAccent)}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeSvgText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEntertainmentBodyMarkup(item) {
  return `
    <div class="entertainment-body-copy">
      <div class="entertainment-body-kicker">${escapeHtml(item.region || "Entertainment")}</div>
      <p>${escapeHtml(item.summary)}</p>
      <div class="entertainment-body-notes">
        <span>焦点: ${escapeHtml(item.relevance || item.provider || "持续发酵")}</span>
        <span>来源: ${escapeHtml(item.provider || "Entertainment Desk")}</span>
      </div>
    </div>
  `;
}

function buildMusicBodyMarkup(item) {
  return `
    <div class="music-body-copy">
      <div class="music-body-topline">
        <span class="music-artist-name">${escapeHtml(item.artist || item.relevance || "Unknown Artist")}</span>
        <span class="music-track-state">${escapeHtml(item.signal || "Hot track")}</span>
      </div>
      <p>${escapeHtml(item.summary)}</p>
    </div>
  `;
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
  const reasonEntries = items.map((item, index) => {
    const reason = buildRecommendationReason(type, item);
    return { id: item.id, index, reason };
  });
  const reasonCounts = new Map();
  reasonEntries.forEach(({ reason }) => {
    if (!reason) return;
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
  });
  const visibleReasons = new Map(
    reasonEntries.map(({ id, index, reason }) => {
      if (!reason) return [id, ""];
      const itemKey = buildDeskKey(type, id);
      const isExplicit =
        Boolean(state.desk.saved[itemKey]) ||
        Boolean(state.desk.later[itemKey]) ||
        reason.includes("关键词") ||
        reason.includes("收藏夹") ||
        reason.includes("稍后看");
      if (!isExplicit && (reasonCounts.get(reason) || 0) > 1 && index > 0) {
        return [id, ""];
      }
      return [id, reason];
    }),
  );

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
          const recommendation = visibleReasons.get(itemId) || "";
          const bodyMarkup =
            type === "music"
              ? buildMusicBodyMarkup(item)
              : type === "entertainment"
                ? buildEntertainmentBodyMarkup(item)
              : `<h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(summary)}</p>`;
          return `
          <article class="${itemClass}${index === 0 ? " featured" : ""}">
            ${buildFeedCoverMarkup(type, item, index)}
            <div class="feed-item-header">
              <div class="feed-item-headline">
                <span class="feed-priority">${index === 0 ? "TOP PICK" : "LIVE"}</span>
                <span class="${regionTagClass}">${escapeHtml(region)}</span>
                <span class="tag heat-tag ${escapeHtml(heat.tone)}">${escapeHtml(heat.label)}</span>
              </div>
              <span class="muted">${escapeHtml(timestamp)}</span>
            </div>
            ${bodyMarkup}
            <div class="feed-meta">
              <span class="tag ${signalClass}">${escapeHtml(signal)}</span>
              <span>${regionLabel}: ${escapeHtml(relevance || provider)}</span>
            </div>
            ${
              recommendation
                ? `<div class="feed-reason">
              <span class="feed-reason-label">推荐理由</span>
              <span class="feed-reason-text">${escapeHtml(recommendation)}</span>
            </div>`
                : ""
            }
            <div class="feed-footer">
              <span class="muted">${escapeHtml(provider)}</span>
              <a class="${linkClass}" href="${escapeAttribute(url)}" target="_blank" rel="noreferrer" data-track-link="1" data-type="${type}" data-item-id="${escapeAttribute(itemId)}">${escapeHtml(linkLabel)}</a>
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
    ...state.settings,
    worldEnabled: elements.worldToggle.checked,
    researchEnabled: elements.researchToggle.checked,
    musicEnabled: elements.musicToggle.checked,
    entertainmentEnabled: elements.entertainmentToggle.checked,
    worldInterval: clampMinutes(elements.worldInterval.value),
    researchInterval: clampMinutes(elements.researchInterval.value),
    musicInterval: clampMinutes(elements.musicInterval.value),
    entertainmentInterval: clampMinutes(elements.entertainmentInterval.value),
    keywords: elements.keywordInput.value.trim(),
    subscribedTopics: getSubscribedTopics(),
    digestMode: normalizeDigestMode(state.settings.digestMode),
  };
  syncControlsFromSettings();
  saveSettings();
  startSchedulers();
  void Promise.all(STREAM_TYPES.map((type) => refreshStream(type)));
  maybeRefreshDigest({ silent: true });
  showToastCard("设置已保存", "关键词、订阅主题和摘要模式已经开始生效。");
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

function generateDigest({ silent = false } = {}) {
  const digestMode = normalizeDigestMode(state.settings.digestMode);
  const digest = buildDigest(
    state.worldItems,
    state.researchItems,
    state.musicItems,
    state.entertainmentItems,
    {
      keywords: state.settings.keywords,
      subscribedTopics: getSubscribedTopics(),
      digestMode,
    },
  );
  elements.digestOutput.dataset.plaintext = digest;
  elements.digestOutput.innerHTML = buildDigestMarkup();
  elements.lastDigestTime.textContent = `最近摘要: ${formatTime(new Date())}`;
  if (!silent) {
    showToastCard(
      digestMode === "evening" ? "晚报已生成" : "晨报已生成",
      digestMode === "evening"
        ? "当前内容流已经整理成一版适合回看和复盘的晚间摘要。"
        : "当前内容流已经整理成一版适合快速扫读的晨间摘要。",
    );
  }
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
  const digestMode = normalizeDigestMode(state.settings.digestMode);
  const modeConfig = getDigestModeConfig(digestMode);
  const liveCount = STREAM_TYPES.filter((type) => state.sourceMeta[type].mode === "live").length;
  const topInterestTerms = Object.entries(state.profile.termWeights)
    .sort((first, second) => second[1] - first[1])
    .slice(0, 3)
    .map(([key]) => state.profile.termLabels[key] || key);
  const subscribedTopics = getSubscribedTopics();
  const spotlight = buildSpotlightItems()[0];

  return `
    <div class="digest-shell digest-shell-${digestMode}">
      <div class="digest-summary-head">
        <span class="digest-mark digest-mark-${digestMode}">${escapeHtml(modeConfig.mark)}</span>
        <strong>${escapeHtml(modeConfig.title)}</strong>
        <span class="muted">关键词池: ${escapeHtml(getFocusKeywordString() || "未设置")}</span>
      </div>
      <div class="digest-hero">
        <div class="digest-hero-copy">
          <span class="digest-hero-kicker">${escapeHtml(modeConfig.kicker)}</span>
          <h3>${escapeHtml(spotlight?.title || modeConfig.fallbackTitle)}</h3>
          <p>${escapeHtml(
            spotlight?.summary ||
              modeConfig.fallbackSummary,
          )}</p>
        </div>
        <div class="digest-stat-grid">
          <div class="digest-statline">
            <span>${escapeHtml(modeConfig.streamLabel)}</span>
            <strong>${liveCount} / ${STREAM_TYPES.length}</strong>
          </div>
          <div class="digest-statline">
            <span>订阅主题</span>
            <strong>${escapeHtml(formatTopicSummary(subscribedTopics, 4) || "还没有设置")}</strong>
          </div>
          <div class="digest-statline">
            <span>${escapeHtml(modeConfig.interestLabel)}</span>
            <strong>${escapeHtml(topInterestTerms.join(" / ") || "正在学习中")}</strong>
          </div>
          <div class="digest-statline">
            <span>${escapeHtml(modeConfig.sortLabel)}</span>
            <strong>${escapeHtml(state.view.sortMode === "recent" ? "最新优先" : "智能推荐")}</strong>
          </div>
        </div>
      </div>
      <div class="digest-grid">
        ${buildDigestCard("world", state.worldItems, "影响面", modeConfig)}
        ${buildDigestCard("research", state.researchItems, "落地方向", modeConfig)}
        ${buildDigestCard("music", state.musicItems, "热度线索", modeConfig)}
        ${buildDigestCard("entertainment", state.entertainmentItems, "关注面", modeConfig)}
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
  const topics = getSubscribedTopics();

  elements.focusSummary.textContent = `${totalResults} RESULTS`;
  elements.focusResultHint.textContent = [
    `当前范围: ${scopeLabel}`,
    `开启流: ${activeStreams} 个`,
    `排序: ${sortLabel}`,
    `订阅主题: ${topics.length ? formatTopicSummary(topics, 3) : "未设置"}`,
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

function buildDigestCard(type, items, insightLabel, modeConfig) {
  const visibleItems = items.filter((item) => !isDismissed(type, item.id));
  const lead = visibleItems[0];
  const follow = visibleItems[1];
  const meta = state.sourceMeta[type];
  const leadReason = lead ? buildRecommendationReason(type, lead) || "当前流里的高关注条目" : "等待下一次轮换";
  const followReason = follow ? buildRecommendationReason(type, follow) || "继续观察这一流的后续线索" : "暂无补充内容";

  return `
    <article class="digest-card stream-${type}">
      <div class="digest-card-top">
        <span class="tag stream-chip stream-chip-${type}">${escapeHtml(streamTitle(type))}</span>
        <span class="muted">${escapeHtml(meta.mode === "live" ? "实时源在线" : "后备模式")}</span>
      </div>
      <h3>${escapeHtml(lead?.title || "暂无重点内容")}</h3>
      <p>${escapeHtml(lead?.summary || "等待下一次内容轮换。")}</p>
      <div class="digest-story-list">
        <div class="digest-story-item">
          <span class="digest-story-label">${escapeHtml(modeConfig.primaryStoryLabel)}</span>
          <strong>${escapeHtml(lead?.relevance || lead?.provider || "待补充")}</strong>
          <span>${escapeHtml(leadReason)}</span>
        </div>
        <div class="digest-story-item">
          <span class="digest-story-label">${escapeHtml(modeConfig.secondaryStoryLabel)}</span>
          <strong>${escapeHtml(follow?.title || "暂无补充线索")}</strong>
          <span>${escapeHtml(followReason)}</span>
        </div>
      </div>
      <div class="digest-card-meta">
        <span>${escapeHtml(insightLabel)}: ${escapeHtml(lead?.relevance || lead?.provider || "待补充")}</span>
        <a class="mini-link" href="#section-${type}" data-section="section-${type}">进入板块</a>
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

function getManualKeywords() {
  return dedupeFocusTerms(splitFocusTerms(state.settings.keywords));
}

function getSubscribedTopics() {
  const raw = Array.isArray(state.settings.subscribedTopics)
    ? state.settings.subscribedTopics
    : splitFocusTerms(state.settings.subscribedTopics);
  return dedupeFocusTerms(raw, { limit: 12, maxLength: 28 });
}

function getFocusTerms() {
  return dedupeFocusTerms([...getManualKeywords(), ...getSubscribedTopics()], {
    limit: 18,
    maxLength: 36,
  });
}

function getFocusKeywordString() {
  return getFocusTerms().join(", ");
}

function splitFocusTerms(value) {
  return String(value || "")
    .split(/[,\n，、]+/)
    .map((term) => term.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function dedupeFocusTerms(values, { limit = 12, maxLength = 36 } = {}) {
  const list = [];
  const seen = new Set();
  values.forEach((value) => {
    const topic = String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
    if (!topic) return;
    const key = topic.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    list.push(topic);
  });
  return list.slice(0, limit);
}

function formatTopicSummary(topics, limit = 3) {
  if (!topics.length) return "";
  const visible = topics.slice(0, limit);
  return topics.length > limit ? `${visible.join(" / ")} +${topics.length - limit}` : visible.join(" / ");
}

function normalizeDigestMode(value) {
  return value === "evening" ? "evening" : "morning";
}

function getDigestModeConfig(mode) {
  if (mode === "evening") {
    return {
      mark: "Evening Recap",
      title: "晚间情报回顾",
      kicker: "Evening Lens",
      fallbackTitle: "正在整理今天最值得回看的主线",
      fallbackSummary: "四条内容流会把热点、研究、音乐和娱乐重新压缩成一版更适合复盘的晚间摘要。",
      streamLabel: "在线内容流",
      interestLabel: "今日偏好",
      sortLabel: "当前检视方式",
      primaryStoryLabel: "今日高点",
      secondaryStoryLabel: "明早继续看",
    };
  }

  return {
    mark: "Morning Brief",
    title: "晨间情报简报",
    kicker: "Morning Lens",
    fallbackTitle: "正在整理今早最值得先看的内容",
    fallbackSummary: "四条内容流会把热点、研究、音乐和娱乐压缩成一版更适合快速扫读的晨间摘要。",
    streamLabel: "在线内容流",
    interestLabel: "兴趣偏向",
    sortLabel: "当前排序方式",
    primaryStoryLabel: "主线",
    secondaryStoryLabel: "继续跟进",
  };
}

function handleTopicInputKeydown(event) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  handleAddTopic();
}

function handleAddTopic() {
  const nextTopics = dedupeFocusTerms([...getSubscribedTopics(), ...splitFocusTerms(elements.topicInput?.value)], {
    limit: 12,
    maxLength: 28,
  });
  if (!nextTopics.length) {
    showToastCard("还没有添加主题", "输入一个你真正关心的话题，比如 OpenAI、奥斯卡或 K-pop。");
    return;
  }

  const changed = nextTopics.join("|") !== getSubscribedTopics().join("|");
  state.settings.subscribedTopics = nextTopics;
  if (elements.topicInput) {
    elements.topicInput.value = "";
  }
  renderTopicChips();
  saveSettings();
  renderAll();
  maybeRefreshDigest({ silent: true });

  if (changed) {
    showToastCard("订阅主题已更新", `当前会优先追踪 ${formatTopicSummary(nextTopics, 3)}。`);
  }
}

function handleTopicChipAction(button) {
  if (button.dataset.topicAction !== "remove") return;
  const targetTopic = String(button.dataset.topic || "").toLowerCase();
  if (!targetTopic) return;
  const nextTopics = getSubscribedTopics().filter((topic) => topic.toLowerCase() !== targetTopic);
  state.settings.subscribedTopics = nextTopics;
  renderTopicChips();
  saveSettings();
  renderAll();
  maybeRefreshDigest({ silent: true });
}

function handleDigestModeToggle(event) {
  const nextMode = normalizeDigestMode(event.currentTarget?.dataset?.digestMode);
  if (nextMode === state.settings.digestMode) return;
  state.settings.digestMode = nextMode;
  syncDigestModeControls();
  saveSettings();
  maybeRefreshDigest({ silent: true });
  showToastCard(nextMode === "evening" ? "已切到晚报" : "已切到晨报", nextMode === "evening" ? "摘要会更偏向回顾和复盘。" : "摘要会更偏向快速扫读和开场浏览。");
}

function maybeRefreshDigest(options = {}) {
  if (!elements.digestOutput?.dataset?.plaintext) return;
  generateDigest(options);
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
