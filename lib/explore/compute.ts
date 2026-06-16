// lib/explore/compute.ts
// Pure, framework-free computation shared by every Explorer lens. The logic is
// ported verbatim from the original globalMAP / csMAP / pairMAP / foldMAP pages
// so results stay identical — only the plumbing changed.

import type { Annotation, FeatureType, Pair } from "@/lib/shared";
import { baseGene } from "@/lib/shared";

export type PartnerRow = {
  partner: string;
  x: number; // partner midpoint (genomic)
  start: number;
  end: number;
  y: number; // capped odds ratio (for plotting)
  rawY: number; // true odds ratio
  counts: number;
  type: FeatureType;
  distance: number;
  fdr?: number;
};

export function buildGeneIndex(annotations: Annotation[]): Record<string, Annotation> {
  const idx: Record<string, Annotation> = {};
  for (const a of annotations) idx[a.gene_name.trim()] = a;
  return idx;
}

/** Partners of a focal RNA, deduped by summing/maxing symmetric rows. */
export function buildPartners(
  pairs: Pair[],
  focal: string,
  geneIndex: Record<string, Annotation>,
  opts: { minCounts: number; yCap: number; excludeTypes: FeatureType[] }
): PartnerRow[] {
  const { minCounts, yCap, excludeTypes } = opts;
  const acc = new Map<string, PartnerRow>();
  const focalAnn = geneIndex[focal];
  if (!focalAnn) return [];
  const focalMid = Math.floor((focalAnn.start + focalAnn.end) / 2);

  for (const e of pairs) {
    const ref = String(e.ref || "").trim();
    const tgt = String(e.target || "").trim();
    if (ref !== focal && tgt !== focal) continue;
    const partner = ref === focal ? tgt : ref;
    if (!partner || partner === focal) continue;

    const partAnn = geneIndex[partner];
    if (!partAnn) continue;

    const or = Number(e.odds_ratio) || 0;
    if (!(or > 0)) continue;

    const partMid = Math.floor((partAnn.start + partAnn.end) / 2);
    const dist = Math.abs(partMid - focalMid);
    const counts = Number(e.counts) || 0;
    const type = ((ref === focal ? e.target_type : e.ref_type) || partAnn.feature_type || "CDS") as FeatureType;
    const fdr = e.fdr;

    const prev = acc.get(partner);
    if (prev) {
      prev.counts = Math.max(prev.counts, counts);
      prev.rawY = Math.max(prev.rawY, or);
      prev.y = Math.min(prev.rawY, yCap);
      prev.distance = Math.min(prev.distance, dist);
      if (fdr != null) prev.fdr = prev.fdr != null ? Math.min(prev.fdr, fdr) : fdr;
    } else {
      acc.set(partner, {
        partner,
        x: partMid,
        start: partAnn.start,
        end: partAnn.end,
        y: Math.min(or, yCap),
        rawY: or,
        counts,
        type,
        distance: dist,
        fdr,
      });
    }
  }

  const out: PartnerRow[] = [];
  acc.forEach((r) => {
    if (r.counts >= minCounts && !excludeTypes.includes(r.type)) out.push(r);
  });
  return out;
}

/** Per-gene chimera totals (deduped, symmetric) — used for "Random" + summaries. */
export function buildTotalsByGene(pairs: Pair[]): Map<string, number> {
  const per = new Map<string, Map<string, number>>();
  const bump = (g: string, p: string, c: number) => {
    if (g === p) return;
    const m = per.get(g) ?? new Map<string, number>();
    m.set(p, Math.max(m.get(p) ?? 0, c));
    per.set(g, m);
  };
  for (const e of pairs) {
    const a = String(e.ref || "").trim();
    const b = String(e.target || "").trim();
    const c = Number(e.counts) || 0;
    if (!a || !b) continue;
    bump(a, b, c);
    bump(b, a, c);
  }
  const tot = new Map<string, number>();
  per.forEach((mp, g) => {
    let s = 0;
    mp.forEach((v) => (s += v));
    tot.set(g, s);
  });
  return tot;
}

