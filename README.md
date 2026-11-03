# Focus Garden

Focus apps like Forest and Florodoro treat distraction as failure: Forest withers your tree if you leave, and Florodoro grows a flower that has nothing to do with how you actually worked. Focus Garden is a Chrome extension that grows a plant whose shape **is** the record of your session. You allowlist the sites and files your task needs. Time on them grows the stem, leaves, and flowers. Time off them leaves a visible kink and knot that the plant keeps growing past. Declared time in other desktop apps grows its own violet, dashed segment. Nothing dies and nothing is a penalty: detours are part of the plant's story. It is built for students with ADHD, for whom "you failed" mechanics often make it harder to start again.

- **Buildathon path:** Useful ("I wish this already existed")
- **Approved tool:** p5.js (1.11.11), used in instance mode to draw every plant: the live garden, the summary, and each gallery thumbnail

## Install

1. Download this repository (green **Code** button, then **Download ZIP**, and unzip it) or clone it:
   `git clone https://github.com/mick-smitty21/focus-garden.git`
2. In Chrome, go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the `focus-garden` folder (the one containing `manifest.json`).
5. Optional, for local files such as PDFs: click **Details** on Focus Garden and turn on **Allow access to file URLs**.
6. Pin Focus Garden from the puzzle-piece menu so its icon and badge stay visible.

## How to use

- **Setup:** click the toolbar icon, then **New session**. Name your task, add allowlist entries by typing them (`docs.google.com`, `*.instructure.com`, or a file path) or with **Add from open tabs**, and choose a length (15 to 180 minutes).
- **Session:** **Start session** opens the garden in a small window you can keep beside your work. The toolbar badge shows minutes left, colored by state: green for focus, yellow for detour, purple for declared, grey for neutral.
- **Declarations:** before working in another desktop app (VS Code, Word, a calculator app), use **Working in another app** in the popup or the garden. Enter the app and at least three words about what you will do. A declaration lasts 25 minutes.
- **Demo mode:** the **Demo mode (10x speed)** checkbox makes a 15-minute session finish in 90 seconds. The garden shows a **DEMO MODE 10x** tag.
- **Summary:** when time is up (or you click **End session**) the garden shows the final plant, a timeline strip, totals, where detours went, your declarations, and **Save as PNG**.
- **Gallery:** every finished session appears in **Gallery** as a small plant. Click one to see its summary.

## How it works

Every moment of a session is in exactly one state:

| State | When | What the plant does |
|---|---|---|
| Focus | The active tab matches your allowlist | Stem grows; a leaf every 2 minutes; a flower after each 10 unbroken minutes |
| Detour | The active tab is off the allowlist, or Chrome lost focus with no declaration | No growth; a kink (8 + 4 per minute, up to 40 degrees) and a knot that the stem later grows past |
| Declared | Chrome lost focus while a declaration is active | Stem grows at half speed, in violet with white dashes |
| Neutral | The extension's own pages, or the screen is locked | Nothing grows, nothing is marked |

- **Grace period:** a detour shorter than 10 real seconds is recorded as neutral, so a quick glance never marks the plant.
- **Built from data:** the plant is redrawn from the list of recorded segments every frame, using a seed made from the task name and start time. The same session always produces the same plant: live, in the summary, and in the gallery.
- **Variation:** the seed also picks one of 5 flower palettes, 4 sets of greens, 3 leaf shapes, a lean, and a sway strength.
- **Reliability:** Chrome stops extension background scripts after about 30 seconds of inactivity, so all session data is saved to `chrome.storage.local` after every change, and all times are computed from saved timestamps.

## Known limitations

- A Chrome extension cannot see which desktop app is open, so declarations are honor-based. The required app name and three-word purpose add friction to keep them honest.
- Incognito tabs are not tracked.
- Chrome only.
- Allowlist matching uses hostnames, so `youtube.com` covers `www.youtube.com` but not `music.youtube.com` (use `*.youtube.com` for that).

## Files

- `manifest.json`: extension configuration and permissions (`tabs`, `storage`, `alarms`, `idle`)
- `background.js`: the tracking engine
- `shared/rules.js`: states, colors, allowlist matching, segment bookkeeping
- `shared/plant.js`: `drawPlant`, the p5 drawing of a plant from its segments
- `shared/variation.js`: seeded flower palettes, greens, leaf shapes, lean, sway
- `pages/`: setup, garden (live and summary), summary helpers, popup, gallery, debug
- `lib/p5.min.js`: p5.js 1.11.11, bundled locally (extensions cannot load remote scripts), with its license in `lib/p5-LICENSE.txt`

## Credits

Built for a university buildathon. AI assistance and third-party resources are disclosed in [AI_DISCLOSURE.md](AI_DISCLOSURE.md).
