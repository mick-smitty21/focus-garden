// popup.js: behavior for the toolbar popup.
// "New session" opens the setup screen in a tab.
// "Open garden" opens the garden in a small separate window.
// "Engine debug" opens the debug table used to test tracking.

const newSessionButton = document.getElementById("new-session-button");
const openGardenButton = document.getElementById("open-garden-button");
const debugButton = document.getElementById("debug-button");

newSessionButton.addEventListener("click", function () {
  // chrome.runtime.getURL turns a path inside the extension into a full address.
  chrome.tabs.create({ url: chrome.runtime.getURL("pages/setup.html") });
  window.close(); // close the popup so it doesn't linger
});

openGardenButton.addEventListener("click", function () {
  chrome.windows.create({
    url: chrome.runtime.getURL("pages/garden.html"),
    type: "popup",
    width: 420,
    height: 680
  });
  window.close();
});

debugButton.addEventListener("click", function () {
  chrome.tabs.create({ url: chrome.runtime.getURL("pages/debug.html") });
  window.close();
});
