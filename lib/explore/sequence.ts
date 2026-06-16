// lib/explore/sequence.ts
// Genome sequence access for the Pair-lens binding-site predictor. A species
// genome FASTA is fetched once and cached; the simulated demo carries its own
// in-memory genome string. windowSeq() returns an RNA sub-sequence (5'→3',
// reverse-complemented for minus-strand features) over the same window the
// contact map uses, so predicted positions map straight onto the heatmap.

import type { Annotation } from "@/lib/shared";

const genomeCache = new Map<string, Promise<string>>();

/** Parse a (possibly multi-line, single-record) FASTA into one uppercase string. */
export function parseFasta(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((l) => l.length > 0 && l.charCodeAt(0) !== 62 /* '>' */)
    .join("")
    .toUpperCase();
}

/** Fetch + cache a genome FASTA, returning the concatenated sequence. */
export function loadGenome(url: string): Promise<string> {
  let p = genomeCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.text();
      })
      .then(parseFasta);
    genomeCache.set(url, p);
  }
  return p;
}

const COMP: Record<string, string> = { A: "T", T: "A", G: "C", C: "G", U: "A", N: "N" };
function revComp(s: string): string {
  let out = "";
  for (let i = s.length - 1; i >= 0; i--) out += COMP[s[i]] ?? "N";
  return out;
}

/**
 * RNA sequence (5'→3') over [start-flank, end+flank], reverse-complemented for
 * minus strand. Offset 0 of the returned string == bin 0 of the contact map's
 * axis for this feature (strand-aware), so prediction indices map to bins via
 * Math.floor(offset / binSize).
 */
export function windowSeq(genome: string, ann: Annotation, flank: number): string {
  const ws = Math.max(1, Math.floor(ann.start) - flank);
  const we = Math.min(genome.length, Math.floor(ann.end) + flank);
  if (we < ws) return "";
  let dna = genome.slice(ws - 1, we); // genome is 1-based; slice is 0-based inclusive..exclusive
  if ((ann.strand || "+") === "-") dna = revComp(dna);
  return dna.replace(/T/g, "U");
}

/** Window start in genome coordinates (1-based), for mapping offsets back to the genome. */
export function windowStart(ann: Annotation, flank: number): number {
  return Math.max(1, Math.floor(ann.start) - flank);
}
