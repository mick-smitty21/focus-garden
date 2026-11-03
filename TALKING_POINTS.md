# Talking Points (draft, revise in your own words)

## Opening line

"I'm on the Useful path, and my approved tool is p5.js. I built Focus Garden, a Chrome extension that grows a plant whose shape is a record of how you actually focused, including the detours."

## Video outline (target 7 to 8 minutes)

| Time | Section | What to show |
|---|---|---|
| 0:00 to 0:40 | Opening and the problem | Opening line. Forest kills your tree when you leave; for students with ADHD, that "you failed" moment makes it harder to start again. |
| 0:40 to 1:10 | The twist | One sentence: the plant's shape is the data. Show a finished plant with a knot and a flower. |
| 1:10 to 5:00 | Live demo (shot list below) | Demo mode throughout. |
| 5:00 to 6:00 | How it works | Walk the file layout briefly: background engine, rules, `drawPlant`, instance mode. Show the debug table for 10 seconds. |
| 6:00 to 7:15 | The three questions | Answers below. |
| 7:15 to 7:45 | Closing | Real-world uses line. |

## Live demo shot list (demo mode)

1. **Setup with "Add from open tabs."** Have Google Docs, Canvas, and YouTube open. Name the task, click **Add from open tabs**, check Docs and Canvas only. Point out the file-access line. Check **Demo mode (10x speed)**, set 45 minutes, **Start session**.
2. **Focus growth.** Work in the Docs tab for about 40 seconds. Show the stem rising and leaves easing in; point at the green badge and "DEMO MODE 10x" tag.
3. **A detour and its kink.** Switch to YouTube. Say: "For the first 10 seconds nothing happens; that's the grace period." After about 20 seconds, show the kink and knot. Go back to Docs: "The stem grows right past it."
4. **A declaration.** Open the popup, show that "notes" is rejected (needs three words), then declare `VS Code` / `writing lab notes`. Click into VS Code for about 20 seconds; show violet dashed growth and the purple badge.
5. **The summary.** Click **End session** (or let time run out). Read the headline ("Your plant grew through 1 detour"), point at the timeline strip, totals, top detour, and the declaration.
6. **PNG export.** Click **Save as PNG** and open the file.
7. **The gallery.** Open **Gallery** with three plants from different sessions (prepare them beforehand). Point out different flower colors, greens, and leaf shapes, and that each shape reflects how that session went. Click one to reopen its summary.

Before recording: clear old test sessions (in the gallery's console: `chrome.storage.local.remove("history")`), then make three varied demo sessions for the gallery shot.

## Draft answers to the three required questions

### 1. What I built, what to notice, and which choices most shaped it

I built a Chrome extension where a p5.js plant grows from a record of your focus session. Notice that the plant is rebuilt from the session data on every frame: leaves are focus minutes, flowers are 10-minute unbroken stretches, and every kink and knot is a real detour the plant grew past. Three choices shaped it most: (a) an allowlist of what my task needs, instead of a blocklist of distractions, so focus is defined by the task; (b) treating distraction as a "detour" that stays in the plant's story, never a failure; and (c) the "working in another app" declaration, because a browser can't see my desktop apps, so honesty is supported with a bit of friction instead of surveillance.

### 2. How it fulfills the Useful path for students with ADHD

Most focus apps punish the exact moment an ADHD brain drifts: the tree dies, the streak resets, and the easiest response is to stop using the app. Focus Garden keeps everything you grew and shows detours as part of the shape, which makes it safe to start again after getting distracted. The 10-second grace period forgives quick glances, the welcome-back message is neutral instead of scolding, and the gallery shows a pattern over time without scores or streaks. I wanted this to exist, and it is something I can use for my own classes.

### 3. What I discovered, learned, or changed while building

- Coming in with zero JavaScript, I learned it by mapping it onto Python: objects are dicts, arrays are lists, `addEventListener` is registering a callback, and `async/await` works like asyncio.
- I learned that Chrome stops an extension's background script after about 30 seconds, so the engine can never keep anything in memory; it saves after every change and calculates time from timestamps.
- Changes I made while testing: matching `youtube.com` and `www.youtube.com` as the same site, softening the detour knot because a dark lump looked like rot (the opposite of my no-shame goal), and adding varied greens so gallery plants look like individuals.
- **[Fill in: a bug I hit and how I found it]** (example: after Stage 2 nothing was tracked, because Chrome was still running the old background script until I clicked Reload on chrome://extensions.)
- **[Fill in: what surprised me]**
- **[Fill in: something I would do differently, or a future feature]** (ideas: a "Clear gallery" button with confirmation, weekly patterns in the gallery.)
- **[Fill in, optional: forgetting the Stage 6 commit and what it taught me about small commits]**

## Closing line on real-world uses

"Beyond this buildathon, Focus Garden could help any student or remote worker see how their focus really goes, help a tutor or ADHD coach talk about patterns without judgment, and give someone a picture of their week that encourages them instead of grading them."
