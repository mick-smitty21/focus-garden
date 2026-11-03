// garden.js: the live garden. A p5 sketch (instance mode) redraws the plant
// every frame from the session saved in storage, and the lines under the
// canvas show the task, the current state in words, and the time remaining.
// The background engine owns the session; this page only reads and displays it.

const taskName = document.getElementById("task-name");
const demoTag = document.getElementById("demo-tag");
const stateWords = document.getElementById("state-words");
const timeRemaining = document.getElementById("time-remaining");

let session = null;           // latest copy of "current" from storage (display only)
let endCheckRequestedFor = null; // id of the session we already nudged to end

// Plain-language description of the state. No shame words.
function describeState(currentSession) {
  if (currentSession.endedAt) {
    return "Session complete. Your plant is ready.";
  }
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
  if (currentSession.endedAt) {
    return "";
  }
  const realMsPerSessionMinute = 60000 / currentSession.timeScale;
  const elapsedMinutes = (nowMs - currentSession.startedAt) / realMsPerSessionMinute;
  const remainingMinutes = Math.max(0, Math.ceil(currentSession.plannedSessionMinutes - elapsedMinutes));
  return remainingMinutes + " min left";
}

// Refresh the text under the canvas.
function updateInfo() {
  if (!session) {
    taskName.textContent = "No session yet";
    stateWords.textContent = "Start one from the toolbar: New session.";
    timeRemaining.textContent = "";
    demoTag.hidden = true;
    return;
  }
  const nowMs = Date.now();
  taskName.textContent = session.task;
  demoTag.hidden = session.timeScale === 1; // show the tag only in demo mode
  stateWords.textContent = describeState(session);
  timeRemaining.textContent = describeRemaining(session, nowMs);

  // When time is up, ask the engine to check now instead of waiting up to
  // 30 seconds for its next alarm. Only ask once per session.
  const plannedEnd = session.startedAt + session.plannedSessionMinutes * 60000 / session.timeScale;
  if (!session.endedAt && nowMs >= plannedEnd && endCheckRequestedFor !== session.id) {
    endCheckRequestedFor = session.id;
    chrome.runtime.sendMessage({ type: "evaluate" });
  }
}

async function loadSession() {
  const stored = await chrome.storage.local.get("current");
  session = stored.current || null;
  updateInfo();
}

chrome.storage.onChanged.addListener(function (changes, areaName) {
  if (areaName === "local" && changes.current) {
    session = changes.current.newValue || null;
    updateInfo();
  }
});

// The p5 sketch, in instance mode: every p5 function is called on "p".
const sketch = function (p) {
  p.setup = function () {
    p.createCanvas(400, 560);
  };
  p.draw = function () {
    if (!session) {
      p.background("#E8F5E9");
      return;
    }
    drawPlant(p, session, Date.now(), { width: 400, height: 560, animate: true });
  };
};

new p5(sketch, document.getElementById("garden-canvas"));
setInterval(updateInfo, 1000); // refresh the countdown once a second
loadSession();
