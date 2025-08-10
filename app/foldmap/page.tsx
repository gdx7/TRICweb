"use client";

import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";

// ----------------- Types -----------------
type Annotation = {
  gene_name: string;
  start: number;
  end: number;
  strand?: "+" | "-" | string;
  chromosome?: string;
};

type Interaction = { c1: number; c2: number };

// ----------------- Helpers -----------------
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function mean(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
function std(arr: number[]) {
  if (!arr.length) return 0;
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((v) => (v - m) * (v - m))));
}
function movingAverage(x: number[], k: number) {
  if (k <= 1) return x.slice();
  const half = Math.floor(k / 2);
  const out = new Array(x.length).fill(0);
  for (let i = 0; i < x.length; i++) {
    let s = 0,
      c = 0;
    for (let j = -half; j <= half; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < x.length) {
        s += x[idx];
        c += 1;
      }
    }
    out[i] = c ? s / c : 0;
  }
  return out;
}
function findLocalMaxima(sig: number[], minDistance: number, minProm: number) {
  const peaks: number[] = [];
  for (let i = 1; i < sig.length - 1; i++) {
    if (sig[i] > sig[i - 1] && sig[i] >= sig[i + 1]) peaks.push(i);
  }
  // enforce min distance
  const filtered: number[] = [];
  peaks.sort((a, b) => sig[b] - sig[a]); // pick highest first
  const taken = new Array(sig.length).fill(false);
  for (const p of peaks) {
    let ok = true;
    for (let j = Math.max(0, p - minDistance); j <= Math.min(sig.length - 1, p + minDistance); j++) {
      if (taken[j]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    // simple prominence: relative to local window min
    const left = Math.max(0, p - minDistance);
    const right = Math.min(sig.length - 1, p + minDistance);
    const localMin = Math.min(...sig.slice(left, right + 1));
    if (sig[p] - localMin >= minProm) {
      filtered.push(p);
      taken[p] = true;
    }
  }
  // return sorted left-to-right
  return filtered.sort((a, b) => a - b);
}
function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ----------------- Parsers -----------------
function parseAnnotationCSV(text: string): Annotation[] {
  // Accepts headerless (RNA,Start,End,Feature,Strand,...) OR headered with gene_name/start/end/...
  const { data } = Papa.parse<any>(text, { header: false, dynamicTyping: true, skipEmptyLines: true });
  if (!data.length) return [];
  const first = data[0];
  const looksHeadered =
    typeof first[0] === "string" &&
    ["gene_name", "RNA"].includes(String(first[0]).trim()) &&
    /start/i.test(String(first[1] ?? "")) &&
    /end/i.test(String(first[2] ?? ""));

  if (looksHeadered) {
    const { data: d2 } = Papa.parse<any>(text, { header: true, dynamicTyping: true, skipEmptyLines: true });
    return (d2 as any[])
      .filter((r) => r.gene_name && r.start != null && r.end != null)
      .map((r) => ({
        gene_name: String(r.gene_name).trim(),
        start: Number(r.start),
        end: Number(r.end),
        strand: r.strand || r.Strand,
        chromosome: r.chromosome || r.Chromosome,
      }));
  } else {
    // headerless: RNA,Start,End,Feature,Strand,(extra...)
    return (data as any[])
      .filter((r) => r[0] && r[1] != null && r[2] != null)
      .map((r) => ({
        gene_name: String(r[0]).trim(),
        start: Number(r[1]),
        end: Number(r[2]),
        strand: r[4] ?? r[3], // often 4th col
        chromosome: undefined,
      }));
  }
}

async function parseInteractionFiles(files: FileList | null): Promise<Interaction[]> {
  if (!files || files.length === 0) return [];
  const all: Interaction[] = [];
  for (const f of Array.from(files)) {
    const text = await f.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (!lines.length) continue;
    const firstLine = lines[0];
    const isCSV = f.name.toLowerCase().endsWith(".csv");
    const isBed = f.name.toLowerCase().endsWith(".bed");

    if (isCSV) {
      // Expect 2 columns coords
      const { data } = Papa.parse<any>(text, { header: false, dynamicTyping: true, skipEmptyLines: true });
      for (const r of data as any[]) {
        const c1 = Number(r[0]);
        const c2 = Number(r[1]);
        if (Number.isFinite(c1) && Number.isFinite(c2)) all.push({ c1, c2 });
      }
    } else if (isBed) {
      // BED-like, possibly with 'track'/'browser' header; use cols 2 & 3 (0-based)
      const skipHeader = firstLine.startsWith("track") || firstLine.startsWith("browser") ? 1 : 0;
      const body = lines.slice(skipHeader);
      for (const ln of body) {
        const t = ln.split(/\t|,/);
        if (t.length < 3) continue;
        const c1 = Number(t[1]);
        const c2 = Number(t[2]);
        if (Number.isFinite(c1) && Number.isFinite(c2)) all.push({ c1, c2 });
      }
    } else {
      // Try TSV generic
      for (const ln of lines) {
        const t = ln.split(/\t|,/);
        if (t.length < 2) continue;
        const c1 = Number(t[0]);
        const c2 = Number(t[1]);
        if (Number.isFinite(c1) && Number.isFinite(c2)) all.push({ c1, c2 });
      }
    }
  }
  return all;
}

// ----------------- Matrix & Profile builders -----------------
function buildSelfMatrix(
  interactions: Interaction[],
  start: number,
  end: number,
  strand: string | undefined,
  flank: number,
  bin: number
) {
  // window around gene
  const ws = Math.max(1, start - flank);
  const we = end + flank;
  const length = we - ws + 1;
  const nBins = Math.max(1, Math.ceil(length / bin));

  // map genomic -> index along 5'->3' axis
  const toPos = (coord: number) => {
    if (strand === "-") {
      return we - coord; // reverse so left is 5'
    } else {
      return coord - ws;
    }
  };

  const inWin = (c: number) => c >= ws && c <= we;

  const mat = new Array(nBins).fill(0).map(() => new Array(nBins).fill(0));
  for (const { c1, c2 } of interactions) {
    if (!inWin(c1) || !inWin(c2)) continue; // only intra-window (intra-RNA)
    const p1 = toPos(c1);
    const p2 = toPos(c2);
    if (p1 < 0 || p2 < 0) continue;
    const b1 = Math.floor(p1 / bin);
    const b2 = Math.floor(p2 / bin);
    if (b1 < 0 || b1 >= nBins || b2 < 0 || b2 >= nBins) continue;
    mat[b1][b2] += 1;
    if (b1 !== b2) mat[b2][b1] += 1; // symmetric
  }

  // coverage norm
  const total = mat.flat().reduce((s, v) => s + v, 0);
  const cov = mat.map((row) => row.map((v) => (total > 0 ? v / total : 0)));

  // ICE (simple iterative)
  const ice = mat.map((row) => row.map((v) => v)); // copy
  const n = ice.length;
  let bias = new Array(n).fill(1);
  for (let it = 0; it < 200; it++) {
    const adj = new Array(n).fill(0).map(() => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const denom = bias[i] * bias[j];
        adj[i][j] = denom ? ice[i][j] / denom : 0;
      }
    }
    const rowSums = adj.map((row) => row.reduce((s, v) => s + v, 0));
    const m = mean(rowSums) || 1;
    const newBias = bias.map((b, i) => (rowSums[i] ? b * (rowSums[i] / m) : b));
    const change = Math.sqrt(mean(newBias.map((v, i) => (v - bias[i]) * (v - bias[i]))));
    bias = newBias.map((v) => (v ? v / (mean(newBias) || 1) : 1));
    if (change < 1e-4) break;
  }
  const iceOut = new Array(n).fill(0).map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) iceOut[i][j] = bias[i] && bias[j] ? ice[i][j] / (bias[i] * bias[j]) : 0;

  return { ws, we, length, nBins, raw: mat, cov, ice: iceOut };
}

