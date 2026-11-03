// garden.js: the garden window. A p5 sketch (instance mode) redraws the plant
// every frame from the session saved in storage. While the session runs, the
// live view shows status and the declaration form; once it ends, the page
// switches to the summary view. The background engine owns the session data.

const PLANT_WIDTH = 400;
const PLANT_HEIGHT = 560;
const TIMELINE_HEIGHT = 40;               // extra canvas height for the summary strip
const WELCOME_BACK_SHOW_MS = 60 * 1000;   // show the welcome-back note for one minute

const liveView = document.getElementById("live-view");
const summaryView = document.getElementById("summary-view");
const taskName = document.getElementById("task-name");
const demoTag = document.getElementById("demo-tag");
const stateWords = document.getElementById("state-words");
const timeRemaining = document.getElementById("time-remaining");
const declarationStatus = document.getElementById("declaration-status");
const welcomeBack = document.getElementById("welcome-back");
const declareAppInput = document.getElementById("declare-app-input");
const declarePurposeInput = document.getElementById("declare-purpose-input");
const declareButton = document.getElementById("declare-button");
const declareMessage = document.getElementById("declare-message");
const endSessionButton = document.getElementById("end-session-button");
const savePngButton = document.getElementById("save-png-button");
const newSessionButton = document.getElementById("new-session-button");
const galleryButton = document.getElementById("gallery-button");

// If the address ends in ?session=<id>, show that past session from history
// instead of the current one. URLSearchParams reads the part after "?".
const viewedSessionId = new URLSearchParams(window.location.search).get("session");

let session = null;                 // the session being shown (display only)
let endCheckRequestedFor = null;    // id of the session we already nudged to end
let expiryCheckRequestedFor = null; // expiresAt of the declaration we already nudged
let summaryRenderedFor = null;      // id of the session whose summary text is filled in

// Plain-language description of the state. No shame words.
function describeState(currentSession) {
  const open = currentSession.open;
  if (!open) {
    return "";
  }
  if (open.kind === STATE_FOCUS) {
    return "Focus: " + open.label;
  }
  if (open.kind === STATE_DETOUR) {
    return "Detour: " + open.label;
  }
  if (open.kind === STATE_DECLARED) {
    return "Declared: working in " + open.label;
  }
  return "Paused (nothing grows or marks)";
}

// Session-minutes left, as "12 min left".
function describeRemaining(currentSession, nowMs) {
  const elapsedMinutes = (nowMs - currentSession.startedAt) / realMsPerSessionMinute(currentSession);
  const remainingMinutes = Math.max(0, Math.ceil(currentSession.plannedSessionMinutes - elapsedMinutes));
  return remainingMinutes + " min left";
}

// Refresh everything under the canvas. Runs on load, on storage changes, and every second.
function updateInfo() {
  if (!session) {
    liveView.hidden = false;
    summaryView.hidden = true;
    taskName.textContent = "No session yet";
    stateWords.textContent = "Start one from the toolbar: New session.";
    timeRemaining.textContent = "";
    demoTag.hidden = true;
    return;
  }

  if (session.endedAt) {
    liveView.hidden = true;
    summaryView.hidden = false;
    if (summaryRenderedFor !== session.id) {
      renderSummary(session); // from summary.js
      summaryRenderedFor = session.id;
    }
    return;
  }

  liveView.hidden = false;
  summaryView.hidden = true;
  const nowMs = Date.now();
  taskName.textContent = session.task;
  demoTag.hidden = session.timeScale === 1; // show the tag only in demo mode
  stateWords.textContent = describeState(session);
  timeRemaining.textContent = describeRemaining(session, nowMs);
  updateDeclarationInfo(nowMs);

  // When time is up, ask the engine to check now instead of waiting up to
  // 30 seconds for its next alarm. Only ask once per session.
  if (nowMs >= plannedEndMs(session) && endCheckRequestedFor !== session.id) {
    endCheckRequestedFor = session.id;
    chrome.runtime.sendMessage({ type: "evaluate" });
  }
}

