const fs = require('fs');

const file = 'artifacts/smart-water/src/data/zonasiData.ts';
let content = fs.readFileSync(file, 'utf-8');

// The original script had squares defined like:
// coordinates: [[ [116.27, -8.70], ... ]]
// We will replace them.
// First, let's extract the center from the first point of the square.

// To make it look like a map, let's generate a Voronoi-like or Hexagon-like shape.
function createBlob(cx, cy, radius, numPoints) {
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    // Add some random noise to radius to make it look organic
    const r = radius * (0.8 + Math.random() * 0.4); 
    // Wait, purely random noise might make adjacent polygons overlap badly.
    // If they overlap, it's okay for a dummy map, it looks like a sketchy map, but hexes tile perfectly!
    points.push([
      cx + Math.cos(angle) * radius, // longitude
      cy + Math.sin(angle) * radius  // latitude
    ]);
  }
  points.push(points[0]); // close the polygon
  return [points];
}

// Actually, I can use a predefined set of interlocking polygons I generate right here.
// Let's create a regular grid of hexagons! Hexagons look very professional and tile perfectly!
// A hexagon grid looks like a "peta sebaran" (distribution map / hexbin map).
// Center: Praya is around -8.7, 116.3
// Let's make 12 hexagons.

const hexRadius = 0.025; // approx 2.5km
const hexWidth = Math.sqrt(3) * hexRadius;
const hexHeight = 2 * hexRadius;

function getHexCoords(cx, cy) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle_deg = 60 * i - 30;
    const angle_rad = Math.PI / 180 * angle_deg;
    pts.push([cx + hexRadius * Math.cos(angle_rad), cy + hexRadius * Math.sin(angle_rad)]);
  }
  pts.push(pts[0]);
  return [pts];
}

// 12 centers in a grid
const centers = [
  [0, 0], [1, 0], [2, 0], [3, 0],
  [0.5, 1], [1.5, 1], [2.5, 1],
  [0, 2], [1, 2], [2, 2], [3, 2],
  [1.5, 3]
];

const startX = 116.23;
const startY = -8.65;

const newCoords = centers.map(c => {
  const cx = startX + c[0] * hexWidth;
  const cy = startY - c[1] * hexHeight * 0.75;
  return getHexCoords(cx, cy);
});

// Let's replace the coordinates in the file.
let matchCount = 0;
content = content.replace(/coordinates:\s*\[\[[\s\S]*?\]\]/g, (match) => {
  const replacement = `coordinates: ${JSON.stringify(newCoords[matchCount])}`;
  matchCount++;
  return replacement;
});

fs.writeFileSync(file, content);
console.log('Replaced ' + matchCount + ' coordinates with hexagons!');
