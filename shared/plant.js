// shared/plant.js: drawPlant(p, session, nowMs, options) draws one plant with p5.
// Needs shared/rules.js and shared/variation.js loaded first.
// The plant is rebuilt from scratch from the session's segments on every call,
// using the session's seed for all randomness, so the same segments always give
// the same plant: live, in the summary, and in the gallery.

const PLANT_COLORS = {
  skyTop: "#E3F2FD",
  skyBottom: "#F1F8E9",
  declared: "#6A1B9A",
  knot: "#D7CCC8",       // light bark fill: a growth node, not a dark lump
  knotRing: "#8D6E63",   // darker bark outline
  pot: "#B5651D",
  potRim: "#8D4A16"
};

const STEP_MINUTES = 0.25;        // the stem is built in quarter-minute steps
const LEAF_EVERY_MINUTES = 2;     // one leaf per 2 focus session-minutes
const FLOWER_EVERY_MINUTES = 10;  // one flower per 10 unbroken focus minutes
const GROW_IN_MS = 1500;          // new leaves and flowers ease in over 1.5 seconds

// All segments to draw: the finished ones plus the open one, cut off at "now"
// (or at the planned end, so the plant never grows past the session length).
function collectSegments(session, nowMs) {
  const segments = session.segments.slice(); // .slice() copies a list, like list[:]
  if (session.open && !session.endedAt) {
    const end = Math.min(nowMs, plannedEndMs(session));
    let kind = session.open.kind;
    // An open detour under 10 seconds may still turn out to be a glance: draw nothing yet.
    if (kind === STATE_DETOUR && end - session.open.start < GRACE_PERIOD_MS) {
      kind = STATE_NEUTRAL;
    }
    // If a declaration has run out but the engine has not noticed yet (it checks
    // every 30 seconds), draw the time after expiry as a detour, as the engine will.
    const declaration = session.declaration;
    if (kind === STATE_DECLARED && declaration && end > declaration.expiresAt) {
      segments.push({ kind: STATE_DECLARED, start: session.open.start, end: declaration.expiresAt, label: session.open.label });
      if (end - declaration.expiresAt >= GRACE_PERIOD_MS) {
        segments.push({ kind: STATE_DETOUR, start: declaration.expiresAt, end: end, label: OUTSIDE_CHROME_LABEL });
      }
    } else if (end > session.open.start) {
      segments.push({ kind: kind, start: session.open.start, end: end, label: session.open.label });
    }
  }
  return segments;
}

