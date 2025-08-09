// lib/shared.ts
// Common types + helpers used across /global, /csmap, /pairmap

import Papa from "papaparse";

// ---------- Types ----------
export type FeatureType =
  | "CDS"
  | "5'UTR"
  | "3'UTR"
  | "ncRNA"
  | "tRNA"
  | "rRNA"
  | "sRNA"
  | "hkRNA"
  | string;

export type Annotation = {
  gene_name: string;
  start: number;
  end: number;
  feature_type?: FeatureType;
  strand?: "+" | "-" | string;
  chromosome?: string;
};

export type Pair = {
  ref: string;
  target: string;
  counts?: number;
  odds_ratio?: number;
  adjusted_score?: number;
  totals?: number;
  total_ref?: number;
  ref_type?: FeatureType;
  target_type?: FeatureType;
  // optional extra cols are fine
};

// ---------- Colors + small helpers ----------
export const FEATURE_COLORS: Record<FeatureType, string> = {
  ncRNA: "#A40194",
  sRNA: "#B84AE2",
  sponge: "#F12C2C",
  tRNA: "#82F778",
  hkRNA: "#C4C5C5",
  CDS: "#F78208",
  "5'UTR": "#76AAD7",
  "3'UTR": "#0C0C0C",
  rRNA: "#999999",
};

export function pickColor(ft?: FeatureType) {
  return FEATURE_COLORS[ft || "CDS"] || "#F78208";
}

export function symlog(y: number, linthresh = 10, base = Math.E) {
  const s = Math.sign(y);
  const a = Math.abs(y);
  return a <= linthresh ? s * (a / linthresh) : s * (1 + Math.log(a / linthresh) / Math.log(base));
}

// ---------- Index + distance ----------
export function geneIndex(annotations: Annotation[]) {
  const idx: Record<string, Annotation> = {};
  for (const a of annotations) idx[a.gene_name] = a;
  return idx;
}

export function distanceBetween(a?: Annotation, b?: Annotation) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.min(
    Math.abs(a.start - b.end),
    Math.abs(a.end - b.start),
    Math.abs(a.start - b.start),
    Math.abs(a.end - b.end)
  );
}

// ---------- CSV parsers (expect headers) ----------
export function parsePairsCSV(csv: string): Pair[] {
  const { data } = Papa.parse<Pair>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
  return (data as any[]).filter(r => r.ref && r.target) as Pair[];
}

export function parseAnnoCSV(csv: string): Annotation[] {
  const { data } = Papa.parse<any>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
  return (data as any[])
    .filter(r => r.gene_name && (r.start != null) && (r.end != null))
    .map(r => ({
      gene_name: String(r.gene_name),
      start: Number(r.start),
      end: Number(r.end),
      feature_type: r.feature_type,
      strand: r.strand,
      chromosome: r.chromosome,
    })) as Annotation[];
}
