"use client";

import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";

type Annotation = {
  gene_name: string;
  start: number;
  end: number;
  strand?: "+" | "-" | string;
  chromosome?: string;
};

type Interaction = { c1: number; c2: number };

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
    let s = 0, c = 0;
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
  const filtered: number[] = [];
  peaks.sort((a, b) => sig[b] - sig[a]);
  const taken = new Array(sig.length).fill(false);
  for (const p of peaks) {
    let ok = true;
    for (let j = Math.max(0, p - minDistance); j <= Math.min(sig.length - 1, p + minDistance); j++) {
      if (taken[j]) { ok = false; break; }
    }
    if (!ok) continue;
    const left = Math.max(0, p - minDistance);
    const right = Math.min(sig.length - 1, p + minDistance);
    const localMin = Math.min(...sig.slice(left, right + 1));
    if (sig[p] - localMin >= minProm) { filtered.push(p); taken[p] = true; }
  }
  return filtered.sort((a, b) => a - b);
}
function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function parseAnnotationCSV(text: string): Annotation[] {
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
    return (data as any[])
      .filter((r) => r[0] && r[1] != null && r[2] != null)
      .map((r) => ({
        gene_name: String(r[0]).trim(),
        start: Number(r[1]),
        end: Number(r[2]),
        strand: r[4] ?? r[3],
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
      const { data } = Papa.parse<any>(text, { header: false, dynamicTyping: true, skipEmptyLines: true });
      for (const r of data as any[]) {
        const c1 = Number(r[0]); const c2 = Number(r[1]);
        if (Number.isFinite(c1) && Number.isFinite(c2)) all.push({ c1, c2 });
      }
    } else if (isBed) {
      const skipHeader = firstLine.startsWith("track") || firstLine.startsWith("browser") ? 1 : 0;
      const body = lines.slice(skipHeader);
      for (const ln of body) {
        const t = ln.split(/\t|,/);
        if (t.length < 3) continue;
        const c1 = Number(t[1]); const c2 = Number(t[2]);
        if (Number.isFinite(c1) && Number.isFinite(c2)) all.push({ c1, c2 });
      }
    } else {
      for (const ln of lines) {
        const t = ln.split(/\t|,/);
        if (t.length < 2) continue;
        const c1 = Number(t[0]); const c2 = Number(t[1]);
        if (Number.isFinite(c1) && Number.isFinite(c2)) all.push({ c1, c2 });
      }
    }
  }
  return all;
}

function buildSelfMatrix(
  interactions: Interaction[],
  start: number,
  end: number,
  strand: string | undefined,
  flank: number,
  bin: number
) {
  const ws = Math.max(1, start - flank);
  const we = end + flank;
  const length = we - ws + 1;
  const nBins = Math.max(1, Math.ceil(length / bin));
  const toPos = (coord: number) => (strand === "-" ? we - coord : coord - ws);
  const inWin = (c: number) => c >= ws && c <= we;

  const mat = new Array(nBins).fill(0).map(() => new Array(nBins).fill(0));
  for (const { c1, c2 } of interactions) {
    if (!inWin(c1) || !inWin(c2)) continue;
    const p1 = toPos(c1); const p2 = toPos(c2);
    if (p1 < 0 || p2 < 0) continue;
    const b1 = Math.floor(p1 / bin); const b2 = Math.floor(p2 / bin);
    if (b1 < 0 || b1 >= nBins || b2 < 0 || b2 >= nBins) continue;
    mat[b1][b2] += 1; if (b1 !== b2) mat[b2][b1] += 1;
  }

  // ICE only (coverage removed per request)
  const ice = mat.map((row) => row.map((v) => v));
  const n = ice.length;
  let bias = new Array(n).fill(1);
  for (let it = 0; it < 200; it++) {
    const adj = new Array(n).fill(0).map(() => new Array(n).fill(0));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) adj[i][j] = bias[i] && bias[j] ? ice[i][j] / (bias[i] * bias[j]) : 0;
    const rowSums = adj.map((row) => row.reduce((s, v) => s + v, 0));
    const m = mean(rowSums) || 1;
    const newBias = bias.map((b, i) => (rowSums[i] ? b * (rowSums[i] / m) : b));
    const change = Math.sqrt(mean(newBias.map((v, i) => (v - bias[i]) * (v - bias[i]))));
    bias = newBias.map((v) => (v ? v / (mean(newBias) || 1) : 1));
    if (change < 1e-4) break;
  }
  const iceOut = new Array(n).fill(0).map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) iceOut[i][j] = bias[i] && bias[j] ? ice[i][j] / (bias[i] * bias[j]) : 0;

  return { ws, we, length, nBins, raw: mat, ice: iceOut, bin, start, end };
}