// Walk through the segments and work out where every stem point, leaf, knot,
// and flower goes. Draws nothing; returns plain data (lists of dicts).
function buildPlant(p, session, nowMs, width, height) {
  p.randomSeed(session.seed); // same seed, same "random" numbers, every time
  const traits = getPlantTraits(session.seed);
  const realMsPerMinute = 60000 / session.timeScale;
  const potTopY = height * 0.9;
  const pixelsPerFocusMinute = 0.85 * height / session.plannedSessionMinutes;

  const plant = { points: [], leaves: [], knots: [], flowers: [], potTopY: potTopY };
  let x = width / 2;
  let y = potTopY;
  let angle = -Math.PI / 2; // heading in radians; -90 degrees points straight up
  plant.points.push({ x: x, y: y, kind: STATE_FOCUS });

  let kinkDirection = 1;
  if (p.random() < 0.5) {
    kinkDirection = -1;
  }
  let focusMinutesTotal = 0;   // all focus so far (for leaves)
  let stretchMinutes = 0;      // focus since the last detour or declaration (for flowers)
  let flowersInStretch = 0;

  for (const segment of collectSegments(session, nowMs)) {
    const minutes = (segment.end - segment.start) / realMsPerMinute;

    if (segment.kind === STATE_DETOUR) {
      // A detour bends the stem and leaves a knot; growth continues past it later.
      const kinkDegrees = Math.min(40, 8 + 4 * minutes);
      angle = angle + kinkDirection * kinkDegrees * Math.PI / 180;
      kinkDirection = -kinkDirection; // the next detour bends the other way
      plant.knots.push({ pointIndex: plant.points.length - 1, radius: Math.min(12, 3 + minutes) });
      stretchMinutes = 0;
      flowersInStretch = 0;
      continue;
    }
    if (segment.kind === STATE_NEUTRAL) {
      continue; // neutral grows nothing and marks nothing (and does not break a stretch)
    }

    let pixelsPerMinute = pixelsPerFocusMinute;
    if (segment.kind === STATE_DECLARED) {
      pixelsPerMinute = pixelsPerFocusMinute / 2; // declared time grows at half speed
      stretchMinutes = 0;
      flowersInStretch = 0;
    }

    let minutesDone = 0;
    while (minutesDone < minutes) {
      const stepMinutes = Math.min(STEP_MINUTES, minutes - minutesDone);
      minutesDone = minutesDone + stepMinutes;
      const stepFraction = stepMinutes / STEP_MINUTES;

      // Small seeded wobble, then a slow pull back toward straight up,
      // so a kink stays visible for a while before the stem straightens.
      angle = angle + p.random(-0.05, 0.05) * stepFraction;
      angle = angle + traits.curvature * 0.006 * stepFraction; // this plant's lean
      angle = angle + (-Math.PI / 2 - angle) * 0.025 * stepFraction;

      x = x + Math.cos(angle) * pixelsPerMinute * stepMinutes;
      y = y + Math.sin(angle) * pixelsPerMinute * stepMinutes;
      x = Math.min(width * 0.9, Math.max(width * 0.1, x)); // stay inside the canvas
      y = Math.max(height * 0.03, y);
      plant.points.push({ x: x, y: y, kind: segment.kind });

      if (segment.kind !== STATE_FOCUS) {
        continue;
      }
      // The real moment this bit of stem grew, used to ease new leaves and flowers in.
      const bornAt = segment.start + minutesDone * realMsPerMinute;
      const pointIndex = plant.points.length - 1;
      focusMinutesTotal = focusMinutesTotal + stepMinutes;
      stretchMinutes = stretchMinutes + stepMinutes;

      if (Math.floor(focusMinutesTotal / LEAF_EVERY_MINUTES) > plant.leaves.length) {
        let side = 1;
        if (plant.leaves.length % 2 === 1) {
          side = -1; // alternate left and right
        }
        plant.leaves.push({ pointIndex: pointIndex, side: side, bornAt: bornAt });
      }
      if (Math.floor(stretchMinutes / FLOWER_EVERY_MINUTES) > flowersInStretch) {
        flowersInStretch = flowersInStretch + 1;
        plant.flowers.push({ pointIndex: pointIndex, bornAt: bornAt });
      }
    }
  }
  return plant;
}

// How grown a new leaf or flower is: 0 just born, 1 fully grown (eased).
function growScale(bornAt, nowMs, animate) {
  if (!animate) {
    return 1;
  }
  const progress = Math.min(1, Math.max(0, (nowMs - bornAt) / GROW_IN_MS));
  return 1 - (1 - progress) * (1 - progress); // fast start, soft finish
}

function drawSky(p, width, height) {
  const top = p.color(PLANT_COLORS.skyTop);
  const bottom = p.color(PLANT_COLORS.skyBottom);
  p.strokeWeight(2);
  for (let lineY = 0; lineY < height; lineY = lineY + 2) {
    p.stroke(p.lerpColor(top, bottom, lineY / height)); // blend between the two colors
    p.line(0, lineY, width, lineY);
  }
}

function drawPot(p, width, height, potTopY, scale) {
  const centerX = width / 2;
  p.noStroke();
  p.fill(PLANT_COLORS.pot);
  p.quad(centerX - 30 * scale, potTopY, centerX + 30 * scale, potTopY,
         centerX + 21 * scale, height - 4 * scale, centerX - 21 * scale, height - 4 * scale);
  p.fill(PLANT_COLORS.potRim);
  p.rect(centerX - 34 * scale, potTopY - 4 * scale, 68 * scale, 9 * scale, 3 * scale);
}

