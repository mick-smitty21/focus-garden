// popup.js: behavior for the toolbar popup.
// "New session" opens setup in a tab, "Open garden" opens the garden window,
// "Engine debug" opens the debug table, and the declaration form tells the
// engine you are about to work in another desktop app.

const newSessionButton = document.getElementById("new-session-button");
const openGardenButton = document.getElementById("open-garden-button");
const debugButton = document.getElementById("debug-button");
const galleryButton = document.getElementById("gallery-button");
const declareAppInput = document.getElementById("declare-app-input");
const declarePurposeInput = document.getElementById("declare-purpose-input");
const declareButton = document.getElementById("declare-button");
const declareMessage = document.getElementById("declare-message");

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

galleryButton.addEventListener("click", function () {
  chrome.tabs.create({ url: chrome.runtime.getURL("pages/gallery.html") });
  window.close();
});

debugButton.addEventListener("click", function () {
  chrome.tabs.create({ url: chrome.runtime.getURL("pages/debug.html") });
  window.close();
});

// Check the form, then ask the background engine to record the declaration.
declareButton.addEventListener("click", async function () {
  const app = declareAppInput.value.trim();
  const purpose = declarePurposeInput.value.trim();
  const problem = validateDeclaration(app, purpose);
  if (problem !== "") {
    declareMessage.textContent = problem;
    return;
  }
  const stored = await chrome.storage.local.get("current");
  if (!stored.current || stored.current.endedAt) {
    declareMessage.textContent = "Start a session first.";
    return;
  }
  await chrome.runtime.sendMessage({ type: "declare", app: app, purpose: purpose });
  declareMessage.textContent = "Declared for " + DECLARATION_SESSION_MINUTES + " session-minutes. Switch to " + app + " when ready.";
  declareAppInput.value = "";
  declarePurposeInput.value = "";
});
