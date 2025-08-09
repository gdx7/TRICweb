// lib/shared.ts
import Papa from "papaparse";

export type FeatureType =
  | "CDS" | "5'UTR" | "3'UTR" | "ncRNA" | "tRNA" | "rRNA" | "sRNA" | "hkRNA"
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
};

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

export const pickColor = (ft?: FeatureType) =>
  FEATURE_COLORS[ft || "CDS"] || "#F78208";

// symlog + inverse (for plotting)
export function symlog(y: number, linthresh = 10, base = Math.E) {
  const s = Math.sign(y);
  const a = Math.abs(y);
  return a <= linthresh ? s * (a / linthresh) : s * (1 + Math.log(a / linthresh) / Math.log(base));
}
export function invSymlog(t: number, linthresh = 10, base = Math.E) {
  const s = Math.sign(t);
  const a = Math.abs(t);
  return a <= 1 ? s * a * linthresh : s * linthresh * Math.pow(base, (a - 1));
}

// CSV parsers
export function parsePairsCSV(csv: string) {
  const { data } = Papa.parse<Pair>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
  return (data as any[]).filter(r => r.ref && r.target) as Pair[];
}
export function parseAnnoCSV(csv: string) {
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