export function totalRefByGene(pairs: Pair[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of pairs) {
    const ref = String(e.ref || "").trim();
    const v = Number(e.total_ref);
    if (!ref || !Number.isFinite(v)) continue;
    if (v > (m.get(ref) ?? 0)) m.set(ref, v);
  }
  return m;
}

// ---------------- pairMAP: inter-RNA contact matrix ----------------
export type PairMatrix = {
  label: string;
  typeX?: FeatureType;
  mat: number[][];
  bins_x: number;
  bins_y: number;
  y_len_bins: number;
  x_len_bins: number;
  max: number;
};

export function buildPairMatrix(
  contacts: Array<[number, number]>,
  yAnn: Annotation,
  xAnn: Annotation,
  flankY: number,
  flankX: number,
  binSize: number,
  label: string
): PairMatrix {
  const wy_s = Math.max(1, yAnn.start - flankY);
  const wy_e = yAnn.end + flankY;
  const bins_y = Math.ceil((wy_e - wy_s + 1) / binSize);
  const wx_s = Math.max(1, xAnn.start - flankX);
  const wx_e = xAnn.end + flankX;
  const bins_x = Math.ceil((wx_e - wx_s + 1) / binSize);

  const toBin = (coord: number, ws: number, we: number, strand?: string) => {
    const plus = strand !== "-";
    return plus ? Math.floor((coord - ws) / binSize) : Math.floor((we - coord) / binSize);
  };

  const mat = Array.from({ length: bins_y }, () => new Array(bins_x).fill(0));
  let max = 0;
  for (const [c1, c2] of contacts) {
    let b1y = -1, b1x = -1, b2y = -1, b2x = -1;
    if (c1 >= wy_s && c1 <= wy_e) b1y = toBin(c1, wy_s, wy_e, yAnn.strand);
    if (c1 >= wx_s && c1 <= wx_e) b1x = toBin(c1, wx_s, wx_e, xAnn.strand);
    if (c2 >= wy_s && c2 <= wy_e) b2y = toBin(c2, wy_s, wy_e, yAnn.strand);
    if (c2 >= wx_s && c2 <= wx_e) b2x = toBin(c2, wx_s, wx_e, xAnn.strand);
    if (b1y !== -1 && b2x !== -1) { mat[b1y][b2x] += 1; if (mat[b1y][b2x] > max) max = mat[b1y][b2x]; }
    if (b2y !== -1 && b1x !== -1) { mat[b2y][b1x] += 1; if (mat[b2y][b1x] > max) max = mat[b2y][b1x]; }
  }

  return {
    label,
    typeX: xAnn.feature_type,
    mat,
    bins_x,
    bins_y,
    y_len_bins: Math.floor((yAnn.end - yAnn.start) / binSize),
    x_len_bins: Math.floor((xAnn.end - xAnn.start) / binSize),
    max,
  };
}

// ---------------- foldMAP: intramolecular self-contact ----------------
export type FoldMatrix = {
  ws: number;
  we: number;
  nBins: number;
  bin: number;
  start: number;
  end: number;
  raw: number[][];
  max: number;
};

export function buildSelfMatrix(
  contacts: Array<[number, number]>,
  start: number,
  end: number,
  strand: string | undefined,
  flank: number,
  bin: number
): FoldMatrix {
  const ws = Math.max(1, start - flank);
  const we = end + flank;
  const nBins = Math.max(1, Math.ceil((we - ws + 1) / bin));
  const toPos = (coord: number) => (strand === "-" ? we - coord : coord - ws);
  const inWin = (c: number) => c >= ws && c <= we;

  const mat = Array.from({ length: nBins }, () => new Array(nBins).fill(0));
  let max = 0;
  for (const [c1, c2] of contacts) {
    if (!inWin(c1) || !inWin(c2)) continue;
    const b1 = Math.floor(toPos(c1) / bin);
    const b2 = Math.floor(toPos(c2) / bin);
    if (b1 >= 0 && b1 < nBins && b2 >= 0 && b2 < nBins) {
      mat[b1][b2] += 1;
      if (mat[b1][b2] > max) max = mat[b1][b2];
      if (b1 !== b2) {
        mat[b2][b1] += 1;
        if (mat[b2][b1] > max) max = mat[b2][b1];
      }
    }
  }
  return { ws, we, nBins, bin, start, end, raw: mat, max };
}

