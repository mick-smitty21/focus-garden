// shared/variation.js: makes each plant look like its own individual.
// getPlantTraits(seed) picks, from the session's seed alone, a flower palette,
// a set of greens, a leaf shape, a stem curvature, and a sway amount. Same seed, same traits,
// every time; a different task or start time gives a different seed and look.

const FLOWER_PALETTES = [
  { name: "Rose", petal: "#F48FB1", center: "#FBC02D" },
  { name: "Sunflower", petal: "#FFCA28", center: "#795548" },
  { name: "Lavender", petal: "#B39DDB", center: "#FFF59D" },
  { name: "Coral", petal: "#FF8A65", center: "#FFF8E1" },
  { name: "Sky", petal: "#81D4FA", center: "#FFEE58" }
];
const LEAF_SHAPES = ["round", "pointed", "fern-like"];

// Sets of greens for the stem, leaves, and leaf veins. All stay clearly
// different from the violet used for declared growth.
const FOLIAGE_PALETTES = [
  { name: "Meadow", stem: "#3B7D3A", leaf: "#66BB6A", vein: "#2E7D32" },
  { name: "Forest", stem: "#2E5E3A", leaf: "#43A047", vein: "#1B5E20" },
  { name: "Sage", stem: "#5B7F5A", leaf: "#9CBF8E", vein: "#4E6E4D" },
  { name: "Spring", stem: "#558B2F", leaf: "#9CCC65", vein: "#33691E" }
];

// Read different "digits" of the seed for each trait, so the traits vary
// independently. % is the remainder (same as Python), Math.floor is like //.
function getPlantTraits(seed) {
  const paletteIndex = seed % FLOWER_PALETTES.length;
  const leafShapeIndex = Math.floor(seed / 5) % LEAF_SHAPES.length;
  const curvatureStep = Math.floor(seed / 15) % 21; // a whole number 0 to 20
  const swayStep = Math.floor(seed / 315) % 11;     // a whole number 0 to 10
  const foliageIndex = Math.floor(seed / 3465) % FOLIAGE_PALETTES.length;
  return {
    palette: FLOWER_PALETTES[paletteIndex],
    foliage: FOLIAGE_PALETTES[foliageIndex],
    leafShape: LEAF_SHAPES[leafShapeIndex],
    curvature: (curvatureStep - 10) / 10, // -1.0 (leans left) to 1.0 (leans right)
    swayAmplitude: 0.5 + swayStep / 10    // 0.5 to 1.5
  };
}

// Draw one leaf of the given shape. The leaf starts at the stem point and
// points up and out to one side (side is 1 for right, -1 for left).
function drawLeaf(p, point, side, grown, scale, leafShape, foliage) {
  const leafLength = 26 * scale * grown;
  p.push(); // save drawing settings, like entering a "with" block
  p.translate(point.x, point.y);
  p.rotate(-Math.PI / 2 + side * Math.PI / 3);
  p.fill(foliage.leaf);
  p.noStroke();

  if (leafShape === "round") {
    p.ellipse(leafLength / 2, 0, leafLength, leafLength * 0.6);
  } else if (leafShape === "pointed") {
    // Two curved edges that meet in a sharp tip.
    p.beginShape();
    p.vertex(0, 0);
    p.quadraticVertex(leafLength * 0.5, -leafLength * 0.32, leafLength * 1.1, 0);
    p.quadraticVertex(leafLength * 0.5, leafLength * 0.32, 0, 0);
    p.endShape(p.CLOSE);
  } else {
    // Fern-like: small leaflets alternating along a thin midrib.
    for (let leaflet = 1; leaflet <= 4; leaflet = leaflet + 1) {
      const alongStem = leafLength * leaflet / 4.5;
      let leafletSide = 1;
      if (leaflet % 2 === 0) {
        leafletSide = -1;
      }
      p.push();
      p.translate(alongStem, 0);
      p.rotate(leafletSide * 0.7);
      p.ellipse(leafLength * 0.13, 0, leafLength * 0.3, leafLength * 0.13);
      p.pop();
    }
  }

  p.stroke(foliage.vein);
  p.strokeWeight(1);
  p.line(0, 0, leafLength * 0.85, 0); // the midrib, on every shape
  p.pop(); // restore settings
}
