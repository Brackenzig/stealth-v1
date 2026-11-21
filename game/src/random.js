// Seeded random numbers (mulberry32). Every run with the same seed plays
// the same way, so screenshots staged with ?seed=1 are byte-identical.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickRng(rng, list) {
  return list[Math.floor(rng() * list.length)];
}
