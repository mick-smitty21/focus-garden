// summary.js: everything for the end-of-session summary.
// computeSummary adds up the segments, renderSummary fills in the page text,
// and drawTimeline paints the colored strip under the plant (so it is in the PNG).
// Used by garden.js; the gallery will reuse it to show past sessions.

// Add up a finished session. Returns a dict of totals and lists.
function computeSummary(session) {
  const totalMs = { focus: 0, detour: 0, declared: 0, neutral: 0 };
  const detourMsByLabel = {}; // e.g. { "www.youtube.com": 90000 }
  let detourCount = 0;
  for (const segment of session.segments) {
    const durationMs = segment.end - segment.start;
    totalMs[segment.kind] = totalMs[segment.kind] + durationMs;
    if (segment.kind === STATE_DETOUR) {
      detourCount = detourCount + 1; // one per knot on the plant
      const previousMs = detourMsByLabel[segment.label] || 0; // like dict.get(key, 0)
      detourMsByLabel[segment.label] = previousMs + durationMs;
    }
  }
  // Object.entries is like dict.items(); sort biggest first, keep the top 3.
  const topDetours = Object.entries(detourMsByLabel).sort(function (a, b) {
    return b[1] - a[1];
  }).slice(0, 3);
  return {
    focusMinutes: totalMs.focus / 60000, // real minutes, not session-minutes
    detourMinutes: totalMs.detour / 60000,
    declaredMinutes: totalMs.declared / 60000,
    detourCount: detourCount,
    topDetours: topDetours,
    declarations: session.declarationLog || []
  };
}

// One decimal place, e.g. 3.25 -> "3.3".
function formatMinutes(minutes) {
  return minutes.toFixed(1);
}

// Two-digit number, e.g. 7 -> "07" (like Python's f"{n:02d}").
function twoDigits(number) {
  return String(number).padStart(2, "0");
}

// The PNG name: focus-garden-YYYY-MM-DD-HHMM, from the session's start time.
function pngFilename(session) {
  const start = new Date(session.startedAt);
  return "focus-garden-" + start.getFullYear() + "-" + twoDigits(start.getMonth() + 1) + "-" +
    twoDigits(start.getDate()) + "-" + twoDigits(start.getHours()) + twoDigits(start.getMinutes());
}

// Encouraging, factual headline.
function summaryHeadline(summary) {
  if (summary.detourCount === 0) {
    return "Your plant grew straight up, with no detours.";
  }
  if (summary.detourCount === 1) {
    return "Your plant grew through 1 detour.";
  }
  return "Your plant grew through " + summary.detourCount + " detours.";
}

// Fill in the summary section of garden.html for this session.
function renderSummary(session) {
  const summary = computeSummary(session);
  document.getElementById("summary-headline").textContent = summaryHeadline(summary);
  document.getElementById("summary-focus").textContent = formatMinutes(summary.focusMinutes) + " min";
  document.getElementById("summary-detour").textContent = formatMinutes(summary.detourMinutes) + " min";
  document.getElementById("summary-declared").textContent = formatMinutes(summary.declaredMinutes) + " min";

  const detourList = document.getElementById("summary-top-detours");
  detourList.innerHTML = "";
  if (summary.topDetours.length === 0) {
    detourList.textContent = "None this time.";
  }
  for (const pair of summary.topDetours) {
    const item = document.createElement("li");
    item.textContent = pair[0] + ": " + formatMinutes(pair[1] / 60000) + " min";
    detourList.appendChild(item);
  }

  const declarationList = document.getElementById("summary-declarations");
  declarationList.innerHTML = "";
  if (summary.declarations.length === 0) {
    declarationList.textContent = "None this time.";
  }
  for (const declaration of summary.declarations) {
    const item = document.createElement("li");
    item.textContent = declaration.app + ": " + declaration.purpose;
    declarationList.appendChild(item);
  }
}

// Draw the timeline strip: one colored block per segment, left to right in time,
// plus the task name and date, starting at y = top.
function drawTimeline(p, session, top, width) {
  const scale = width / 400;
  const totalMs = session.endedAt - session.startedAt;
  const barTop = top + 6 * scale;
  const barHeight = 12 * scale;
  p.noStroke();
  p.fill("#FFFFFF");
  p.rect(0, top, width, 40 * scale);
  p.fill("#E0E0E0");
  p.rect(10 * scale, barTop, width - 20 * scale, barHeight);
  if (totalMs > 0) {
    for (const segment of session.segments) {
      const left = 10 * scale + (segment.start - session.startedAt) / totalMs * (width - 20 * scale);
      const segmentWidth = (segment.end - segment.start) / totalMs * (width - 20 * scale);
      p.fill(STATE_COLORS[segment.kind]);
      p.rect(left, barTop, Math.max(1, segmentWidth), barHeight);
    }
  }
  p.fill("#2B2B2B");
  p.textSize(11 * scale);
  p.textAlign(p.LEFT, p.TOP);
  p.text(session.task + "  |  " + new Date(session.startedAt).toLocaleDateString(), 10 * scale, barTop + barHeight + 4 * scale);
}
