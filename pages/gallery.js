// gallery.js: builds the gallery grid from "history" in storage.
// For each past session it makes a card with its own small p5 instance
// (this is why the project uses instance mode) and draws the plant once.

const THUMBNAIL_WIDTH = 180;
const THUMBNAIL_HEIGHT = 250;
const galleryGrid = document.getElementById("gallery-grid");

// Make a p5 sketch that draws one session's plant a single time.
// Returning a function from a function is like a Python closure: the inner
// function remembers "pastSession" even after makeThumbnailSketch returns.
function makeThumbnailSketch(pastSession) {
  return function (p) {
    p.setup = function () {
      p.createCanvas(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
      p.noLoop(); // a still picture: draw once instead of 60 times a second
    };
    p.draw = function () {
      drawPlant(p, pastSession, pastSession.endedAt, {
        width: THUMBNAIL_WIDTH,
        height: THUMBNAIL_HEIGHT,
        animate: false
      });
    };
  };
}

// Open a past session's summary in the garden window.
// "?session=<id>" tells garden.js to show that session from history.
function openSummary(sessionId) {
  chrome.windows.create({
    url: chrome.runtime.getURL("pages/garden.html?session=" + encodeURIComponent(sessionId)),
    type: "popup",
    width: 420,
    height: 760
  });
}

async function buildGallery() {
  const stored = await chrome.storage.local.get("history");
  const history = stored.history || [];
  if (history.length === 0) {
    galleryGrid.textContent = "No plants yet. Finish a session and it will appear here.";
    return;
  }
  for (const pastSession of history) {
    const card = document.createElement("div");
    card.className = "thumbnail";
    const canvasHolder = document.createElement("div");
    const taskLine = document.createElement("div");
    taskLine.className = "thumbnail-task";
    taskLine.textContent = pastSession.task;
    const dateLine = document.createElement("div");
    dateLine.className = "thumbnail-date";
    dateLine.textContent = new Date(pastSession.startedAt).toLocaleString();
    card.appendChild(canvasHolder);
    card.appendChild(taskLine);
    card.appendChild(dateLine);
    card.addEventListener("click", function () {
      openSummary(pastSession.id);
    });
    galleryGrid.appendChild(card);
    new p5(makeThumbnailSketch(pastSession), canvasHolder); // one p5 instance per card
  }
}

buildGallery();