export function iceNormalize(raw: number[][], maxIter = 40): number[][] {
  const n = raw.length;
  const mat = raw.map((row) => row.slice());
  const bias = new Array(n).fill(1);
  const meanOf = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
  for (let it = 0; it < maxIter; it++) {
    const rowSums = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < n; j++) s += bias[i] && bias[j] ? mat[i][j] / (bias[i] * bias[j]) : 0;
      rowSums[i] = s;
    }
    const m = meanOf(rowSums) || 1;
    const newBias = bias.map((b, i) => (rowSums[i] ? b * (rowSums[i] / m) : b));
    const avg = meanOf(newBias) || 1;
    let change = 0;
    for (let i = 0; i < n; i++) {
      const v = newBias[i] ? newBias[i] / avg : 1;
      change += (v - bias[i]) * (v - bias[i]);
      bias[i] = v;
    }
    if (Math.sqrt(change / n) < 1e-4) break;
  }
  const out = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out[i][j] = bias[i] && bias[j] ? mat[i][j] / (bias[i] * bias[j]) : 0;
  return out;
}

export type LongProfile = { ws: number; we: number; smooth: number[]; peaks: number[] };

function movingAverage(x: number[], k: number) {
  if (k <= 1) return x.slice();
  const half = Math.floor(k / 2);
  const out = new Array(x.length).fill(0);
  for (let i = 0; i < x.length; i++) {
    let s = 0, c = 0;
    for (let j = -half; j <= half; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < x.length) { s += x[idx]; c++; }
    }
    out[i] = c ? s / c : 0;
  }
  return out;
}
const meanArr = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const stdArr = (a: number[]) => {
  if (!a.length) return 0;
  const m = meanArr(a);
  return Math.sqrt(meanArr(a.map((v) => (v - m) * (v - m))));
};
function findLocalMaxima(sig: number[], minDistance: number, minProm: number) {
  const peaks: number[] = [];
  for (let i = 1; i < sig.length - 1; i++) if (sig[i] > sig[i - 1] && sig[i] >= sig[i + 1]) peaks.push(i);
  const filtered: number[] = [];
  const taken = new Array(sig.length).fill(false);
  peaks.sort((a, b) => sig[b] - sig[a]);
  for (const p of peaks) {
    let ok = true;
    for (let j = Math.max(0, p - minDistance); j <= Math.min(sig.length - 1, p + minDistance); j++) if (taken[j]) { ok = false; break; }
    if (!ok) continue;
    const left = Math.max(0, p - minDistance), right = Math.min(sig.length - 1, p + minDistance);
    const localMin = Math.min(...sig.slice(left, right + 1));
    if (sig[p] - localMin >= minProm) { filtered.push(p); taken[p] = true; }
  }
  return filtered.sort((a, b) => a - b);
}

