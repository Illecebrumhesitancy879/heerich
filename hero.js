import { Heerich } from "./src/heerich.js";

export function initHero(container, getCamera, getReservedZone = null) {
  let animationId = 0;
  let holes = [];
  let scene = null; // { engine, holes with targetDepth }

  function rand(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function buildScene(depths, towerHeights = null) {
    const cam = getCamera();
    const availW = container.clientWidth;
    const availH = container.clientHeight;
    const gridPct = scene.gridPct;
    const gridSize = Math.round((availW * gridPct) / 100);
    const cols = Math.ceil(availW / gridSize);
    const rows = Math.ceil(availH / gridSize);
    
    // Get dynamic reserved zone in grid coordinates
    let reservedZone = null;
    if (getReservedZone) {
      const zone = getReservedZone();
      if (zone) {
        reservedZone = {
          x: Math.floor(zone.x / gridSize),
          y: Math.floor(zone.y / gridSize),
          w: Math.ceil(zone.width / gridSize),
          h: Math.ceil(zone.height / gridSize),
        };
      }
    }

    const e = new Heerich({
      tile: [gridSize, gridSize],
      camera: cam,
      style: {
        fill: "var(--fill)",
        stroke: "var(--stroke-c)",
        strokeWidth: "var(--stroke-w)",
      },
    });

    // Solid slab — deep enough for all holes, with cutout for reserved zone
    const maxDepth = Math.max(...depths.map((d) => Math.round(d)), 1);
    e.addWhere({
      bounds: [
        [0, 0, 0],
        [cols, rows, maxDepth],
      ],
      test: (x, y, z) => {
        // Skip entire area below reserved zone if provided (e.g., title area)
        if (reservedZone && 
            x >= reservedZone.x && x < reservedZone.x + reservedZone.w &&
            y >= reservedZone.y) {
          return false;
        }
        return true;
      },
    });

    // Carve holes
    scene.holes.forEach((h, i) => {
      const d = Math.round(depths[i]);
      if (d > 0) {
        e.removeBox({ position: [h.x, h.y, 0], size: [h.w, h.h, d] });
      }
    });

    // Style colored walls (depth gradient from surface to random color)
    if (scene.colorWalls) {
      const maxD = Math.max(...depths, 1);
      scene.holes.forEach((h, i) => {
        const d = Math.round(depths[i]);
        if (d <= 0) return;
        for (let z = 0; z < d; z++) {
          const t = z / maxD;
          const r = Math.round(scene.color[0] * t * 255);
          const g = Math.round(scene.color[1] * t * 255);
          const b = Math.round(scene.color[2] * t * 255);
          e.styleBox({
            position: [h.x, h.y, z],
            size: [h.w, h.h, 1],
            style: {
              left: { fill: `rgb(${r},${g},${b})` },
              right: { fill: `rgb(${r},${g},${b})` },
              top: { fill: `rgb(${r},${g},${b})` },
              bottom: { fill: `rgb(${r},${g},${b})` },
              back: { fill: `rgb(${r},${g},${b})` },
            },
          });
        }
      });
    }

    // Add towers if provided (skip those below reserved zone)
    if (towerHeights && scene.towers) {
      scene.towers.forEach((tower, idx) => {
        const currentHeight = Math.round(towerHeights[idx]);
        if (currentHeight > 0) {
          // Skip towers in or below reserved zone
          if (reservedZone && 
              tower.x >= reservedZone.x && tower.x < reservedZone.x + reservedZone.w &&
              tower.y >= reservedZone.y) {
            return;
          }
          
          const holeDepth = Math.round(depths[tower.holeIndex]);
          const towerStartZ = holeDepth - currentHeight;
          e.addBox({ 
            position: [tower.x, tower.y, towerStartZ], 
            size: [1, 1, currentHeight] 
          });
        }
      });
    }

    return e.toSVG({
      padding: 30,
      faceAttributes: () => ({ "vector-effect": "non-scaling-stroke" }),
    });
  }

  function randomizeScene() {
    const gridPct = rand(5, 10);
    const availW = container.clientWidth;
    const availH = container.clientHeight;
    const gridSize = Math.round((availW * gridPct) / 100);
    const cols = Math.ceil(availW / gridSize);
    const rows = Math.ceil(availH / gridSize);

    const numHoles = rand(1, 3);
    const numSmallHoles = rand(0, 2);
    const holes = [];

    for (let i = 0; i < numHoles; i++) {
      const minPct = numHoles === 1 ? 0.4 : 0.1;
      const maxPct = numHoles === 1 ? 0.7 : 0.6;
      const w = Math.max(
        2,
        Math.floor(cols * (minPct + Math.random() * (maxPct - minPct))),
      );
      const h = Math.max(
        2,
        Math.floor(rows * (minPct + Math.random() * (maxPct - minPct))),
      );
      const x = Math.floor(Math.random() * Math.max(1, cols - w));
      const y = Math.floor(Math.random() * Math.max(1, rows - h));
      const targetDepth = rand(6, 20);
      holes.push({ x, y, w, h, targetDepth });
    }

    for (let i = 0; i < numSmallHoles; i++) {
      const w = Math.max(1, Math.floor(cols * (0.05 + Math.random() * 0.15)));
      const h = Math.max(1, Math.floor(rows * (0.05 + Math.random() * 0.15)));
      const x = Math.floor(Math.random() * Math.max(1, cols - w));
      const y = Math.floor(Math.random() * Math.max(1, rows - h));
      const targetDepth = rand(4, 14);
      holes.push({ x, y, w, h, targetDepth });
    }

    const color = [Math.random(), Math.random(), Math.random()];
    const m = Math.max(...color);
    if (m > 0) color.forEach((_, i) => (color[i] /= m));

    // Generate towers for each hole
    const towers = [];
    holes.forEach((h, holeIndex) => {
      const numTowers = rand(2, 3);
      const towerPositions = new Set();
      const tallTowerIndex = rand(0, numTowers - 1); // One tower can be taller
      
      for (let t = 0; t < numTowers; t++) {
        const margin = Math.max(1, Math.floor(Math.min(h.w, h.h) * 0.1));
        const tx = h.x + rand(margin, Math.max(margin, h.w - margin - 1));
        const ty = h.y + rand(margin, Math.max(margin, h.h - margin - 1));
        const key = `${tx},${ty}`;
        
        if (towerPositions.has(key)) continue;
        towerPositions.add(key);
        
        // One tower can grow taller than the hole depth
        const isTall = t === tallTowerIndex;
        const maxHeight = isTall 
          ? Math.floor(h.targetDepth * 1.15) 
          : Math.floor(h.targetDepth * 0.8);
        const targetHeight = rand(Math.floor(h.targetDepth * 0.3), maxHeight);
        towers.push({ x: tx, y: ty, holeIndex, targetHeight });
      }
    });

    scene = {
      gridPct,
      holes,
      colorWalls: Math.random() < 0.5,
      color,
      towers,
    };
  }

  function animateIn() {
    const id = ++animationId;
    const holeTargets = scene.holes.map((h) => h.targetDepth);
    const towerTargets = scene.towers.map((t) => t.targetHeight);
    const holeDuration = 800;
    const holeStagger = 200;
    const towerDuration = 600;
    const towerStagger = 80;
    const startTime = performance.now();
    
    // Delay towers until holes finish
    const holeEndTime = holeDuration + (scene.holes.length - 1) * holeStagger;
    const towerStartDelay = holeEndTime + 200;

    function ease(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function step(now) {
      if (id !== animationId) return;
      let allDone = true;

      const depths = holeTargets.map((target, i) => {
        const elapsed = now - startTime - i * holeStagger;
        if (elapsed <= 0) {
          allDone = false;
          return 0;
        }
        if (elapsed >= holeDuration) return target;
        allDone = false;
        return target * ease(elapsed / holeDuration);
      });

      const towerHeights = towerTargets.map((target, i) => {
        const elapsed = now - startTime - towerStartDelay - i * towerStagger;
        if (elapsed <= 0) {
          allDone = false;
          return 0;
        }
        if (elapsed >= towerDuration) return target;
        allDone = false;
        return target * ease(elapsed / towerDuration);
      });

      container.innerHTML = buildScene(depths, towerHeights);
      if (!allDone) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  function init() {
    randomizeScene();
    animateIn();
  }

  function updateCamera() {
    if (!scene) return;
    const depths = scene.holes.map((h) => h.targetDepth);
    const towerHeights = scene.towers.map((t) => t.targetHeight);
    container.innerHTML = buildScene(depths, towerHeights);
  }

  function repaint() {
    updateCamera();
  }

  container.addEventListener("click", () => init());
  init();

  return { updateCamera, repaint, init };
}