function percentile(arr: number[], p: number) {
  const a = arr.slice().sort((x, y) => x - y);
  if (!a.length) return 0;
  const idx = (p / 100) * (a.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return a[lo];
  const t = idx - lo;
  return a[lo] * (1 - t) + a[hi] * t;
}

export default function FoldMapPage() {
  const [ann, setAnn] = useState<Annotation[]>([]);
  const [ints, setInts] = useState<Interaction[]>([]);

  const [inputGene, setInputGene] = useState("");
  const [selectedGene, setSelectedGene] = useState("");

  const [bin, setBin] = useState(10);
  const [flank, setFlank] = useState(200);
  const [norm, setNorm] = useState<"raw" | "ice">("raw");

  const [profileWin, setProfileWin] = useState(5);
  const [profileMinDist, setProfileMinDist] = useState(3);
  const [profilePromFactor, setProfilePromFactor] = useState(0.25);

  const annRef = useRef<HTMLInputElement>(null);
  const intRef = useRef<HTMLInputElement>(null);

  // Only resolve the gene AFTER submit
  const geneRow = useMemo(() => {
    if (!ann.length || !selectedGene.trim()) return undefined;
    const q = selectedGene.trim().toLowerCase();
    return ann.find((a) => a.gene_name.toLowerCase() === q) || ann.find((a) => a.gene_name.toLowerCase().includes(q));
  }, [ann, selectedGene]);

  // Shared window for both plots
  const windowBundle = useMemo(() => {
    if (!geneRow) return undefined;
    const ws = Math.max(1, geneRow.start - clamp(flank, 0, 500));
    const we = geneRow.end + clamp(flank, 0, 500);
    return { ws, we, width: we - ws + 1 };
  }, [geneRow, flank]);

  const matBundle = useMemo(() => {
    if (!geneRow || !ints.length) return undefined;
    return buildSelfMatrix(ints, geneRow.start, geneRow.end, geneRow.strand, clamp(flank, 0, 500), clamp(bin, 1, 200));
  }, [geneRow, ints, flank, bin]);

  const longProfile = useMemo(() => {
    if (!geneRow || !ints.length || !windowBundle) return undefined;
    const { ws, we, width } = windowBundle;
    const strand = (geneRow.strand || "+").toString();

    const inWin = (c: number) => c >= ws && c <= we;
    const inNear = (c: number) => c >= ws - 5000 && c <= we + 5000;

    const within = ints.filter(({ c1, c2 }) => (inWin(c1) && !inNear(c2)) || (inWin(c2) && !inNear(c1)));
    const prof = new Array(width).fill(0);

    const toPos = (c: number) => (strand === "-" ? we - c : c - ws);

    for (const { c1, c2 } of within) {
      if (inWin(c1) && !inNear(c2)) {
        const p = toPos(c1);
        if (p >= 0 && p < width) prof[p] += 1;
      }
      if (inWin(c2) && !inNear(c1)) {
        const p = toPos(c2);
        if (p >= 0 && p < width) prof[p] += 1;
      }
    }
    const sm = movingAverage(prof, clamp(profileWin, 1, 51));
    const peaks = findLocalMaxima(sm, clamp(profileMinDist, 1, 50), std(sm) * profilePromFactor);
    return { ws, we, prof, smooth: sm, peaks };
  }, [geneRow, ints, windowBundle, profileWin, profileMinDist, profilePromFactor]);

  async function onAnnFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const text = await f.text();
    setAnn(parseAnnotationCSV(text));
  }
  async function onIntsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const arr = await parseInteractionFiles(e.target.files);
    setInts(arr);
  }

  function onSubmitGene(e: React.FormEvent) {
    e.preventDefault();
    setSelectedGene(inputGene); // commit selection
  }

  function exportMatrixSVG() {
    if (!geneRow || !matBundle || !windowBundle) return;
    const mat = norm === "raw" ? matBundle.raw : matBundle.ice;
    // Use the same width and x scaling as the profile
    const width = 840, height = 680;
    const padL = 54, padR = 18, padT = 44, padB = 44;
    const W = width - padL - padR, H = height - padT - padB;
    const cw = W / matBundle.nBins, ch = H / matBundle.nBins;

    const vals = (mat as number[][]).flat().filter((v) => v > 0);
    const vmax = vals.length ? percentile(vals, 95) : 1;
    const color = (v: number) => {
      const t = Math.min(1, v / (vmax || 1));
      const r = 255, g = Math.round(255 * (1 - t)), b = Math.round(255 * (1 - t));
      return `rgb(${r},${g},${b})`;
    };

    // gene boundaries in bin space
    const bStart = Math.floor((geneRow.start - matBundle.ws) / matBundle.bin);
    const bEndEdge = Math.floor((geneRow.end - matBundle.ws) / matBundle.bin) + 1;

    let rects = "";
    for (let i = 0; i < matBundle.nBins; i++) {
      for (let j = 0; j < matBundle.nBins; j++) {
        const v = (mat as number[][])[i][j];
        // Original Y orientation (top to bottom)
        rects += `<rect x="${padL + j * cw}" y="${padT + i * ch}" width="${cw}" height="${ch}" fill="${v > 0 ? color(v) : "#ffffff"}"/>`;
      }
    }

    // overlays for flanks + gene region lines
    const lfW = bStart * cw, rfX = padL + bEndEdge * cw, rfW = W - bEndEdge * cw;
    const overlay = `
      <rect x="${padL}" y="${padT}" width="${lfW}" height="${H}" fill="#000000" opacity="0.04"/>
      <rect x="${rfX}" y="${padT}" width="${rfW}" height="${H}" fill="#000000" opacity="0.04"/>
      <line x1="${padL + bStart * cw}" y1="${padT}" x2="${padL + bStart * cw}" y2="${padT + H}" stroke="#111827" stroke-width="1"/>
      <line x1="${padL + bEndEdge * cw}" y1="${padT}" x2="${padL + bEndEdge * cw}" y2="${padT + H}" stroke="#111827" stroke-width="1"/>
      <line x1="${padL}" y1="${padT + bStart * ch}" x2="${padL + W}" y2="${padT + bStart * ch}" stroke="#111827" stroke-width="1"/>
      <line x1="${padL}" y1="${padT + bEndEdge * ch}" x2="${padL + W}" y2="${padT + bEndEdge * ch}" stroke="#111827" stroke-width="1"/>
    `;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>
      <text x="${padL}" y="${padT - 10}" font-family="ui-sans-serif" font-size="12">${geneRow.gene_name} — ${norm.toUpperCase()} (bin ${matBundle.bin} nt, flank ${flank} nt)</text>
      ${rects}
      ${overlay}
      <text x="${padL + W / 2}" y="${height - 10}" text-anchor="middle" font-size="11" fill="#6b7280">5′ → 3′ (bins)</text>
      <text transform="translate(18,${padT + H / 2}) rotate(-90)" font-size="11" fill="#6b7280">5′ → 3′ (bins)</text>
    </svg>`;
    downloadText(`${geneRow.gene_name}_foldMAP_${norm}.svg`, svg);
  }

  function exportProfileSVG() {
    if (!geneRow || !longProfile || !windowBundle) return;
    const width = 840, height = 300;
    const padL = 54, padR = 18, padT = 28, padB = 44;
    const innerW = width - padL - padR, innerH = height - padT - padB;
    const vals = longProfile.smooth;
    const maxY = Math.max(1, ...vals);
    const xScale = (i: number) => padL + (i / Math.max(1, vals.length - 1)) * innerW;
    const yScale = (v: number) => padT + innerH - (v / maxY) * innerH;

    // boundaries relative to window (left flank / gene / right flank)
    const geneStartPos = geneRow.start - longProfile.ws;
    const geneEndPos = geneRow.end - longProfile.ws;

    let bars = "";
    const w = Math.max(1, innerW / Math.max(1, vals.length));
    for (let i = 0; i < vals.length; i++) {
      const x = xScale(i), y = yScale(vals[i]);
      bars += `<rect x="${x}" y="${y}" width="${w}" height="${padT + innerH - y}" fill="#e5e7eb"/>`;
    }

    let dots = "";
    longProfile.peaks.forEach((i) => {
      dots += `<circle cx="${xScale(i)}" cy="${yScale(vals[i])}" r="3" fill="#ef4444"/>`;
    });

    const overlay = `
      <rect x="${padL}" y="${padT}" width="${xScale(geneStartPos) - padL}" height="${innerH}" fill="#000000" opacity="0.04"/>
      <rect x="${xScale(geneEndPos)}" y="${padT}" width="${padL + innerW - xScale(geneEndPos)}" height="${innerH}" fill="#000000" opacity="0.04"/>
      <line x1="${xScale(geneStartPos)}" y1="${padT}" x2="${xScale(geneStartPos)}" y2="${padT + innerH}" stroke="#111827" stroke-width="1"/>
      <line x1="${xScale(geneEndPos)}" y1="${padT}" x2="${xScale(geneEndPos)}" y2="${padT + innerH}" stroke="#111827" stroke-width="1"/>
    `;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>
      <text x="${padL}" y="${padT - 10}" font-family="ui-sans-serif" font-size="12">Long-range (≥ 5 kb) interaction profile — ${geneRow.gene_name}</text>
      ${bars}
      ${overlay}
      ${dots}
      <text x="${padL + innerW / 2}" y="${height - 12}" text-anchor="middle" font-size="11" fill="#6b7280">Window (5′ → 3′): flank — gene — flank</text>
      <text transform="translate(18,${padT + innerH / 2}) rotate(-90)" font-size="11" fill="#6b7280">Smoothed ligation events</text>
    </svg>`;
    downloadText(`${geneRow.gene_name}_longrange_profile.svg`, svg);
  }

  function exportPeaksCSV() {
    if (!geneRow || !longProfile) return;
    const rows = [["Feature_Type", "Position_in_window(nt)", "Notes"]];
    longProfile.peaks.forEach((p) => rows.push(["Maxima (ssRNA)", String(p + 1), "long-range maxima"]));
    downloadText(`${geneRow.gene_name}_longrange_maxima.csv`, rows.map((r) => r.join(",")).join("\n"));
  }

  const dispMat = useMemo(() => {
    if (!matBundle) return undefined;
    return norm === "raw" ? matBundle.raw : matBundle.ice;
  }, [matBundle, norm]);

  // x axis bin count and scale for both plots
  const sharedXAxis = useMemo(() => {
    if (!windowBundle) return undefined;
    return {
      width: 840,
      padL: 54,
      padR: 18,
      W: 840 - 54 - 18,
      ws: windowBundle.ws,
      we: windowBundle.we,
      nBins: windowBundle.we - windowBundle.ws + 1,
    };
  }, [windowBundle]);

  return (
    <div className="mx-auto max-w-7xl p-4">
      <h1 className="text-2xl font-semibold mb-4">foldMAP</h1>

      <div className="grid grid-cols-12 gap-4">
        {/* Controls */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <section className="border rounded-2xl p-4">
            <div className="font-semibold mb-2">Data</div>
            <div className="text-xs text-gray-600">Annotation CSV</div>
            <input ref={annRef} type="file" accept=".csv" onChange={onAnnFile} />
            <div className="text-xs text-gray-600 mt-3">Interactions (.bed / .csv) — you can select multiple</div>
            <input ref={intRef} type="file" accept=".bed,.csv" multiple onChange={onIntsFile} />
            <p className="text-[11px] text-gray-500 mt-2">
              Annotation: headerless or headered. Interactions: two coordinate columns.
            </p>
          </section>

          <section className="border rounded-2xl p-4 space-y-3">
            <div className="font-semibold">Gene</div>
            <form className="flex gap-2" onSubmit={onSubmitGene}>
              <input
                className="border rounded px-2 py-1 w-full"
                placeholder="Enter RNA (case-insensitive)"
                value={inputGene}
                onChange={(e) => setInputGene(e.target.value)}
              />
              <button className="border rounded px-3 py-1">Load</button>
            </form>
            <div className="text-xs text-gray-500">
              {geneRow ? (
                <>Loaded: <span className="font-medium">{geneRow.gene_name}</span> — {geneRow.start}–{geneRow.end} ({(geneRow.strand || "+").toString()})</>
              ) : selectedGene ? (
                <>No match for “{selectedGene}”.</>
              ) : (
                <>Type a gene and press Load.</>
              )}
            </div>
          </section>

          <section className="border rounded-2xl p-4 space-y-3">
            <div className="font-semibold">Map options</div>

            <label className="text-xs text-gray-600">Bin size: {bin} nt</label>
            <input type="range" min={5} max={50} step={5} value={bin} onChange={(e) => setBin(Number(e.target.value))} className="w-full" />

            <label className="text-xs text-gray-600">Flank (each side): {flank} nt</label>
            <input type="range" min={0} max={500} step={10} value={flank} onChange={(e) => setFlank(Number(e.target.value))} className="w-full" />

            <div className="text-xs text-gray-700 flex items-center gap-2">
              <span>Normalization:</span>
              <select className="border rounded px-2 py-1" value={norm} onChange={(e) => setNorm(e.target.value as any)}>
                <option value="raw">Raw</option>
                <option value="ice">ICE</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button className="border rounded px-3 py-1 disabled:opacity-50" disabled={!geneRow || !matBundle} onClick={exportMatrixSVG}>
                Export map SVG
              </button>
            </div>
          </section>

          <section className="border rounded-2xl p-4 space-y-3">
            <div className="font-semibold">Long-range profile</div>

            <label className="text-xs text-gray-600">Smoothing window: {profileWin} nt</label>
            <input type="range" min={1} max={31} step={2} value={profileWin} onChange={(e) => setProfileWin(Number(e.target.value))} className="w-full" />

            <label className="text-xs text-gray-600">Peak min distance: {profileMinDist} nt</label>
            <input type="range" min={1} max={30} step={1} value={profileMinDist} onChange={(e) => setProfileMinDist(Number(e.target.value))} className="w-full" />

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
              <button className="border rounded px-3 py-1 disabled:opacity-50" disabled={!geneRow || !longProfile} onClick={exportProfileSVG}>
                Export profile SVG
              </button>
              <button className="border rounded px-3 py-1 disabled:opacity-50" disabled={!geneRow || !longProfile} onClick={exportPeaksCSV}>
                Export maxima CSV
              </button>
            </div>
          </section>
        </div>

// ... (previous code unchanged above)

        {/* Plots */}
        <div className="col-span-12 lg:col-span-9 space-y-4">
          {/* Combined figure: both map and profile, shared x-axis */}
          <section className="border rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-700">
                {geneRow ? `Intramolecular contact map & long-range profile — ${geneRow.gene_name}` : "Intramolecular contact map & long-range profile"}
              </div>
              {matBundle && longProfile && (
                <div className="text-[11px] text-gray-500">
                  bins: {matBundle.nBins} × {matBundle.nBins} (bin {matBundle.bin} nt, flank {flank} nt) • peaks: {longProfile.peaks.length}
                </div>
              )}
            </div>
            <div className="w-full overflow-auto">
              {geneRow && dispMat && longProfile && sharedXAxis ? (
                <svg xmlns="http://www.w3.org/2000/svg" width={sharedXAxis.width} height={1000} className="mx-auto block border rounded">
                  {(() => {
                    // MAP
                    const padL = sharedXAxis.padL, padR = sharedXAxis.padR, padT = 44, padB = 44;
                    const W = sharedXAxis.W, H = 680 - padT - padB;
                    const mapMat = dispMat as number[][];
                    const mapVals = mapMat.flat().filter((v) => v > 0);
                    const mapVmax = mapVals.length ? percentile(mapVals, 95) : 1;
                    const mapColor = (v: number) => {
                      const t = Math.min(1, v / (mapVmax || 1));
                      const r = 255, g = Math.round(255 * (1 - t)), b = Math.round(255 * (1 - t));
                      return `rgb(${r},${g},${b})`;
                    };
                    const mapY0 = padT;
                    const mapCw = W / matBundle!.nBins, mapCh = H / matBundle!.nBins;
                    // gene region + flanks
                    const bStart = Math.floor((geneRow.start - matBundle!.ws) / matBundle!.bin);
                    const bEndEdge = Math.floor((geneRow.end - matBundle!.ws) / matBundle!.bin) + 1;
                    const leftW = bStart * mapCw, rightX = padL + bEndEdge * mapCw, rightW = W - bEndEdge * mapCw;
                    const mapCells: JSX.Element[] = [];
                    for (let i = 0; i < matBundle!.nBins; i++) {
                      for (let j = 0; j < matBundle!.nBins; j++) {
                        const v = mapMat[i][j];
                        mapCells.push(
                          <rect
                            key={`${i}-${j}`}
                            x={padL + j * mapCw}
                            y={mapY0 + i * mapCh}
                            width={mapCw}
                            height={mapCh}
                            fill={v > 0 ? mapColor(v) : "#ffffff"}
                          />
                        );
                      }
                    }
                    // overlays/lines (same as SVG export)
                    const overlay = (
                      <>
                        <rect x={padL} y={mapY0} width={leftW} height={H} fill="#000000" opacity="0.04" />
                        <rect x={rightX} y={mapY0} width={rightW} height={H} fill="#000000" opacity="0.04" />
                        <line x1={padL + bStart * mapCw} y1={mapY0} x2={padL + bStart * mapCw} y2={mapY0 + H} stroke="#111827" strokeWidth={1} />
                        <line x1={padL + bEndEdge * mapCw} y1={mapY0} x2={padL + bEndEdge * mapCw} y2={mapY0 + H} stroke="#111827" strokeWidth={1} />
                        <line x1={padL} y1={mapY0 + bStart * mapCh} x2={padL + W} y2={mapY0 + bStart * mapCh} stroke="#111827" strokeWidth={1} />
                        <line x1={padL} y1={mapY0 + bEndEdge * mapCh} x2={padL + W} y2={mapY0 + bEndEdge * mapCh} stroke="#111827" strokeWidth={1} />
                      </>
                    );

                    // PROFILE
                    const profilePadT = padT + H + 30, profilePadB = 44, profileHeight = 300, profileInnerH = profileHeight - 28 - profilePadB;
                    const profileVals = longProfile.smooth;
                    const maxY = Math.max(1, ...profileVals);
                    const xScale = (i: number) => padL + (i / Math.max(1, profileVals.length - 1)) * W;
                    const yScale = (v: number) => profilePadT + 28 + profileInnerH - (v / maxY) * profileInnerH;
                    const geneStartPos = geneRow.start - longProfile.ws;
                    const geneEndPos = geneRow.end - longProfile.ws;
                    const w = Math.max(1, W / Math.max(1, profileVals.length));
                    const bars: JSX.Element[] = [];
                    for (let i = 0; i < profileVals.length; i++) {
                      const x = xScale(i), y = yScale(profileVals[i]);
                      bars.push(<rect key={i} x={x} y={y} width={w} height={profilePadT + 28 + profileInnerH - y} fill="#e5e7eb" />);
                    }
                    const dots = longProfile.peaks.map((i, k) => <circle key={k} cx={xScale(i)} cy={yScale(profileVals[i])} r={3} fill="#ef4444" />);
                    const profileOverlay = (
                      <>
                        <rect x={padL} y={profilePadT + 28} width={xScale(geneStartPos) - padL} height={profileInnerH} fill="#000000" opacity="0.04" />
                        <rect x={xScale(geneEndPos)} y={profilePadT + 28} width={padL + W - xScale(geneEndPos)} height={profileInnerH} fill="#000000" opacity="0.04" />
                        <line x1={xScale(geneStartPos)} y1={profilePadT + 28} x2={xScale(geneStartPos)} y2={profilePadT + 28 + profileInnerH} stroke="#111827" strokeWidth={1} />
                        <line x1={xScale(geneEndPos)} y1={profilePadT + 28} x2={xScale(geneEndPos)} y2={profilePadT + 28 + profileInnerH} stroke="#111827" strokeWidth={1} />
                      </>
                    );

                    // x-axis (drawn only once, at the bottom)
                    return (
                      <>
                        {/* Map */}
                        <rect x="0" y="0" width={sharedXAxis.width} height={padT + H} fill="#fff" />
                        <text x={padL} y={padT - 10} fontFamily="ui-sans-serif" fontSize={12}>{geneRow.gene_name} — {norm.toUpperCase()} (bin {matBundle.bin} nt, flank {flank} nt)</text>
                        {mapCells}
                        {overlay}
                        <text x={padL + W / 2} y={padT + H + 20} textAnchor="middle" fontSize={11} fill="#6b7280">5′ → 3′ (bins)</text>
                        <text transform={`translate(18,${padT + H / 2}) rotate(-90)`} fontSize={11} fill="#6b7280" textAnchor="middle">5′ → 3′ (bins)</text>

                        {/* Profile */}
                        <rect x="0" y={profilePadT} width={sharedXAxis.width} height={profileHeight} fill="#fff" />
                        <text x={padL} y={profilePadT + 18} fontFamily="ui-sans-serif" fontSize={12}>Long-range (≥ 5 kb) interaction profile — {geneRow.gene_name}</text>
                        {bars}
                        {profileOverlay}
                        {dots}
                        <text x={padL + W / 2} y={profilePadT + profileHeight - 12} textAnchor="middle" fontSize={11} fill="#6b7280">Window (5′ → 3′): flank — gene — flank</text>
                        <text transform={`translate(18,${profilePadT + 28 + profileInnerH / 2}) rotate(-90)`} fontSize={11} fill="#6b7280" textAnchor="middle">Smoothed ligation events</text>
                      </>
                    );
                  })()}
                </svg>
              ) : (
                <div className="text-sm text-gray-500 p-6 text-center">Load data, enter a gene, then press <span className="font-medium">Load</span>.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
