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
  | "sponge"
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
  fdr?: number; // Added fdr
};

// ---------- Colors + small helpers ----------
export const FEATURE_COLORS: Record<FeatureType, string> = {
  ncRNA: "#A40194",
  sRNA: "#A40194", // Unified color
  sponge: "#F12C2C",
  tRNA: "#82F778",
  hkRNA: "#999999",
  rRNA: "#999999", // Unified color
  CDS: "#F78208",
  "5'UTR": "#76AAD7",
  "3'UTR": "#0C0C0C",
};

export function pickColor(ft?: FeatureType) {
  return FEATURE_COLORS[ft || "CDS"] || "#F78208";
}

export function symlog(y: number, linthresh = 10, base = 10) { // Default base 10 per global/page.tsx
  const s = Math.sign(y);
  const a = Math.abs(y);
  return a <= linthresh ? s * (a / linthresh) : s * (1 + Math.log(a / linthresh) / Math.log(base));
}

export const cap1 = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function formatGeneName(name: string, type?: FeatureType): { text: string; italic: boolean } {
  const t = type || "CDS";
  if (t === "sRNA" || t === "ncRNA" || t === "sponge") return { text: cap1(name), italic: false };
  return { text: name, italic: true };
}

export const combinedLabel = (ft: FeatureType): { label: string; italic: boolean } => {
  if (ft === "sRNA" || ft === "ncRNA") return { label: "sRNA/ncRNA", italic: false };
  if (ft === "sponge") return { label: "Sponge", italic: false };
  if (ft === "rRNA" || ft === "hkRNA") return { label: "rRNA/hkRNA", italic: false };
  return { label: ft, italic: false };
};

export const keyForPair = (a: string, b: string) => [a, b].sort().join("||");

export const baseGene = (name: string) => {
  const n = name.replace(/^5'|^3'/, "");
  return n.split(".")[0];
};

export const cf = (s: string) => String(s || "").trim().toLowerCase();

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
  const { data } = Papa.parse<any>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
  return (data as any[])
    .filter((r) => r.ref && r.target)
    .map((r) => {
      const rawFdr = r.p_value_FDR ?? r.fdr ?? r.FDR ?? r.fdr_adj ?? r.p_adj;
      const fdrNum = rawFdr != null && rawFdr !== "" ? Number(rawFdr) : undefined;
      return {
        ref: String(r.ref).trim(),
        target: String(r.target).trim(),
        counts: Number(r.counts) || 0,
        odds_ratio: Number(r.odds_ratio) || 0,
        totals: r.totals != null ? Number(r.totals) : undefined,
        total_ref: r.total_ref != null ? Number(r.total_ref) : undefined,
        ref_type: r.ref_type,
        target_type: r.target_type,
        fdr: Number.isFinite(fdrNum as number) ? (fdrNum as number) : undefined,
      };
    });
}

export function parseAnnoCSV(csv: string): Annotation[] {
  const { data } = Papa.parse<any>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
  return (data as any[])
    .filter(r => r.gene_name && (r.start != null) && (r.end != null))
    .map(r => ({
      gene_name: String(r.gene_name).trim(),
      start: Number(r.start),
      end: Number(r.end),
      feature_type: r.feature_type,
      strand: r.strand,
      chromosome: r.chromosome,
    })) as Annotation[];
}

export function parseContactsText(txt: string): Array<[number, number]> {
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const rows: Array<[number, number]> = [];
  const body = lines.filter(l => !/^track|^browser/i.test(l));
  for (const line of body) {
    const parts = line.split(/\s+|,/).filter(Boolean);
    if (parts.length >= 3 && !isNaN(Number(parts[1])) && !isNaN(Number(parts[2]))) {
      rows.push([Number(parts[1]), Number(parts[2])]);
    } else if (parts.length >= 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
      rows.push([Number(parts[0]), Number(parts[1])]);
    }
  }
  return rows;
}


// ---------- Export helper ----------
export function exportSVG(svgId: string, filename: string) {
  const el = document.getElementById(svgId) as SVGSVGElement | null;
  if (!el) return;
  const clone = el.cloneNode(true) as SVGSVGElement;
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent =
    'text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#1f2937;font-size:10px}.axis-label{font-size:11px}';
  defs.appendChild(style);
  clone.insertBefore(defs, clone.firstChild);
  const ser = new XMLSerializer();
  const str = ser.serializeToString(clone);
  const blob = new Blob([str], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".svg") ? filename : `${filename}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportPNG(svgId: string, filename: string) {
  const el = document.getElementById(svgId) as SVGSVGElement | null;
  if (!el) return;
  const clone = el.cloneNode(true) as SVGSVGElement;
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent =
    'text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#1f2937;font-size:10px}.axis-label{font-size:11px}';
  defs.appendChild(style);
  clone.insertBefore(defs, clone.firstChild);
  const ser = new XMLSerializer();
  const str = ser.serializeToString(clone);

  const blob = new Blob([str], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const bbox = el.getBoundingClientRect();
    canvas.width = bbox.width || 800;
    canvas.height = bbox.height || 600;
    const wAttr = el.getAttribute("width");
    const hAttr = el.getAttribute("height");
    if (wAttr) canvas.width = parseInt(wAttr, 10);
    if (hAttr) canvas.height = parseInt(hAttr, 10);

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          const pngUrl = URL.createObjectURL(pngBlob);
          const a = document.createElement("a");
          a.href = pngUrl;
          a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
          a.click();
          URL.revokeObjectURL(pngUrl);
        }
        URL.revokeObjectURL(url);
      }, "image/png");
    }
  };
  img.src = url;
}
