// shared/rules.js: constants and helper functions shared by every part of the extension:
// state names, colors, allowlist matching, declaration checks, and segment bookkeeping.
// Pages load it with a <script> tag; background.js will load it with importScripts.
// It must never touch "document" (the page), because the background has no page.
// Everything here is a plain top-level function or constant, so any file that loads it can use them.

// The four session states. Using constants avoids typos like "focsu" in strings.
const STATE_FOCUS = "focus";
const STATE_DETOUR = "detour";
const STATE_DECLARED = "declared";
const STATE_NEUTRAL = "neutral";

// Badge and timeline colors for each state (an object works like a Python dict).
const STATE_COLORS = {
  focus: "#2E7D32",
  detour: "#F9A825",
  declared: "#6A1B9A",
  neutral: "#757575"
};

// Session length limits, in session-minutes.
const MIN_SESSION_MINUTES = 15;
const MAX_SESSION_MINUTES = 180;
const DEFAULT_SESSION_MINUTES = 25;

// Demo mode runs time 10x faster. The grace period is always in real seconds.
const DEMO_TIME_SCALE = 10;
const GRACE_PERIOD_MS = 10 * 1000;

// A declaration ("working in another app") lasts 25 session-minutes.
const DECLARATION_SESSION_MINUTES = 25;
// The label used when Chrome has lost focus with no active declaration.
const OUTSIDE_CHROME_LABEL = "outside Chrome";

// Real milliseconds in one session-minute: 60000 normally, 6000 in demo mode.
function realMsPerSessionMinute(session) {
  return 60000 / session.timeScale;
}

// The real timestamp at which the planned session length is reached.
function plannedEndMs(session) {
  return session.startedAt + session.plannedSessionMinutes * realMsPerSessionMinute(session);
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

// Check a declaration form. Returns a gentle message, or "" if it is fine.
// The app name is required; the purpose needs at least 3 words, which adds
// a moment of honest friction before leaving Chrome.
function validateDeclaration(app, purpose) {
  if (app.trim() === "") {
    return "Enter the app you'll be working in.";
  }
  // split(/\s+/) splits on any run of spaces, like Python's str.split().
  const words = purpose.trim().split(/\s+/).filter(function (word) {
    return word !== "";
  });
  if (words.length < 3) {
    return "Describe what you'll do there in at least 3 words.";
  }
  return "";
}

// Turn text into a whole number that is always the same for the same text.
// This is the plant's "seed": same task + start time means the same plant.
function hashString(text) {
  let hash = 7;
  for (let index = 0; index < text.length; index = index + 1) {
    // charCodeAt gives the character's number, like Python's ord().
    hash = (hash * 31 + text.charCodeAt(index)) % 2147483647;
  }
  return hash;
}

// Clean up something the user typed into a valid allowlist entry, or return null.
// Accepts: docs.google.com, *.instructure.com, a full https:// address,
// a file:/// address, or a Windows path like C:\Users\me\notes.pdf.
function normalizeEntry(rawText) {
  const trimmed = rawText.trim();
  if (trimmed === "") {
    return null;
  }
  const lower = trimmed.toLowerCase();

  // A file URL is kept as a prefix exactly as typed.
  if (lower.startsWith("file:///")) {
    return trimmed;
  }

  // A Windows path (letter, colon, backslash) becomes a file URL.
  // encodeURI turns spaces into %20, which is how Chrome writes file URLs.
  if (/^[a-z]:\\/.test(lower)) {
    const forwardSlashes = trimmed.split("\\").join("/");
    return "file:///" + encodeURI(forwardSlashes);
  }

  // A full web address is reduced to just its hostname.
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    try {
      return new URL(lower).hostname;
    } catch (error) {
      return null; // like Python's except: the text was not a valid URL
    }
  }

  // Otherwise treat it as a host pattern; drop anything after the first "/".
  const hostPart = lower.split("/")[0];
  if (hostPart.includes(" ") || !hostPart.includes(".")) {
    return null;
  }
  return hostPart;
}

// Turn an open tab's URL into the entry "Add from open tabs" should add.
// Web pages give their hostname; local files give their full file:/// URL.
function entryFromUrl(url) {
  if (url.toLowerCase().startsWith("file:///")) {
    return url;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return new URL(url).hostname.toLowerCase();
  }
  return null; // chrome:// pages, the extension's own pages, etc.
}

// Remove a leading "www." so youtube.com and www.youtube.com compare equal.
function withoutWww(hostname) {
  if (hostname.startsWith("www.")) {
    return hostname.slice(4);
  }
  return hostname;
}

// True if a URL matches any allowlist entry. Matching ignores upper/lower case.
function matchesAllowlist(url, allowlist) {
  const lowerUrl = url.toLowerCase();
  let hostname = "";
  if (lowerUrl.startsWith("http://") || lowerUrl.startsWith("https://")) {
    hostname = new URL(lowerUrl).hostname;
  }

  for (const entry of allowlist) {
    const lowerEntry = entry.toLowerCase();
    if (lowerEntry.startsWith("file:///")) {
      // File entries match by prefix, so a folder covers every file inside it.
      if (lowerUrl.startsWith(lowerEntry)) {
        return true;
      }
    } else if (lowerEntry.startsWith("*.")) {
      // *.instructure.com matches instructure.com and any subdomain of it.
      const baseDomain = lowerEntry.slice(2);
      if (hostname === baseDomain || hostname.endsWith("." + baseDomain)) {
        return true;
      }
    } else if (withoutWww(hostname) === withoutWww(lowerEntry)) {
      // "youtube.com" and "www.youtube.com" count as the same site.
      return true;
    }
  }
  return false;
}

// ---- Segment bookkeeping, used by the background engine. ----

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
  const open = current.open;
  // Coming back to Chrome after real (10s+) undeclared time outside it:
  // remember when, so the garden can show its gentle welcome-back message.
  if (open && open.kind === STATE_DETOUR && open.label === OUTSIDE_CHROME_LABEL &&
      atMs - open.start >= GRACE_PERIOD_MS && label !== OUTSIDE_CHROME_LABEL) {
    current.welcomeBackAt = atMs;
  }
  closeOpenSegment(current, atMs);
  current.open = { kind: kind, start: atMs, label: label };
}

// Mark the session as finished at endMs. 
function endSession(current, endMs) {
  closeOpenSegment(current, endMs);
  current.endedAt = endMs;
}

