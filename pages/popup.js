// popup.js: behavior for the toolbar popup.
// "New session" opens the setup screen in a tab.
// "Open garden" opens the garden in a small separate window.

const newSessionButton = document.getElementById("new-session-button");
const openGardenButton = document.getElementById("open-garden-button");

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
