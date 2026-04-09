// Benchmark getFaces() across projections and scene sizes.
// Run: node bench/getFaces.bench.js
//
// Designed to be runnable on both `main` and the PR branch without edits,
// so results can be compared side-by-side. Uses the ESM source directly.

import { Heerich } from "../src/heerich.js";

const SIZES = [10, 25, 40];
const PROJECTIONS = ["oblique", "perspective", "orthographic"];
const WARMUP = 5;
const ITERS = 30;

function buildScene(size) {
  const h = new Heerich();
  // Dense filled cube — worst case for face generation cost.
  h.batch(() => {
    h.applyGeometry({
      type: "box",
      position: [0, 0, 0],
      size: [size, size, size],
    });
  });
  return h;
}

function bench(label, fn) {
  for (let i = 0; i < WARMUP; i++) fn();
  const samples = [];
  for (let i = 0; i < ITERS; i++) {
    const t = performance.now();
    fn();
    samples.push(performance.now() - t);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const min = samples[0];
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return { label, median, min, mean };
}

function fmt(n) {
  return n.toFixed(2).padStart(8) + " ms";
}

console.log(`node ${process.version}`);
console.log(
  `warmup=${WARMUP} iters=${ITERS}   (each iter invalidates cache via a no-op mutation)\n`,
);

for (const size of SIZES) {
  const voxelCount = size * size * size;
  console.log(`── ${size}³ = ${voxelCount.toLocaleString()} voxels ──`);

  for (const projection of PROJECTIONS) {
    const h = buildScene(size);
    h.renderOptions.projection = projection;

    // Cold: force rebuild every call by bumping epoch through _invalidate.
    // This measures the worst case (no cache hit).
    const cold = bench(`${projection} cold`, () => {
      h._invalidate();
      h.getFaces();
    });

    // Warm: first call populates cache, subsequent calls are free.
    // Measures the cache-hit path.
    const warm = bench(`${projection} warm`, () => {
      h.getFaces();
    });

    console.log(
      `  ${projection.padEnd(13)} cold median=${fmt(cold.median)} min=${fmt(cold.min)} mean=${fmt(cold.mean)}`,
    );
    console.log(
      `  ${" ".repeat(13)} warm median=${fmt(warm.median)} min=${fmt(warm.min)} mean=${fmt(warm.mean)}`,
    );
  }
  console.log();
}
