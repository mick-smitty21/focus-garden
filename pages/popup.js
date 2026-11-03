// popup.js: behavior for the toolbar popup.
// When the "Open garden" button is clicked, open garden.html in a new tab.

// document.getElementById finds one HTML element by its id, like a dict lookup by key.
const openGardenButton = document.getElementById("open-garden-button");

// Register a function to run when the button is clicked (a callback).
openGardenButton.addEventListener("click", function () {
  // chrome.runtime.getURL turns a path inside the extension into a full
  // chrome-extension://<id>/pages/garden.html address.
  const gardenUrl = chrome.runtime.getURL("pages/garden.html");
  chrome.tabs.create({ url: gardenUrl });
  window.close(); // close the popup so it doesn't linger
});