export function buildLongProfile(
  contacts: Array<[number, number]>,
  ann: Annotation,
  flank: number,
  win = 3,
  minDist = 3,
  promFactor = 0.25
): LongProfile {
  const ws = Math.max(1, ann.start - flank);
  const we = ann.end + flank;
  const strand = (ann.strand || "+").toString();
  const width = we - ws + 1;
  const inWin = (c: number) => c >= ws && c <= we;
  const inNear = (c: number) => c >= ws - 5000 && c <= we + 5000;
  const toPos = (c: number) => (strand === "-" ? we - c : c - ws);

  const prof = new Array(width).fill(0);
  for (const [c1, c2] of contacts) {
    if (inWin(c1) && !inNear(c2)) { const p = toPos(c1); if (p >= 0 && p < width) prof[p] += 1; }
    if (inWin(c2) && !inNear(c1)) { const p = toPos(c2); if (p >= 0 && p < width) prof[p] += 1; }
  }
  const smooth = movingAverage(prof, Math.max(1, Math.min(51, win)));
  const peaks = findLocalMaxima(smooth, Math.max(1, Math.min(50, minDist)), stdArr(smooth) * promFactor);
  return { ws, we, smooth, peaks };
}

// ---------------- csMAP: comparative collapsed profiles ----------------
export type CsColumn = {
  gene: string;
  type?: FeatureType;
  total: number;
  dots: Array<{ yT: number; r: number; type: FeatureType }>;
};

const cf = (s: string) => String(s || "").trim().toLowerCase();

export function buildCsColumns(
  geneList: string[],
  pairs: Pair[],
  annoByCF: Map<string, Annotation>,
  sizeScaleFactor = 1
): CsColumn[] {
  const COUNT_MIN = 10, DIST_MIN = 5000, OR_CAP = 5000, LINTHRESH = 10;
  const symlog = (v: number) => {
    const a = Math.abs(v);
    return a <= LINTHRESH ? a / LINTHRESH : 1 + Math.log10(a / LINTHRESH);
  };

  return geneList.map((gRaw) => {
    const gCF = cf(gRaw);
    const annG = annoByCF.get(gCF);
    let total = 0;
    for (const e of pairs) {
      if (cf(e.ref) === gCF && e.total_ref) { total = e.total_ref; break; }
      if (cf(e.target) === gCF && e.totals) { total = e.totals; break; }
    }

    const cand: { pos: number; or: number; counts: number; type: FeatureType }[] = [];
    if (annG) {
      for (const e of pairs) {
        const isRef = cf(e.ref) === gCF;
        const isTgt = cf(e.target) === gCF;
        if (!isRef && !isTgt) continue;
        const partner = isRef ? e.target : e.ref;
        const annP = annoByCF.get(cf(partner));
        if (!annP) continue;
        const dist = Math.min(
          Math.abs(annP.start - annG.end),
          Math.abs(annP.end - annG.start),
          Math.abs(annP.start - annG.start),
          Math.abs(annP.end - annG.end)
        );
        const counts = Number(e.counts) || 0;
        const or = Number(e.odds_ratio) || 0;
        const type = ((isRef ? e.target_type : e.ref_type) || annP.feature_type || "CDS") as FeatureType;
        if (counts < COUNT_MIN || !(or > 0) || dist <= DIST_MIN || type === "hkRNA") continue;
        cand.push({ pos: annP.start, or, counts, type });
      }
    }

    cand.sort((a, b) => a.pos - b.pos);
    const peaks: typeof cand = [];
    let cur = cand[0];
    for (let i = 1; i < cand.length; i++) {
      const nx = cand[i];
      if (nx.pos > (cur?.pos ?? 0) + 1000) { if (cur) peaks.push(cur); cur = nx; }
      else if (cur && nx.or > cur.or) cur = nx;
    }
    if (cur) peaks.push(cur);
    peaks.sort((a, b) => b.counts - a.counts);

    return {
      gene: gRaw,
      type: annG?.feature_type,
      total: Math.max(0, Math.floor(total)),
      dots: peaks.map((p) => ({
        yT: symlog(Math.min(OR_CAP, p.or)),
        r: Math.sqrt(p.counts) * 1.5 * sizeScaleFactor,
        type: p.type,
      })),
    };
  });
}

// ---------------- shared parsing for uploads / presets ----------------
export function baseGeneLower(name: string) {
  return baseGene(name).toLowerCase();
}
