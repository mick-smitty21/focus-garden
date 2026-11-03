// garden.js: draws the garden with p5.js in "instance mode".
// Instance mode means p5 functions are called on an object (p.circle)
// instead of being global (circle). That lets one page hold several
// independent drawings, which the gallery will need later.

// sketch is a function p5 calls once, handing us "p", our p5 instance.
// We attach setup and draw to it, like filling in methods on an object.
const sketch = function (p) {
  // setup runs once at the start.
  p.setup = function () {
    p.createCanvas(400, 560);
  };

  // draw runs about 60 times per second, like a game loop.
  p.draw = function () {
    p.background("#E8F5E9");
    p.noStroke();
    p.fill("#2E7D32");
    p.circle(p.width / 2, p.height / 2, 120); // x, y, diameter
  };
};

// Create the p5 instance and put its canvas inside the #garden-canvas div.
const gardenContainer = document.getElementById("garden-canvas");
new p5(sketch, gardenContainer);