// Show the active declaration and its time left, and the welcome-back note.
function updateDeclarationInfo(nowMs) {
  const declaration = session.declaration;
  if (declaration && nowMs < declaration.expiresAt) {
    const minutesLeft = Math.ceil((declaration.expiresAt - nowMs) / realMsPerSessionMinute(session));
    declarationStatus.textContent = "Declared: " + declaration.app + " (" + declaration.purpose + "), " + minutesLeft + " min left";
    declarationStatus.hidden = false;
  } else {
    declarationStatus.hidden = true;
  }
  // Same idea as the end check: nudge the engine the moment a declaration runs out.
  if (declaration && nowMs >= declaration.expiresAt && expiryCheckRequestedFor !== declaration.expiresAt) {
    expiryCheckRequestedFor = declaration.expiresAt;
    chrome.runtime.sendMessage({ type: "evaluate" });
  }
  const welcomeBackAt = session.welcomeBackAt;
  let showWelcome = false;
  if (welcomeBackAt && nowMs - welcomeBackAt < WELCOME_BACK_SHOW_MS) {
    showWelcome = true;
  }
  welcomeBack.hidden = !showWelcome;
}

// The garden's declaration form: same checks as the popup's.
async function submitDeclaration() {
  const app = declareAppInput.value.trim();
  const purpose = declarePurposeInput.value.trim();
  const problem = validateDeclaration(app, purpose);
  if (problem !== "") {
    declareMessage.textContent = problem;
    return;
  }
  if (!session || session.endedAt) {
    declareMessage.textContent = "Start a session first.";
    return;
  }
  await chrome.runtime.sendMessage({ type: "declare", app: app, purpose: purpose });
  declareMessage.textContent = "Declared. Switch to " + app + " when ready.";
  declareAppInput.value = "";
  declarePurposeInput.value = "";
}

async function loadSession() {
  if (viewedSessionId) {
    const stored = await chrome.storage.local.get("history");
    const history = stored.history || [];
    // find returns the first match or undefined, like next((s for s in history if ...), None)
    session = history.find(function (pastSession) {
      return pastSession.id === viewedSessionId;
    }) || null;
  } else {
    const stored = await chrome.storage.local.get("current");
    session = stored.current || null;
  }
  updateInfo();
}

chrome.storage.onChanged.addListener(function (changes, areaName) {
  // A past session never changes, so only follow "current" in the normal view.
  if (!viewedSessionId && areaName === "local" && changes.current) {
    session = changes.current.newValue || null;
    updateInfo();
  }
});

// The p5 sketch, in instance mode: every p5 function is called on "p".
const sketch = function (p) {
  p.setup = function () {
    p.createCanvas(PLANT_WIDTH, PLANT_HEIGHT);
  };
  p.draw = function () {
    if (!session) {
      p.background("#E8F5E9");
      return;
    }
    if (session.endedAt) {
      // Summary: the final plant (no sway) with the timeline strip under it.
      if (p.height !== PLANT_HEIGHT + TIMELINE_HEIGHT) {
        p.resizeCanvas(PLANT_WIDTH, PLANT_HEIGHT + TIMELINE_HEIGHT);
      }
      drawPlant(p, session, session.endedAt, { width: PLANT_WIDTH, height: PLANT_HEIGHT, animate: false });
      drawTimeline(p, session, PLANT_HEIGHT, PLANT_WIDTH);
      return;
    }
    if (p.height !== PLANT_HEIGHT) {
      p.resizeCanvas(PLANT_WIDTH, PLANT_HEIGHT);
    }
    drawPlant(p, session, Date.now(), { width: PLANT_WIDTH, height: PLANT_HEIGHT, animate: true });
  };
};

// Keep the p5 instance in a variable so the Save button can call saveCanvas on it.
const gardenSketch = new p5(sketch, document.getElementById("garden-canvas"));

declareButton.addEventListener("click", submitDeclaration);
endSessionButton.addEventListener("click", function () {
  chrome.runtime.sendMessage({ type: "end-session" });
});
savePngButton.addEventListener("click", function () {
  gardenSketch.saveCanvas(pngFilename(session), "png"); // downloads exactly what is on the canvas
});
newSessionButton.addEventListener("click", function () {
  chrome.tabs.create({ url: chrome.runtime.getURL("pages/setup.html") });
});
galleryButton.addEventListener("click", function () {
  chrome.tabs.create({ url: chrome.runtime.getURL("pages/gallery.html") });
});

setInterval(updateInfo, 1000); // refresh the countdown once a second
loadSession();
