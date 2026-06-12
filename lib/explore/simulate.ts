// lib/explore/simulate.ts
// A single, self-consistent simulated dataset that powers EVERY lens of the
// Explorer at once: the same genes drive the interactome scatter, the partner
// table, the pair contact maps and the intramolecular fold maps. Because the
// chimera contacts are generated from the very same pairs, clicking a partner
// always reveals a sensible hotspot, and every RNA has a believable structure.
//
// Deterministic (seeded) so React re-renders never reshuffle the demo.

import type { Annotation, Pair } from "@/lib/shared";

export type ExploreDataset = {
  annotations: Annotation[];
  pairs: Pair[];
  contacts: Array<[number, number]>;
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GENOME_LEN = 4_000_000;

export function simulateExploreData(seed = 7): ExploreDataset {
  const rng = mulberry32(seed);
  const randInt = (a: number, b: number) => Math.floor(a + rng() * (b - a + 1));
  const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];

  const annotations: Annotation[] = [];
  const byName = new Map<string, Annotation>();
  const push = (a: Annotation) => {
    annotations.push(a);
    byName.set(a.gene_name, a);
  };

  // ---- coding genes evenly spread, each with optional 5'/3' UTRs ----
  const nCDS = 84;
  const cdsNames: string[] = [];
  const slot = Math.floor(GENOME_LEN / nCDS);
  for (let i = 1; i <= nCDS; i++) {
    const base = (i - 1) * slot + randInt(400, slot - 2200);
    const len = randInt(300, 1500);
    const start = base;
    const end = base + len;
    const strand = rng() > 0.5 ? "+" : "-";
    const name = `gene${i}`;
    cdsNames.push(name);
    push({ gene_name: name, start, end, feature_type: "CDS", strand, chromosome: "chr" });
    if (rng() > 0.25) {
      const ul = randInt(40, 130);
      push({ gene_name: `5'gene${i}`, start: Math.max(1, start - ul), end: start - 1, feature_type: "5'UTR", strand, chromosome: "chr" });
    }
    if (rng() > 0.25) {
      const ul = randInt(40, 130);
      push({ gene_name: `3'gene${i}`, start: end + 1, end: end + ul, feature_type: "3'UTR", strand, chromosome: "chr" });
    }
  }

  // ---- regulatory RNAs ----
  const srnaNames: string[] = [];
  for (let i = 1; i <= 11; i++) {
    const start = randInt(1, GENOME_LEN - 400);
    const end = start + randInt(70, 220);
    push({ gene_name: `srna${i}`, start, end, feature_type: "sRNA", strand: rng() > 0.5 ? "+" : "-", chromosome: "chr" });
    srnaNames.push(`srna${i}`);
  }
  const spongeNames: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const start = randInt(1, GENOME_LEN - 400);
    const end = start + randInt(120, 320);
    push({ gene_name: `sponge${i}`, start, end, feature_type: "sponge", strand: "+", chromosome: "chr" });
    spongeNames.push(`sponge${i}`);
  }
  for (let i = 1; i <= 6; i++) {
    const start = randInt(1, GENOME_LEN - 200);
    push({ gene_name: `trna${i}`, start, end: start + randInt(70, 95), feature_type: "tRNA", strand: "+", chromosome: "chr" });
  }
  for (let i = 1; i <= 3; i++) {
    const start = randInt(1, GENOME_LEN - 3000);
    push({ gene_name: `rrna${i}`, start, end: start + randInt(1500, 2900), feature_type: "rRNA", strand: "+", chromosome: "chr" });
  }

  // ---- pairs (interactions) ----
  const pairs: Pair[] = [];
  const contacts: Array<[number, number]> = [];
  const seenPair = new Set<string>();

  // emit a focused cluster of chimera contacts between two features
  const emitHotspot = (a: Annotation, b: Annotation, n: number) => {
    const aoff = 0.25 + rng() * 0.5;
    const boff = 0.25 + rng() * 0.5;
    const aHot = Math.round(a.start + (a.end - a.start) * aoff);
    const bHot = Math.round(b.start + (b.end - b.start) * boff);
    for (let k = 0; k < n; k++) {
      const c1 = aHot + Math.round((rng() - 0.5) * 36);
      const c2 = bHot + Math.round((rng() - 0.5) * 36);
      contacts.push([c1, c2]);
    }
  };

  const addPair = (refName: string, tgtName: string, counts: number, or: number, fdr: number) => {
    const a = byName.get(refName);
    const b = byName.get(tgtName);
    if (!a || !b || refName === tgtName) return;
    const key = [refName, tgtName].sort().join("|");
    if (seenPair.has(key)) return;
    seenPair.add(key);
    pairs.push({
      ref: refName,
      target: tgtName,
      counts,
      odds_ratio: or,
      fdr,
      ref_type: a.feature_type,
      target_type: b.feature_type,
    });
    emitHotspot(a, b, Math.max(6, Math.min(48, Math.round(counts * 0.55))));
  };

  // helper: target a sRNA regulon onto 5'UTR / CDS features
  const utrOrCdsFor = (cdsName: string) => {
    const i = cdsName.replace("gene", "");
    return rng() > 0.45 && byName.has(`5'gene${i}`) ? `5'gene${i}` : cdsName;
  };

  // sRNA hubs — srna1 gets the richest, highest-confidence regulon (default focal)
  srnaNames.forEach((s, si) => {
    const nTargets = si === 0 ? 16 : randInt(5, 12);
    const used = new Set<string>();
    for (let t = 0; t < nTargets; t++) {
      const cds = pick(cdsNames);
      if (used.has(cds)) continue;
      used.add(cds);
      const tgt = utrOrCdsFor(cds);
      const counts = randInt(si === 0 ? 24 : 10, si === 0 ? 160 : 90);
      const or = 30 + Math.pow(rng(), 0.4) * (si === 0 ? 620 : 380);
      const fdr = Math.pow(rng(), 3) * 1e-3;
      addPair(s, tgt, counts, or, fdr);
    }
  });

  // sponges sequester a couple of sRNAs each
  spongeNames.forEach((sp) => {
    for (let t = 0; t < randInt(1, 3); t++) {
      addPair(sp, pick(srnaNames), randInt(20, 90), 60 + rng() * 400, Math.pow(rng(), 3) * 1e-3);
    }
  });

  // background mRNA–mRNA proximity network
  for (let k = 0; k < 150; k++) {
    addPair(pick(cdsNames), pick(cdsNames), randInt(2, 34), 1 + Math.pow(rng(), 1.5) * 36, 0.001 + rng() * 0.3);
  }

  // ---- intramolecular structure contacts (feed foldMAP) ----
  const structuralGenes = annotations.filter(
    (a) => a.feature_type === "CDS" || a.feature_type === "sRNA" || a.feature_type === "sponge"
  );
  for (const g of structuralGenes) {
    const len = g.end - g.start;
    if (len < 60) continue;
    const nDiag = Math.min(60, Math.round(len / 30));
    for (let k = 0; k < nDiag; k++) {
      const p = g.start + Math.round(rng() * len);
      const q = p + Math.round((rng() - 0.5) * Math.min(len * 0.4, 140));
      if (q >= g.start && q <= g.end) contacts.push([p, q]);
    }
    // one or two domain blocks (two regions that contact each other)
    if (len > 300 && rng() > 0.4) {
      const r1 = g.start + Math.round(len * (0.12 + rng() * 0.1));
      const r2 = g.start + Math.round(len * (0.7 + rng() * 0.1));
      for (let k = 0; k < 14; k++) {
        contacts.push([r1 + Math.round((rng() - 0.5) * 50), r2 + Math.round((rng() - 0.5) * 50)]);
      }
    }
    // long-range (>5 kb) ligation events for the 1D profile
    for (let k = 0; k < 6; k++) {
      const p = g.start + Math.round(rng() * len);
      const far = p + (rng() > 0.5 ? 1 : -1) * randInt(6000, 60000);
      if (far > 0 && far < GENOME_LEN) contacts.push([p, far]);
    }
  }

  // ---- attach per-gene totals so csMAP totals bars populate ----
  const totalByGene = new Map<string, number>();
  for (const p of pairs) {
    totalByGene.set(p.ref, (totalByGene.get(p.ref) ?? 0) + (p.counts ?? 0));
    totalByGene.set(p.target, (totalByGene.get(p.target) ?? 0) + (p.counts ?? 0));
  }
  for (const p of pairs) {
    p.total_ref = totalByGene.get(p.ref);
    p.totals = totalByGene.get(p.target);
  }

  return { annotations, pairs, contacts };
}
