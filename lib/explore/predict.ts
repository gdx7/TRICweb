// lib/explore/predict.ts
// A lightweight, in-browser RNA–RNA hybridisation predictor (RNAduplex / seed-
// and-extend style). It finds the most stable contiguous inter-molecular helix
// (the "seed") between two RNA windows: WC-complementary 7-mer seeds are hashed,
// each is extended through consecutive Watson-Crick / G-U wobble pairs, and the
// duplex free energy is estimated with Turner-2004 nearest-neighbour stacking
// parameters. This approximates IntaRNA's seed (it omits the accessibility/ED
// term), so treat ΔG as an estimate and the site as a strong hint.

export type Duplex = {
  s1Start: number; s1End: number; // inclusive offsets within seq1 (focal / y)
  s2Start: number; s2End: number; // inclusive offsets within seq2 (partner / x)
  pairs: number;
  gu: number;
  dG: number; // estimated kcal/mol (lower = more stable)
  top: string; // focal site 5'→3'
  mid: string; // bond symbols (| = WC, : = G-U)
  bot: string; // partner site 3'→5' (aligned under top)
};

const WC: Record<string, string> = { A: "U", U: "A", G: "C", C: "G" };

// Turner-2004 RNA nearest-neighbour stacking ΔG°37 (kcal/mol), keyed by the
// top-strand dinucleotide (5'→3') for Watson-Crick stacks (expanded by symmetry).
const WC_STACK: Record<string, number> = {
  AA: -0.93, UU: -0.93,
  AU: -1.10,
  UA: -1.33,
  CU: -2.08, AG: -2.08,
  CA: -2.11, UG: -2.11,
  GU: -2.24, AC: -2.24,
  GA: -2.35, UC: -2.35,
  CG: -2.36,
  GG: -3.26, CC: -3.26,
  GC: -3.42,
};
const INIT = 4.09;     // duplex initiation
const TERM_AU = 0.45;  // terminal A-U / G-U penalty
const GU_STEP = -0.5;  // approximation for any stack involving a G-U wobble

type Kind = 0 | 1 | 2; // 0 none, 1 WC, 2 GU
function kindOf(a: string, b: string): Kind {
  if (WC[a] === b) return 1;
  if ((a === "G" && b === "U") || (a === "U" && b === "G")) return 2;
  return 0;
}

export function predictDuplex(seq1: string, seq2: string, seedLen = 7): Duplex | null {
  const n1 = seq1.length, n2 = seq2.length;
  if (n1 < seedLen || n2 < seedLen) return null;

  // P[k] = WC-complement of reverse(seq2)[k]. seq1[a] WC-pairs seq2[b] (b = n2-1-k)
  // iff seq1[a] === P[k]; a contiguous WC helix is then a diagonal a-k = const.
  let P = "";
  for (let k = 0; k < n2; k++) P += WC[seq2[n2 - 1 - k]] ?? "x";

  const seeds = new Map<string, number[]>();
  for (let k = 0; k + seedLen <= n2; k++) {
    const key = P.slice(k, k + seedLen);
    if (key.indexOf("x") !== -1) continue;
    const arr = seeds.get(key);
    if (arr) arr.push(k); else seeds.set(key, [k]);
  }

  let best: Duplex | null = null;
  const seen = new Set<number>();
  let nSeed = 0;
  const MAX_SEEDS = 8000;

  for (let a = 0; a + seedLen <= n1 && nSeed <= MAX_SEEDS; a++) {
    const ks = seeds.get(seq1.slice(a, a + seedLen));
    if (!ks) continue;
    for (const k of ks) {
      if (++nSeed > MAX_SEEDS) break;
      const delta = a - k;
      const bOf = (ai: number) => n2 - 1 - (ai - delta);

      // extend the contiguous complementary run covering the seed
      let aL = a;
      while (aL - 1 >= 0) {
        const b = bOf(aL - 1);
        if (b < 0 || b >= n2 || kindOf(seq1[aL - 1], seq2[b]) === 0) break;
        aL--;
      }
      let aR = a + seedLen - 1;
      while (aR + 1 < n1) {
        const b = bOf(aR + 1);
        if (b < 0 || b >= n2 || kindOf(seq1[aR + 1], seq2[b]) === 0) break;
        aR++;
      }
      const dedup = delta * 100003 + aL;
      if (seen.has(dedup)) continue;
      seen.add(dedup);

      const m = aR - aL + 1;
      if (m < seedLen) continue;

      let dG = INIT;
      let top = "", mid = "", bot = "", gu = 0;
      for (let t = 0; t < m; t++) {
        const ai = aL + t, bi = bOf(ai);
        const kind = kindOf(seq1[ai], seq2[bi]);
        top += seq1[ai];
        bot += seq2[bi];
        mid += kind === 1 ? "|" : ":";
        if (kind === 2) gu++;
        if (t < m - 1) {
          const ai2 = ai + 1, bi2 = bOf(ai2);
          if (kind === 1 && kindOf(seq1[ai2], seq2[bi2]) === 1) {
            dG += WC_STACK[seq1[ai] + seq1[ai2]] ?? -1.0;
          } else {
            dG += GU_STEP;
          }
        }
      }
      const term = (ai: number) => {
        const bi = bOf(ai);
        if (kindOf(seq1[ai], seq2[bi]) === 2) return TERM_AU;
        return seq1[ai] === "A" || seq1[ai] === "U" ? TERM_AU : 0;
      };
      dG += term(aL) + term(aR);

      if (!best || dG < best.dG) {
        best = {
          s1Start: aL, s1End: aR,
          s2Start: bOf(aR), s2End: bOf(aL), // bOf decreases with offset → [min,max]
          pairs: m, gu, dG,
          top, mid, bot,
        };
      }
    }
  }

  // require a meaningfully stable duplex
  if (best && (best.pairs < seedLen || best.dG > -5)) return null;
  return best;
}
