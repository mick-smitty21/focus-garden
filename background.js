// background.js: the tracking engine (an MV3 "service worker").
// It listens for tab, window-focus, and screen-lock events, decides which state
// the session is in (focus, detour, declared, neutral), and records segments.
// Chrome stops this file after ~30 idle seconds, so ALL session data lives in
// chrome.storage.local; every handler loads it fresh, changes it, and saves it.

// Load shared constants and helpers (STATE_FOCUS, matchesAllowlist, ...).
// importScripts is the service-worker version of a <script> tag, like Python's import.
importScripts("shared/rules.js");

const HEARTBEAT_ALARM = "heartbeat";

// These two variables hold no session data. One is a timer handle for the
// 1-second debounce; the other keeps events processed one at a time.
let focusDebounceTimer = null;
let workQueue = Promise.resolve();

// Run tasks strictly one after another. Without this, two events arriving together
// could both load the same old session, and the second save would erase the first.
// A Promise is like an asyncio Future: ".then" schedules the next step after it finishes.
function runInOrder(task) {
  workQueue = workQueue.then(task).catch(function (error) {
    console.error("Focus Garden engine error:", error);
  });
  return workQueue;
}

async function loadCurrent() {
  const stored = await chrome.storage.local.get("current");
  if (stored.current) {
    return stored.current;
  }
  return null;
}

async function saveCurrent(current) {
  await chrome.storage.local.set({ current: current });
}

// Real milliseconds in one session-minute: 60000 normally, 6000 in demo mode.
function realMsPerSessionMinute(current) {
  return 60000 / current.timeScale;
}

// The real timestamp at which the planned session length is reached.
function plannedEndMs(current) {
  return current.startedAt + current.plannedSessionMinutes * realMsPerSessionMinute(current);
}

// A short label for a URL: the hostname, or "file" for local files.
function labelForUrl(url) {
  if (url.toLowerCase().startsWith("file:")) {
    return "file";
  }
  try {
    const hostname = new URL(url).hostname;
    if (hostname !== "") {
      return hostname;
    }
  } catch (error) {
    // Not a parseable URL; fall through to the generic label.
  }
  return "page";
}

// Finish the open segment at endMs and add it to the segment list.
// Grace rule: a detour shorter than 10 real seconds is recorded as neutral.
function closeOpenSegment(current, endMs) {
  const open = current.open;
  if (!open) {
    return;
  }
  let kind = open.kind;
  const durationMs = endMs - open.start;
  if (kind === STATE_DETOUR && durationMs < GRACE_PERIOD_MS) {
    kind = STATE_NEUTRAL;
  }
  if (durationMs > 0) {
    current.segments.push({ kind: kind, start: open.start, end: endMs, label: open.label });
  }
  current.open = null;
}

// Close the open segment and start a new one at the same moment.
function switchTo(current, kind, label, atMs) {
  closeOpenSegment(current, atMs);
  current.open = { kind: kind, start: atMs, label: label };
}

// Mark the session as finished at endMs. (Stage 5 adds the summary and history.)
function endSession(current, endMs) {
  closeOpenSegment(current, endMs);
  current.endedAt = endMs;
}

// Look at Chrome right now and decide the state. Returns { kind, label }.
async function computeState(current, nowMs) {
  // A locked screen is neutral: it grows nothing and marks nothing.
  // queryState(15) also reports "idle" after 15s without input; we ignore that,
  // because reading a PDF without touching the mouse is still focus.
  const idleState = await chrome.idle.queryState(15);
  if (idleState === "locked") {
    return { kind: STATE_NEUTRAL, label: "screen locked" };
  }

  // populate: true includes each window's tabs. Include devtools windows so that
  // inspecting the extension counts as neutral instead of "Chrome lost focus".
  const windows = await chrome.windows.getAll({
    populate: true,
    windowTypes: ["normal", "popup", "devtools"]
  });
  let focusedWindow = null;
  for (const windowInfo of windows) {
    if (windowInfo.focused) {
      focusedWindow = windowInfo;
    }
  }

  // No focused Chrome window means the user is in another desktop app.
  if (focusedWindow === null) {
    const declaration = current.declaration;
    if (declaration && nowMs < declaration.expiresAt) {
      return { kind: STATE_DECLARED, label: declaration.app };
    }
    return { kind: STATE_DETOUR, label: "outside Chrome" };
  }
  if (focusedWindow.type === "devtools") {
    return { kind: STATE_NEUTRAL, label: "devtools" };
  }

  let activeTab = null;
  for (const tab of focusedWindow.tabs) {
    if (tab.active) {
      activeTab = tab;
    }
  }
  if (activeTab === null) {
    return { kind: STATE_NEUTRAL, label: "no tab" };
  }

  // pendingUrl is the address a tab is still loading.
  const url = activeTab.url || activeTab.pendingUrl || "";
  if (url === "") {
    return { kind: STATE_NEUTRAL, label: "loading" };
  }
  // The extension's own pages (garden, setup, debug) are neutral.
  if (url.startsWith(chrome.runtime.getURL(""))) {
    return { kind: STATE_NEUTRAL, label: "Focus Garden" };
  }

  const stored = await chrome.storage.local.get("settings");
  let allowlist = [];
  if (stored.settings) {
    allowlist = stored.settings.allowlist;
  }
  if (matchesAllowlist(url, allowlist)) {
    return { kind: STATE_FOCUS, label: labelForUrl(url) };
  }
  return { kind: STATE_DETOUR, label: labelForUrl(url) };
}

