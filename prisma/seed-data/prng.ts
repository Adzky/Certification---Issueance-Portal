/** Deterministic PRNG (mulberry32). The seed always uses seed 42. */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  between(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** True with probability `p`. */
  chance(p: number): boolean;
  /** Picks one key with probability proportional to its weight. */
  weighted<T extends string>(weights: Record<T, number>): T;
  shuffle<T>(items: readonly T[]): T[];
  hex(bytes: number): string;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const between = (min: number, max: number) => min + next() * (max - min);
  return {
    next,
    int,
    between,
    pick: (items) => items[Math.floor(next() * items.length)]!,
    chance: (p) => next() < p,
    weighted: <T extends string>(weights: Record<T, number>): T => {
      const keys = Object.keys(weights) as T[];
      const total = keys.reduce((s, k) => s + weights[k], 0);
      let r = next() * total;
      for (const k of keys) {
        r -= weights[k];
        if (r < 0) return k;
      }
      return keys[keys.length - 1]!;
    },
    shuffle: <T>(items: readonly T[]): T[] => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
    hex: (bytes) => Array.from({ length: bytes }, () => int(0, 255).toString(16).padStart(2, '0')).join(''),
  };
}
