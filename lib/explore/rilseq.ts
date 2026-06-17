// lib/explore/rilseq.ts
// Known E. coli RNA–RNA pairs from RIL-seq (Melamed et al., Mol Cell 2016),
// shipped as public/RIL-seq.csv. Used to highlight experimentally-known targets
// in the Interactome lens, mirroring the legacy globalMAP overlay.

import Papa from "papaparse";
import { baseGene, keyForPair } from "@/lib/shared";

let cache: Promise<Set<string>> | null = null;

// A RIL-seq RNA name can encode several genes (e.g. operon segments) separated
// by "."; keep the parts that look like gene names.
function normNames(s: string): string[] {
  const parts = String(s).trim().split(".");
  const genes = parts.filter((p) => /[a-z]/.test(p));
  return genes.length ? genes : [parts[0]];
}

/** Load + cache the set of known pairs as keyForPair(loweredBaseA, loweredBaseB). */
export function loadRilPairs(): Promise<Set<string>> {
  if (!cache) {
    cache = fetch("/RIL-seq.csv")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.text();
      })
      .then((txt) => {
        const parsed = Papa.parse<string[]>(txt, { header: false, skipEmptyLines: true });
        const set = new Set<string>();
        for (const r of parsed.data as any[]) {
          if (!r || r.length < 2 || !r[0] || !r[1]) continue;
          const A = normNames(r[0]);
          const B = normNames(r[1]);
          for (const a of A) {
            const al = baseGene(a).toLowerCase();
            if (!al) continue;
            for (const b of B) {
              const bl = baseGene(b).toLowerCase();
              if (!bl) continue;
              set.add(keyForPair(al, bl));
            }
          }
        }
        return set;
      });
  }
  return cache;
}

export function isRilHit(set: Set<string>, focal: string, partner: string): boolean {
  return set.has(keyForPair(baseGene(focal).toLowerCase(), baseGene(partner).toLowerCase()));
}
