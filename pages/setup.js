// setup.js: behavior for the setup screen.
// Loads saved settings, lets you edit the allowlist, length, and demo mode
// (saving after every change), and creates a new session when you press Start.
// Uses helpers from shared/rules.js, which setup.html loads first.

// Find the page elements we need, once, by id.
const taskInput = document.getElementById("task-input");
const entryInput = document.getElementById("entry-input");
const addEntryButton = document.getElementById("add-entry-button");
const entryMessage = document.getElementById("entry-message");
const allowlistList = document.getElementById("allowlist-list");
const showTabsButton = document.getElementById("show-tabs-button");
const openTabsPanel = document.getElementById("open-tabs-panel");
const openTabsList = document.getElementById("open-tabs-list");
const addSelectedTabsButton = document.getElementById("add-selected-tabs-button");
const openDetailsButton = document.getElementById("open-details-button");
const fileAccessStatus = document.getElementById("file-access-status");
const minutesInput = document.getElementById("minutes-input");
const demoCheckbox = document.getElementById("demo-checkbox");
const startButton = document.getElementById("start-button");
const startMessage = document.getElementById("start-message");

// The settings being edited. Same shape as "settings" in chrome.storage.local.
let settings = {
  allowlist: [],
  sessionMinutes: DEFAULT_SESSION_MINUTES,
  demoMode: false
};

// Write settings to storage. "async" + "await" work like Python's asyncio:
// await pauses this function until Chrome finishes saving.
async function saveSettings() {
  await chrome.storage.local.set({ settings: settings });
}

// Add an entry unless it is already there (ignoring upper/lower case).
// Returns true if it was added.
function addEntryIfNew(entry) {
  const lowerEntry = entry.toLowerCase();
  for (const existing of settings.allowlist) {
    if (existing.toLowerCase() === lowerEntry) {
      return false;
    }
  }
  settings.allowlist.push(entry); // push is like Python's list.append
  return true;
}

// Rebuild the visible allowlist from settings.allowlist.
function renderAllowlist() {
  allowlistList.innerHTML = ""; // clear the old list
  for (const entry of settings.allowlist) {
    const item = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = entry;
    const removeButton = document.createElement("button");
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", async function () {
      // filter keeps items where the test is true, like a Python list comprehension.
      settings.allowlist = settings.allowlist.filter(function (other) {
        return other !== entry;
      });
      await saveSettings();
      renderAllowlist();
    });
    item.appendChild(text);
    item.appendChild(removeButton);
    allowlistList.appendChild(item);
  }
}

// Handle the typed-entry Add button.
async function addTypedEntry() {
  const entry = normalizeEntry(entryInput.value);
  if (entry === null) {
    entryMessage.textContent = "That doesn't look like a site or file. Try docs.google.com or a file path.";
    return;
  }
  if (addEntryIfNew(entry)) {
    entryMessage.textContent = "";
  } else {
    entryMessage.textContent = "Already on the list.";
  }
  entryInput.value = "";
  await saveSettings();
  renderAllowlist();
}

// List every open tab with a checkbox, so you can pick the ones your task needs.
async function showOpenTabs() {
  const tabs = await chrome.tabs.query({}); // {} means "all tabs in all windows"
  openTabsList.innerHTML = "";
  const alreadySeen = [];
  for (const tab of tabs) {
    // tab.url can be missing for some tabs; skip those and non-web pages.
    if (!tab.url) {
      continue;
    }
    const entry = entryFromUrl(tab.url);
    if (entry === null || alreadySeen.includes(entry)) {
      continue;
    }
    alreadySeen.push(entry);
    const item = document.createElement("li");
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = entry; // remember which entry this box stands for
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(" " + entry));
    item.appendChild(label);
    openTabsList.appendChild(item);
  }
  if (alreadySeen.length === 0) {
    openTabsList.textContent = "No web pages or local files are open right now.";
  }
  openTabsPanel.hidden = false;
}

// Add every checked tab to the allowlist.
async function addSelectedTabs() {
  const checkedBoxes = openTabsList.querySelectorAll("input:checked");
  for (const checkbox of checkedBoxes) {
    addEntryIfNew(checkbox.value);
  }
  openTabsPanel.hidden = true;
  await saveSettings();
  renderAllowlist();
}

// Keep the length between 15 and 180, then save.
async function saveMinutes() {
  let minutes = parseInt(minutesInput.value, 10); // like Python's int()
  if (isNaN(minutes)) {
    minutes = DEFAULT_SESSION_MINUTES;
  }
  minutes = Math.max(MIN_SESSION_MINUTES, Math.min(MAX_SESSION_MINUTES, minutes));
  minutesInput.value = minutes;
  settings.sessionMinutes = minutes;
  await saveSettings();
}

// Create the "current" session and open the garden in its own small window.
async function startSession() {
  const task = taskInput.value.trim();
  if (task === "") {
    startMessage.textContent = "Give your task a name first.";
    return;
  }
  if (settings.allowlist.length === 0) {
    startMessage.textContent = "Add at least one site or file to the allowlist.";
    return;
  }
  await saveMinutes();

  const startedAt = Date.now(); // milliseconds since 1970, like time.time() * 1000
  let timeScale = 1;
  if (settings.demoMode) {
    timeScale = DEMO_TIME_SCALE;
  }

  const current = {
    id: String(startedAt),
    task: task,
    startedAt: startedAt,
    plannedSessionMinutes: settings.sessionMinutes,
    timeScale: timeScale,
    seed: hashString(task + startedAt),
    segments: [],
    open: { kind: STATE_NEUTRAL, start: startedAt, label: "" }, // Stage 2 sets the real state
    declaration: null,
    lastHeartbeat: startedAt,
    endedAt: null
  };
  await chrome.storage.local.set({ current: current });

  await chrome.windows.create({
    url: chrome.runtime.getURL("pages/garden.html"),
    type: "popup",
    width: 420,
    height: 680
  });
  startMessage.textContent = "Session started. Your garden is open in its own window.";
}

// Show whether the "Allow access to file URLs" switch is on.
function showFileAccessStatus() {
  chrome.extension.isAllowedFileSchemeAccess(function (isAllowed) {
    if (isAllowed) {
      fileAccessStatus.textContent = "(currently on)";
    } else {
      fileAccessStatus.textContent = "(currently off)";
    }
  });
}

// Load saved settings when the page opens, then fill in the form.
async function loadPage() {
  const stored = await chrome.storage.local.get("settings");
  if (stored.settings) {
    settings = stored.settings;
  }
  minutesInput.value = settings.sessionMinutes;
  demoCheckbox.checked = settings.demoMode;
  renderAllowlist();
  showFileAccessStatus();
}

// Connect buttons and inputs to the functions above.
addEntryButton.addEventListener("click", addTypedEntry);
entryInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    addTypedEntry();
  }
});
showTabsButton.addEventListener("click", showOpenTabs);
addSelectedTabsButton.addEventListener("click", addSelectedTabs);
minutesInput.addEventListener("change", saveMinutes);
demoCheckbox.addEventListener("change", async function () {
  settings.demoMode = demoCheckbox.checked;
  await saveSettings();
});
openDetailsButton.addEventListener("click", function () {
  // chrome.runtime.id is this extension's id, so this opens its own details page.
  chrome.tabs.create({ url: "chrome://extensions/?id=" + chrome.runtime.id });
});
startButton.addEventListener("click", startSession);

loadPage();
