// background.js: the extension's background "service worker".
// Chrome runs this file behind the scenes, separate from any page.
// In Stage 0 it only logs that it started. Stage 2 turns it into the
// tracking engine that decides focus / detour / declared / neutral.

// chrome.runtime.onInstalled fires once when the extension is installed or reloaded.
// addListener registers a callback, like passing a function to a Python event system.
chrome.runtime.onInstalled.addListener(function () {
  console.log("Focus Garden installed or reloaded.");
});
