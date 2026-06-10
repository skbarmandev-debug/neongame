import { Obstacle } from '../types';

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    // Avoid seed 0 causing empty/stuck values
    this.seed = seed <= 0 ? 12345 : seed;
  }

  // Returns a floating point number between 0 (inclusive) and 1 (exclusive)
  next(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  // Returns a range-bound integer
  nextInt(min: number, max: number): number {
    return Math.floor(min + this.next() * (max - min));
  }
}

export function generateObstacles(seed: number, canvasWidth = 900, canvasHeight = 600): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const rng = new SeededRandom(seed);

  // 1. Indestructible boundary walls (these are dealt with standard clamping / rendering, but we can also add them to collision system or let player/bullets check canvas bounds)
  // To avoid redundant logic, let's treat canvas boundaries (0, 0, width, height) explicitly in physics loop with 20px thickness.
  // For the actual inner layout:
  
  // 2. Center cluster: 3 large rectangular blocks
  // Block 1 (Center): horizontal/vertical block
  const centerH = rng.next() > 0.5;
  if (centerH) {
    obstacles.push({ x: canvasWidth / 2 - 100, y: canvasHeight / 2 - 25, w: 200, h: 50, type: 'block' });
  } else {
    obstacles.push({ x: canvasWidth / 2 - 25, y: canvasHeight / 2 - 100, w: 50, h: 200, type: 'block' });
  }

  // Block 2 (Center Left): vertical block
  obstacles.push({
    x: canvasWidth / 4 - 30 + rng.nextInt(-20, 20),
    y: canvasHeight / 2 - 75 + rng.nextInt(-30, 30),
    w: rng.next() > 0.5 ? 40 : 100,
    h: rng.next() > 0.5 ? 120 : 40,
    type: 'block'
  });

  // Block 3 (Center Right): vertical/horizontal block
  obstacles.push({
    x: (canvasWidth * 3) / 4 - 50 + rng.nextInt(-20, 20),
    y: canvasHeight / 2 - 75 + rng.nextInt(-30, 30),
    w: rng.next() > 0.5 ? 100 : 40,
    h: rng.next() > 0.5 ? 40 : 120,
    type: 'block'
  });

  // 3. Medium L-shaped walls in corners (4)
  // Top-Left L
  obstacles.push({ x: 140, y: 120, w: 100, h: 30, type: 'wall' });
  obstacles.push({ x: 140, y: 120, w: 30, h: 100, type: 'wall' });

  // Top-Right L
  obstacles.push({ x: canvasWidth - 240, y: 120, w: 100, h: 30, type: 'wall' });
  obstacles.push({ x: canvasWidth - 170, y: 120, w: 30, h: 100, type: 'wall' });

  // Bottom-Left L
  obstacles.push({ x: 140, y: canvasHeight - 150, w: 100, h: 30, type: 'wall' });
  obstacles.push({ x: 140, y: canvasHeight - 220, w: 30, h: 100, type: 'wall' });

  // Bottom-Right L
  obstacles.push({ x: canvasWidth - 240, y: canvasHeight - 150, w: 100, h: 30, type: 'wall' });
  obstacles.push({ x: canvasWidth - 170, y: canvasHeight - 220, w: 30, h: 100, type: 'wall' });

  // 4. Five small pillars scattered randomly
  // Let's divide map into sectors and place pillars to avoid overlap with existing zones or spawn zones
  const spawnSpacing = 160; // players spawn at 4 corners
  const sectors = [
    { minX: spawnSpacing, maxX: canvasWidth / 2 - 100, minY: spawnSpacing, maxY: canvasHeight / 2 - 80 },
    { minX: canvasWidth / 2 + 100, maxX: canvasWidth - spawnSpacing, minY: spawnSpacing, maxY: canvasHeight / 2 - 80 },
    { minX: spawnSpacing, maxX: canvasWidth / 2 - 100, minY: canvasHeight / 2 + 80, maxY: canvasHeight - spawnSpacing },
    { minX: canvasWidth / 2 + 100, maxX: canvasWidth - spawnSpacing, minY: canvasHeight / 2 + 80, maxY: canvasHeight - spawnSpacing },
    { minX: canvasWidth / 2 - 120, maxX: canvasWidth / 2 + 120, minY: 100, maxY: 180 }
  ];

  sectors.forEach((sector) => {
    const px = rng.nextInt(sector.minX, sector.maxX - 30);
    const py = rng.nextInt(sector.minY, sector.maxY - 30);
    obstacles.push({
      x: px,
      y: py,
      w: 30,
      h: 30,
      type: 'pillar'
    });
  });

  return obstacles;
}

// Fixed Spawn positions for the 4 players based on corner placements
export function getSpawnPosition(playerId: number, canvasWidth = 900, canvasHeight = 600): { x: number; y: number } {
  // Pad spawn points by offset to stay safely clear of boundary walls (20px thick)
  const offset = 60;
  switch (playerId) {
    case 1:
      return { x: offset, y: offset }; // Top-Left
    case 2:
      return { x: canvasWidth - offset, y: canvasHeight - offset }; // Bottom-Right
    case 3:
      return { x: canvasWidth - offset, y: offset }; // Top-Right
    case 4:
      return { x: offset, y: canvasHeight - offset }; // Bottom-Left
    default:
      return { x: canvasWidth / 2, y: canvasHeight / 2 };
  }
}
