// debug.js: fills the debug page from chrome.storage.local.
// Redraws whenever storage changes, and once a second so the open
// segment's running time and the remaining time keep ticking.

const statusArea = document.getElementById("status");
const segmentRows = document.getElementById("segment-rows");

// The latest copy of the session. A page variable is fine here: this page only
// displays data; the background engine owns the real copy in storage.
let latestSession = null;

// Format a timestamp as a clock time like 1:42:07 PM.
function clockTime(timestampMs) {
  return new Date(timestampMs).toLocaleTimeString();
}

// Build one table row from a list of cell texts.
function addRow(cellTexts, kind, isOpen) {
  const row = document.createElement("tr");
  if (isOpen) {
    row.className = "open-row";
  }
  for (let index = 0; index < cellTexts.length; index = index + 1) {
    const cell = document.createElement("td");
    if (index === 1) {
      // A small colored square before the kind, matching the badge color.
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = STATE_COLORS[kind];
      cell.appendChild(swatch);
    }
    cell.appendChild(document.createTextNode(cellTexts[index]));
    row.appendChild(cell);
  }
  segmentRows.appendChild(row);
}

function render() {
  const session = latestSession;
  segmentRows.innerHTML = "";
  if (!session) {
    statusArea.textContent = "No session yet. Start one from the setup screen.";
    return;
  }

  const nowMs = Date.now();
  const msPerSessionMinute = 60000 / session.timeScale;
  let referenceMs = nowMs;
  if (session.endedAt) {
    referenceMs = session.endedAt;
  }
  const elapsedSessionMinutes = (referenceMs - session.startedAt) / msPerSessionMinute;
  const remainingMinutes = Math.max(0, session.plannedSessionMinutes - elapsedSessionMinutes);

  let stateText = "ended at " + clockTime(session.endedAt || nowMs);
  if (!session.endedAt && session.open) {
    stateText = session.open.kind + " (" + session.open.label + ")";
  }
  let declarationText = "none";
  if (session.declaration) {
    declarationText = session.declaration.app + " until " + clockTime(session.declaration.expiresAt);
  }
  statusArea.innerHTML = "";
  const lines = [
    "Task: " + session.task,
    "State: " + stateText,
    "Session-minutes remaining: " + remainingMinutes.toFixed(1) + " (time scale " + session.timeScale + "x)",
    "Declaration: " + declarationText,
    "Last heartbeat: " + clockTime(session.lastHeartbeat)
  ];
  for (const line of lines) {
    const paragraph = document.createElement("div");
    paragraph.textContent = line;
    statusArea.appendChild(paragraph);
  }

  // One row per finished segment, then the open one (italic) if any.
  session.segments.forEach(function (segment, index) {
    const seconds = ((segment.end - segment.start) / 1000).toFixed(1);
    addRow([String(index + 1), segment.kind, segment.label, clockTime(segment.start), clockTime(segment.end), seconds], segment.kind, false);
  });
  if (session.open && !session.endedAt) {
    const openSeconds = ((nowMs - session.open.start) / 1000).toFixed(1);
    addRow(["now", session.open.kind, session.open.label, clockTime(session.open.start), "(open)", openSeconds], session.open.kind, true);
  }
}

async function loadAndRender() {
  const stored = await chrome.storage.local.get("current");
  latestSession = stored.current || null;
  render();
}

// Redraw when the engine saves new data. changes is a dict of what changed.
chrome.storage.onChanged.addListener(function (changes, areaName) {
  if (areaName === "local" && changes.current) {
    latestSession = changes.current.newValue || null;
    render();
  }
});

setInterval(render, 1000); // tick every second, like a loop with time.sleep(1)
loadAndRender();