function drawFlower(p, point, grown, scale, palette) {
  const petalSize = 14 * scale * grown;
  p.noStroke();
  p.fill(palette.petal);
  for (let petal = 0; petal < 5; petal = petal + 1) {
    const petalAngle = petal * Math.PI * 2 / 5;
    p.circle(point.x + Math.cos(petalAngle) * petalSize * 0.7, point.y + Math.sin(petalAngle) * petalSize * 0.7, petalSize);
  }
  p.fill(palette.center);
  p.circle(point.x, point.y, petalSize * 0.7);
}

// Draw white dashes along each declared stretch, so it can be told apart
// from focus growth without relying on color. Each stretch is drawn as one
// continuous line; drawing it in tiny pieces would restart the dash pattern.
function drawDeclaredDashes(p, shown, scale) {
  p.noFill();
  p.stroke("#FFFFFF");
  p.strokeWeight(2 * scale);
  p.drawingContext.setLineDash([5 * scale, 5 * scale]); // the raw canvas dash setting
  let insideStretch = false;
  for (let index = 1; index < shown.length; index = index + 1) {
    const isDeclared = shown[index].kind === STATE_DECLARED;
    if (isDeclared && !insideStretch) {
      p.beginShape(); // start one continuous line
      p.vertex(shown[index - 1].x, shown[index - 1].y);
      insideStretch = true;
    }
    if (isDeclared) {
      p.vertex(shown[index].x, shown[index].y);
    }
    if (!isDeclared && insideStretch) {
      p.endShape();
      insideStretch = false;
    }
  }
  if (insideStretch) {
    p.endShape();
  }
  p.drawingContext.setLineDash([]); // back to solid lines
}

// The main entry point. options = { width, height, animate }.
function drawPlant(p, session, nowMs, options) {
  const width = options.width;
  const height = options.height;
  const scale = height / 560; // sizes are designed for a 560-pixel-tall canvas
  const plant = buildPlant(p, session, nowMs, width, height);
  const traits = getPlantTraits(session.seed);
  p.noiseSeed(session.seed);

  // Display positions: the built points plus sway. Sway is only an offset for
  // drawing; it never changes the plant's structure. Higher points sway more.
  const shown = [];
  for (const point of plant.points) {
    let offsetX = 0;
    if (options.animate) {
      const heightFraction = (plant.potTopY - point.y) / plant.potTopY;
      offsetX = (p.noise(point.y * 0.01, p.frameCount * 0.008) - 0.5) * 18 * scale * heightFraction * traits.swayAmplitude;
    }
    shown.push({ x: point.x + offsetX, y: point.y, kind: point.kind });
  }

  drawSky(p, width, height);

  // Stem: thick at the bottom, thinner toward the top. Declared stretches are violet.
  p.strokeCap(p.ROUND);
  for (let index = 1; index < shown.length; index = index + 1) {
    const from = shown[index - 1];
    const to = shown[index];
    p.strokeWeight(p.map(to.y, plant.potTopY, 0, 9, 4) * scale);
    if (to.kind === STATE_DECLARED) {
      p.stroke(PLANT_COLORS.declared);
    } else {
      p.stroke(traits.foliage.stem);
    }
    p.line(from.x, from.y, to.x, to.y);
  }
  drawDeclaredDashes(p, shown, scale);

  for (const leaf of plant.leaves) {
    drawLeaf(p, shown[leaf.pointIndex], leaf.side, growScale(leaf.bornAt, nowMs, options.animate), scale, traits.leafShape, traits.foliage);
  }
  p.fill(PLANT_COLORS.knot);
  p.stroke(PLANT_COLORS.knotRing);
  p.strokeWeight(2.5 * scale);
  for (const knot of plant.knots) {
    const point = shown[knot.pointIndex];
    p.circle(point.x, point.y, knot.radius * 2 * scale);
  }
  for (const flower of plant.flowers) {
    drawFlower(p, shown[flower.pointIndex], growScale(flower.bornAt, nowMs, options.animate), scale, traits.palette);
  }
  drawPot(p, width, height, plant.potTopY, scale);
}
