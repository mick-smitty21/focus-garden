// shared/rules.js: constants and helper functions shared by every part of the extension.
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
    } else if (hostname === lowerEntry) {
      return true;
    }
  }
  return false;
}