// Badge: remaining session-minutes, colored by the current state.
async function updateBadge(current, nowMs) {
  if (!current || current.endedAt || !current.open) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }
  const elapsedSessionMinutes = (nowMs - current.startedAt) / realMsPerSessionMinute(current);
  const remainingMinutes = Math.max(0, Math.ceil(current.plannedSessionMinutes - elapsedSessionMinutes));
  const kind = current.open.kind;
  await chrome.action.setBadgeText({ text: String(remainingMinutes) });
  await chrome.action.setBadgeBackgroundColor({ color: STATE_COLORS[kind] });
  // Dark text on the yellow detour badge, white text on the others, so it stays readable.
  let textColor = "#FFFFFF";
  if (kind === STATE_DETOUR) {
    textColor = "#000000";
  }
  await chrome.action.setBadgeTextColor({ color: textColor });
}

// The heart of the engine: load, update, save. Every event ends up here.
async function evaluate() {
  const nowMs = Date.now();
  const current = await loadCurrent();
  if (!current || current.endedAt) {
    await updateBadge(null, nowMs);
    return;
  }

  // Session length reached: end exactly at the planned time, even if this
  // check runs a few seconds late (alarms only fire every 30 seconds).
  const endMs = plannedEndMs(current);
  if (nowMs >= endMs) {
    endSession(current, endMs);
    await saveCurrent(current);
    await updateBadge(current, nowMs);
    return;
  }

  // Declaration expired: declared time stops exactly at expiresAt.
  const declaration = current.declaration;
  if (declaration && nowMs >= declaration.expiresAt) {
    if (current.open && current.open.kind === STATE_DECLARED) {
      switchTo(current, STATE_DETOUR, "outside Chrome", declaration.expiresAt);
    }
    current.declaration = null;
  }

  // Start a new segment only when the state or its label actually changed.
  const next = await computeState(current, nowMs);
  const open = current.open;
  if (!open || open.kind !== next.kind || open.label !== next.label) {
    switchTo(current, next.kind, next.label, nowMs);
  }

  current.lastHeartbeat = nowMs;
  await saveCurrent(current);
  await updateBadge(current, nowMs);
}

// Create the 30-second alarm only if it is missing. Re-creating it every time the
// worker wakes up would reset its countdown, and it might never fire.
async function ensureHeartbeatAlarm() {
  const existing = await chrome.alarms.get(HEARTBEAT_ALARM);
  if (!existing) {
    await chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.5 });
  }
}

// ---- Event listeners. Each one just queues an evaluate(). ----

chrome.tabs.onActivated.addListener(function () {
  runInOrder(evaluate);
});

// onUpdated fires for many tab changes; only a URL change on the active tab matters.
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.url && tab.active) {
    runInOrder(evaluate);
  }
});

// Wait 1 second after the last focus change, because Windows often fires
// several quick focus events in a row. clearTimeout cancels the previous wait.
chrome.windows.onFocusChanged.addListener(function () {
  clearTimeout(focusDebounceTimer);
  focusDebounceTimer = setTimeout(function () {
    runInOrder(evaluate);
  }, 1000);
});

chrome.idle.onStateChanged.addListener(function () {
  runInOrder(evaluate);
});

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === HEARTBEAT_ALARM) {
    runInOrder(evaluate);
  }
});

// Pages send { type: "evaluate" } when something changes (e.g. a session starts).
chrome.runtime.onMessage.addListener(function (message) {
  if (message && message.type === "evaluate") {
    runInOrder(evaluate);
  }
});

// When Chrome itself starts, a session left open from last time is ended at
// its last heartbeat, so time while Chrome was closed is not counted.
chrome.runtime.onStartup.addListener(function () {
  runInOrder(async function () {
    const current = await loadCurrent();
    if (current && !current.endedAt) {
      endSession(current, current.lastHeartbeat);
      await saveCurrent(current);
    }
    await updateBadge(current, Date.now());
  });
});

chrome.runtime.onInstalled.addListener(function () {
  console.log("Focus Garden installed or reloaded.");
});

// Printed every time Chrome starts this worker, so the console shows which version is running.
console.log("Focus Garden engine loaded (Stage 2).");
ensureHeartbeatAlarm();
runInOrder(evaluate); // check the state right away whenever the worker starts