function percentile(arr: number[], p: number) {
  const a = arr.slice().sort((x, y) => x - y);
  if (!a.length) return 0;
  const idx = (p / 100) * (a.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return a[lo];
  const t = idx - lo;
  return a[lo] * (1 - t) + a[hi] * t;
}

function toSVGHeatmap(
  mat: number[][],
  opts: {
    width: number;
    height: number;
    title: string;
    xLabel: string;
    yLabel: string;
    vmax?: number;
  }
) {
  const { width, height, title, xLabel, yLabel } = opts;
  const n = mat.length;
  const m = mat[0]?.length || 0;
  const padL = 44,
    padR = 20,
    padT = 28,
    padB = 40;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const cw = innerW / m;
  const ch = innerH / n;

  const flat = mat.flat().filter((v) => v > 0);
  const vmax = opts.vmax ?? (flat.length ? percentile(flat, 95) : 1);
  const scale = (v: number) => {
    const t = Math.min(1, v / (vmax || 1));
    // simple white -> red
    const r = 255;
    const g = Math.round(255 * (1 - t));
    const b = Math.round(255 * (1 - t));
    return `rgb(${r},${g},${b})`;
  };

  let rects = "";
  for (let i = 0; i < n; i++) {
    const y = padT + i * ch;
    for (let j = 0; j < m; j++) {
      const x = padL + j * cw;
      const v = mat[i][j];
      rects += `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="${v > 0 ? scale(v) : "#ffffff"}" stroke="none"/>`;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <style>
      text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#1f2937;font-size:11px}
      .sub{font-size:10px;fill:#6b7280}
    </style>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>
  <text x="${padL}" y="${padT - 8}">${title}</text>
  ${rects}
  <text x="${padL + innerW / 2}" y="${height - 8}" text-anchor="middle" class="sub">${xLabel}</text>
  <text transform="translate(14,${padT + innerH / 2}) rotate(-90)" class="sub">${yLabel}</text>
</svg>`;
  return svg;
}

function toSVGProfile(
  values: number[],
  maximaIdx: number[],
  opts: { width: number; height: number; title: string; xLabel: string; yLabel: string }
) {
  const { width, height, title, xLabel, yLabel } = opts;
  const padL = 48,
    padR = 18,
    padT = 28,
    padB = 42;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const maxY = Math.max(1, ...values);
  const xScale = (i: number) => padL + (i / Math.max(1, values.length - 1)) * innerW;
  const yScale = (v: number) => padT + innerH - (v / maxY) * innerH;

  // bar background
  let bars = "";
  for (let i = 0; i < values.length; i++) {
    const x = xScale(i);
    const y = yScale(values[i]);
    const w = Math.max(1, innerW / values.length);
    const h = padT + innerH - y;
    bars += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#e5e7eb" />`;
  }

  // maxima points
  let dots = "";
  maximaIdx.forEach((i) => {
    const x = xScale(i);
    const y = yScale(values[i]);
    dots += `<circle cx="${x}" cy="${y}" r="3" fill="#ef4444" />`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <style>
      text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#1f2937;font-size:11px}
      .sub{font-size:10px;fill:#6b7280}
      .axis{stroke:#111827}
      .grid{stroke:#e5e7eb}
    </style>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>
  <text x="${padL}" y="${padT - 8}">${title}</text>
  ${bars}
  ${dots}
  <text x="${padL + innerW / 2}" y="${height - 8}" text-anchor="middle" class="sub">${xLabel}</text>
  <text transform="translate(14,${padT + innerH / 2}) rotate(-90)" class="sub">${yLabel}</text>
</svg>`;
  return svg;
}

// ----------------- Page -----------------
export default function FoldMapPage() {
  const [ann, setAnn] = useState<Annotation[]>([]);
  const [ints, setInts] = useState<Interaction[]>([]);
  const [query, setQuery] = useState("");
  const [bin, setBin] = useState(10);
  const [flank, setFlank] = useState(200); // 0–500 like pairMAP
  const [norm, setNorm] = useState<"raw" | "cov" | "ice">("raw");
  const [profileWin, setProfileWin] = useState(5);
  const [profileMinDist, setProfileMinDist] = useState(3);
  const [profilePromFactor, setProfilePromFactor] = useState(0.25); // σ multiplier

  const annRef = useRef<HTMLInputElement>(null);
  const intRef = useRef<HTMLInputElement>(null);

  const geneRow = useMemo(() => {
    if (!ann.length || !query.trim()) return undefined;
    const q = query.trim().toLowerCase();
    return (
      ann.find((a) => a.gene_name.toLowerCase() === q) ||
      ann.find((a) => a.gene_name.toLowerCase().includes(q))
    );
  }, [ann, query]);

  const matBundle = useMemo(() => {
    if (!geneRow || !ints.length) return undefined;
    const f = clamp(flank, 0, 500);
    const b = clamp(bin, 1, 200);
    return buildSelfMatrix(ints, geneRow.start, geneRow.end, geneRow.strand, f, b);
  }, [geneRow, ints, flank, bin]);

  // Long-range profile (only coords within [start,end] vs outside ±5000)
  const longProfile = useMemo(() => {
    if (!geneRow || !ints.length) return undefined;
    const start = geneRow.start;
    const end = geneRow.end;
    const strand = (geneRow.strand || "+").toString();
    const len = end - start + 1;
    const flankLR = 5000;

    const inGene = (c: number) => c >= start && c <= end;
    const inNear = (c: number) => c >= start - flankLR && c <= end + flankLR;

    const within = ints.filter(
      ({ c1, c2 }) => (inGene(c1) && !inNear(c2)) || (inGene(c2) && !inNear(c1))
    );
    const prof = new Array(len).fill(0);

    for (const { c1, c2 } of within) {
      if (inGene(c1) && !inNear(c2)) {
        const rel = strand === "-" ? end - c1 : c1 - start;
        if (rel >= 0 && rel < len) prof[rel] += 1;
      }
      if (inGene(c2) && !inNear(c1)) {
        const rel = strand === "-" ? end - c2 : c2 - start;
        if (rel >= 0 && rel < len) prof[rel] += 1;
      }
    }
    const sm = movingAverage(prof, clamp(profileWin, 1, 51));
    const sigma = std(sm);
    const peaks = findLocalMaxima(sm, clamp(profileMinDist, 1, 50), sigma * profilePromFactor);
    return { raw: prof, smooth: sm, peaks };
  }, [geneRow, ints, profileWin, profileMinDist, profilePromFactor]);

  async function onAnnFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setAnn(parseAnnotationCSV(text));
  }
  async function onIntsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const arr = await parseInteractionFiles(e.target.files);
    setInts(arr);
  }

  function exportMatrixSVG() {
    if (!geneRow || !matBundle) return;
    const mat =
      norm === "raw" ? matBundle.raw : norm === "cov" ? matBundle.cov : matBundle.ice;
    const svg = toSVGHeatmap(mat as any, {
      width: 640,
      height: 640,
      title: `${geneRow.gene_name} intramolecular contact map (${norm}, bin ${bin} nt, flank ${flank} nt)`,
      xLabel: "5′ → 3′ (bins)",
      yLabel: "5′ → 3′ (bins)",
    });
    downloadText(`${geneRow.gene_name}_foldMAP_${norm}.svg`, svg);
  }
  function exportProfileSVG() {
    if (!geneRow || !longProfile) return;
    const svg = toSVGProfile(longProfile.smooth, longProfile.peaks, {
      width: 800,
      height: 280,
      title: `${geneRow.gene_name} long-range (≥ 5 kb) interaction profile`,
      xLabel: "Position along RNA (nt, 5′ → 3′)",
      yLabel: "Smoothed ligation events",
    });
    downloadText(`${geneRow.gene_name}_longrange_profile.svg`, svg);
  }
  function exportPeaksCSV() {
    if (!geneRow || !longProfile) return;
    const rows = [["Feature_Type", "Position", "Notes"]];
    longProfile.peaks.forEach((p) => {
      rows.push(["Maxima (ssRNA)", String(p + 1), "long-range maxima"]);
    });
    const csv = rows.map((r) => r.join(",")).join("\n");
    downloadText(`${geneRow.gene_name}_longrange_maxima.csv`, csv);
  }

  // pick matrix to display
  const dispMat = useMemo(() => {
    if (!matBundle) return undefined;
    return norm === "raw" ? matBundle.raw : norm === "cov" ? matBundle.cov : matBundle.ice;
  }, [matBundle, norm]);

  return (
    <div className="mx-auto max-w-7xl p-4">
      <h1 className="text-2xl font-semibold mb-4">foldMAP</h1>

      {/* Controls */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <section className="border rounded-2xl p-4">
            <div className="font-semibold mb-2">Data</div>
            <div className="text-xs text-gray-600">Annotation CSV</div>
            <input ref={annRef} type="file" accept=".csv" onChange={onAnnFile} />
            <div className="text-xs text-gray-600 mt-3">Interactions (.bed / .csv) — you can select multiple</div>
            <input ref={intRef} type="file" accept=".bed,.csv" multiple onChange={onIntsFile} />
            <p className="text-[11px] text-gray-500 mt-2">
              Annotation columns supported: headerless or headered. Interactions: 2 coordinate columns.
            </p>
          </section>

          <section className="border rounded-2xl p-4 space-y-3">
            <div className="font-semibold">Gene</div>
            <input
              className="border rounded px-2 py-1 w-full"
              placeholder="Enter RNA (case-insensitive)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="text-xs text-gray-500">
              {geneRow ? (
                <>
                  Selected: <span className="font-medium">{geneRow.gene_name}</span> —{" "}
                  {geneRow.start}–{geneRow.end} ({(geneRow.strand || "+").toString()})
                </>
              ) : (
                <>Type a gene name to match from your annotation…</>
              )}
            </div>
          </section>

          <section className="border rounded-2xl p-4 space-y-3">
            <div className="font-semibold">Map options</div>

            <label className="text-xs text-gray-600">Bin size: {bin} nt</label>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={bin}
              onChange={(e) => setBin(Number(e.target.value))}
              className="w-full"
            />

            <label className="text-xs text-gray-600">Flank (each side): {flank} nt</label>
            <input
              type="range"
              min={0}
              max={500}
              step={10}
              value={flank}
              onChange={(e) => setFlank(Number(e.target.value))}
              className="w-full"
            />

            <div className="text-xs text-gray-700 flex items-center gap-2">
              <span>Normalization:</span>
              <select
                className="border rounded px-2 py-1"
                value={norm}
                onChange={(e) => setNorm(e.target.value as any)}
              >
                <option value="raw">Raw</option>
                <option value="cov">Coverage</option>
                <option value="ice">ICE</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                className="border rounded px-3 py-1 disabled:opacity-50"
                disabled={!geneRow || !matBundle}
                onClick={exportMatrixSVG}
              >
                Export map SVG
              </button>
            </div>
          </section>

          <section className="border rounded-2xl p-4 space-y-3">
            <div className="font-semibold">Long-range profile</div>

            <label className="text-xs text-gray-600">Smoothing window: {profileWin} nt</label>
            <input
              type="range"
              min={1}
              max={31}
              step={2}
              value={profileWin}
              onChange={(e) => setProfileWin(Number(e.target.value))}
              className="w-full"
            />

            <label className="text-xs text-gray-600">Peak min distance: {profileMinDist} nt</label>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={profileMinDist}
              onChange={(e) => setProfileMinDist(Number(e.target.value))}
              className="w-full"
            />

            <label className="text-xs text-gray-600">Prominence factor: {profilePromFactor.toFixed(2)} × σ</label>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={Math.round(profilePromFactor * 100)}
              onChange={(e) => setProfilePromFactor(Number(e.target.value) / 100)}
              className="w-full"
            />

            <div className="flex gap-2 pt-2">
              <button
                className="border rounded px-3 py-1 disabled:opacity-50"
                disabled={!geneRow || !longProfile}
                onClick={exportProfileSVG}
              >
                Export profile SVG
              </button>
              <button
                className="border rounded px-3 py-1 disabled:opacity-50"
                disabled={!geneRow || !longProfile}
                onClick={exportPeaksCSV}
              >
                Export maxima CSV
              </button>
            </div>
          </section>
        </div>

        {/* Plots */}
        <div className="col-span-12 lg:col-span-9 space-y-4">
          <section className="border rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-700">
                Intramolecular contact map {geneRow ? `— ${geneRow.gene_name}` : ""}
              </div>
              {matBundle && (
                <div className="text-[11px] text-gray-500">
                  bins: {matBundle.nBins} × {matBundle.nBins} (bin {bin} nt, flank {flank} nt)
                </div>
              )}
            </div>

            <div className="w-full overflow-auto">
              {dispMat ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={640}
                  height={640}
                  className="mx-auto block border rounded"
                >
                  {/* render matrix as rects */}
                  {(() => {
                    const mat = dispMat;
                    const n = mat.length;
                    const m = mat[0]?.length || 0;
                    const pad = 24;
                    const W = 592; // 640 - padding
                    const H = 592;
                    const x0 = 24,
                      y0 = 24;
                    const cw = W / Math.max(1, m);
                    const ch = H / Math.max(1, n);
                    const vals = mat.flat().filter((v) => v > 0);
                    const vmax = vals.length ? percentile(vals, 95) : 1;
                    const color = (v: number) => {
                      const t = Math.min(1, v / (vmax || 1));
                      const r = 255,
                        g = Math.round(255 * (1 - t)),
                        b = Math.round(255 * (1 - t));
                      return `rgb(${r},${g},${b})`;
                    };
                    const cells: JSX.Element[] = [];
                    for (let i = 0; i < n; i++) {
                      for (let j = 0; j < m; j++) {
                        const v = mat[i][j] as number;
                        cells.push(
                          <rect
                            key={`${i}-${j}`}
                            x={x0 + j * cw}
                            y={y0 + i * ch}
                            width={cw}
                            height={ch}
                            fill={v > 0 ? color(v) : "#ffffff"}
                          />
                        );
                      }
                    }
                    return cells;
                  })()}
                </svg>
              ) : (
                <div className="text-sm text-gray-500 p-6 text-center">
                  Load annotation + interactions, enter a gene, and you’ll see the map here.
                </div>
              )}
            </div>
          </section>

          <section className="border rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-700">
                Long-range (&gt; 5 kb) interaction profile {geneRow ? `— ${geneRow.gene_name}` : ""}
              </div>
              {longProfile && (
                <div className="text-[11px] text-gray-500">
                  peaks: {longProfile.peaks.length} • window: {profileWin}
                </div>
              )}
            </div>

            <div className="w-full overflow-auto">
              {longProfile ? (
                <svg xmlns="http://www.w3.org/2000/svg" width={800} height={280} className="mx-auto block">
                  {(() => {
                    const W = 800,
                      H = 280;
                    const padL = 48,
                      padR = 18,
                      padT = 16,
                      padB = 40;
                    const innerW = W - padL - padR;
                    const innerH = H - padT - padB;
                    const vals = longProfile.smooth;
                    const maxY = Math.max(1, ...vals);
                    const xScale = (i: number) => padL + (i / Math.max(1, vals.length - 1)) * innerW;
                    const yScale = (v: number) => padT + innerH - (v / maxY) * innerH;

                    const bars: JSX.Element[] = [];
                    const w = Math.max(1, innerW / Math.max(1, vals.length));
                    for (let i = 0; i < vals.length; i++) {
                      const x = xScale(i);
                      const y = yScale(vals[i]);
                      bars.push(<rect key={i} x={x} y={y} width={w} height={padT + innerH - y} fill="#e5e7eb" />);
                    }

                    const dots = longProfile.peaks.map((i, k) => (
                      <circle key={k} cx={xScale(i)} cy={yScale(vals[i])} r={3} fill="#ef4444" />
                    ));

                    // axes labels
                    return (
                      <>
                        <rect x={0} y={0} width={W} height={H} fill="#ffffff" />
                        {bars}
                        {dots}
                        <text x={padL + innerW / 2} y={H - 10} textAnchor="middle" fontSize={11} fill="#6b7280">
                          Position along RNA (nt, 5′ → 3′)
                        </text>
                        <text
                          x={14}
                          y={padT + innerH / 2}
                          fontSize={11}
                          fill="#6b7280"
                          transform={`rotate(-90 14 ${padT + innerH / 2})`}
                          textAnchor="middle"
                        >
                          Smoothed ligation events
                        </text>
                      </>
                    );
                  })()}
                </svg>
              ) : (
                <div className="text-sm text-gray-500 p-6 text-center">
                  Provide data + gene to see the long-range profile.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
