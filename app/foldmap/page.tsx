"use client";

import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";

// ---------- Types ----------
type Annotation = {
  gene_name: string;
  start: number;
  end: number;
  feature_type?: string;
  strand?: "+" | "-" | string;
  chromosome?: string;
};

type Contact = { c1: number; c2: number };

// ---------- Helpers ----------
function toNum(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function parseAnnoCSV(text: string): Annotation[] {
  const { data } = Papa.parse<any>(text, { header: true, dynamicTyping: true, skipEmptyLines: true });
  return (data as any[])
    .filter((r) => r.gene_name && r.start != null && r.end != null)
    .map((r) => ({
      gene_name: String(r.gene_name).trim(),
      start: toNum(r.start),
      end: toNum(r.end),
      feature_type: r.feature_type,
      strand: (r.strand as any) || "+",
      chromosome: r.chromosome,
    }));
}

// Accepts .bed (tab) or .csv with two numeric columns (coords)
function parseContacts(text: string, filename: string): Contact[] {
  const isBed = filename.toLowerCase().endsWith(".bed");
  if (isBed) {
    const lines = text.split(/\r?\n/).filter((l) => l && !/^track|^browser/.test(l));
    const out: Contact[] = [];
    for (const l of lines) {
      const t = l.split(/\t/);
      // BED: we expect genomic positions in columns 2 and 3 (0-based in BED),
      // but your files showed 2 numbers at cols 2 and 3 — we just read both as 1-based for display.
      const a = toNum(t[1]);
      const b = toNum(t[2]);
      if (a && b) out.push({ c1: a, c2: b });
    }
    return out;
  } else {
    // CSV with two columns (any header or none)
    const { data } = Papa.parse<any>(text, { header: false, dynamicTyping: true, skipEmptyLines: true });
    const out: Contact[] = [];
    for (const r of data as any[]) {
      const a = toNum(r[0]);
      const b = toNum(r[1]);
      if (a && b) out.push({ c1: a, c2: b });
    }
    return out;
  }
}

// FASTA: id up to first whitespace; returns {id -> sequence}
function parseFASTA(text: string): Record<string, string> {
  const dict: Record<string, string> = {};
  let cur = "";
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith(">")) {
      cur = line.slice(1).trim().split(/\s+/)[0];
      if (!dict[cur]) dict[cur] = "";
    } else if (cur) {
      dict[cur] += line.trim();
    }
  }
  return dict;
}

// simple SVG export for a container div
function downloadSVG(svgId: string, name: string) {
  const el = document.getElementById(svgId) as SVGSVGElement | null;
  if (!el) return;
  const clone = el.cloneNode(true) as SVGSVGElement;
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent =
    'text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#1f2937;font-size:10px}';
  defs.appendChild(style);
  clone.insertBefore(defs, clone.firstChild);
  const ser = new XMLSerializer();
  const str = ser.serializeToString(clone);
  const blob = new Blob([str], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

// find local maxima with minimum distance and simple prominence
function findLocalMaxima(arr: number[], minDist = 3, minPromRatio = 0.25): number[] {
  const out: number[] = [];
  const sd =
    arr.length > 1
      ? Math.sqrt(
          arr.reduce((s, v) => s + v * v, 0) / arr.length -
            Math.pow(arr.reduce((s, v) => s + v, 0) / arr.length, 2)
        )
      : 0;
  const minProm = sd * minPromRatio;

  for (let i = 1; i < arr.length - 1; i++) {
    if (arr[i] <= arr[i - 1] || arr[i] <= arr[i + 1]) continue;
    // distance check vs already kept peaks
    if (out.length && i - out[out.length - 1] < minDist) {
      if (arr[i] > arr[out[out.length - 1]]) out[out.length - 1] = i;
      continue;
    }
    // crude prominence check
    const left = Math.max(0, i - minDist);
    const right = Math.min(arr.length - 1, i + minDist);
    const localMin = Math.min(...arr.slice(left, right + 1).filter((_, k) => left + k !== i));
    const prom = arr[i] - localMin;
    if (prom >= minProm) out.push(i);
  }
  return out;
}

// ---------- Page ----------
export default function FoldMapPage() {
  // data
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [fastaDict, setFastaDict] = useState<Record<string, string> | null>(null);

  // inputs
  const [gene, setGene] = useState("gcvB"); // case-insensitive
  const [flank, setFlank] = useState(200); // 0–500
  const [bin, setBin] = useState(10); // 5–50
  const [vmax, setVmax] = useState(10); // color max
  const [norm, setNorm] = useState<"raw" | "cov" | "ice">("raw");

  // 1D profile params
  const [lrWindow, setLrWindow] = useState(5); // smoothing window
  const [lrDist, setLrDist] = useState(5); // minima distance between peaks

  const annoFileRef = useRef<HTMLInputElement>(null);
  const contactsRef = useRef<HTMLInputElement>(null);
  const fastaRef = useRef<HTMLInputElement>(null);

  // gene lookup (case-insensitive, supports "5'" / "3'" prefixes)
  const geneRow = useMemo(() => {
    const g = gene.trim().toLowerCase();
    if (!g || annotations.length === 0) return null;
    const candidates = annotations.filter((a) => {
      const name = String(a.gene_name || "").trim();
      const base = name.startsWith("5'") || name.startsWith("3'") ? name.slice(2) : name;
      return name.toLowerCase() === g || base.toLowerCase() === g;
    });
    return candidates.length ? candidates[0] : null;
  }, [gene, annotations]);

  // compute region + matrix
  const { matrix, nBins, label, windowStart, windowEnd } = useMemo(() => {
    if (!geneRow || contacts.length === 0) {
      return { matrix: [[]] as number[][], nBins: 0, label: "", windowStart: 0, windowEnd: 0 };
    }
    const s = Math.min(geneRow.start, geneRow.end);
    const e = Math.max(geneRow.start, geneRow.end);
    const ws = Math.max(1, s - flank);
    const we = e + flank;
    const len = we - ws + 1;
    const NB = Math.max(1, Math.ceil(len / bin));
    const plus = (geneRow.strand || "+") === "+";

    // helpers: coord -> bin index in 5'->3' orientation
    const toBin = (coord: number) => {
      if (plus) return Math.floor((coord - ws) / bin);
      // minus: reverse so 5'->3' of gene is left->right
      return Math.floor((we - coord) / bin);
    };

    // raw
    const raw: number[][] = Array.from({ length: NB }, () => Array(NB).fill(0));
    for (const { c1, c2 } of contacts) {
      const inX = c1 >= ws && c1 <= we;
      const inY = c2 >= ws && c2 <= we;
      if (!inX || !inY) continue;
      const i = toBin(c1);
      const j = toBin(c2);
      if (i >= 0 && i < NB && j >= 0 && j < NB) {
        raw[i][j] += 1;
        if (i !== j) raw[j][i] += 1; // symmetrize
      }
    }

    // coverage norm (divide by total)
    const total = raw.flat().reduce((s, v) => s + v, 0);
    const cov = total > 0 ? raw.map((r) => r.map((v) => v / total)) : raw.map((r) => r.map(() => 0));

    // ICE normalization (simple, small matrices)
    const ice = (() => {
      const n = NB;
      const bias = new Array(n).fill(1);
      let M = raw.map((r) => r.map((v) => (v as number) + 0)); // copy as float
      for (let iter = 0; iter < 250; iter++) {
        // adjust by bias
        const adj = M.map((row, i) => row.map((v, j) => (bias[i] && bias[j] ? v / (bias[i] * bias[j]) : 0)));
        const rowSums = adj.map((row) => row.reduce((s, v) => s + v, 0));
        const mean = rowSums.reduce((s, v) => s + v, 0) / n || 1;
        const newBias = bias.map((b, i) => (rowSums[i] ? b * (rowSums[i] / mean) : b));
        // normalize biases to mean 1
        const bmean = newBias.reduce((s, v) => s + v, 0) / n || 1;
        for (let i = 0; i < n; i++) newBias[i] /= bmean;
        const delta = Math.sqrt(newBias.reduce((s, v, i) => s + Math.pow(v - bias[i], 2), 0)) / n;
        for (let i = 0; i < n; i++) bias[i] = newBias[i];
        if (delta < 1e-5) break;
      }
      const out = M.map((row, i) => row.map((v, j) => (bias[i] && bias[j] ? v / (bias[i] * bias[j]) : 0)));
      return out;
    })();

    const labelTxt = `${geneRow.gene_name}  (bins: ${NB} @ ${bin} nt; flank: ±${flank} nt; strand ${geneRow.strand || "+"})`;
    const chosen =
      norm === "raw" ? raw : norm === "cov" ? cov : ice; // matrix chosen later in render via norm state
    return { matrix: chosen, nBins: NB, label: labelTxt, windowStart: ws, windowEnd: we };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geneRow, contacts, flank, bin, norm]);

  // 1D long-range profile (>5 kb away from gene window)
  const { profile, smooth, peaks, seqContext } = useMemo(() => {
    const empty = { profile: [] as number[], smooth: [] as number[], peaks: [] as number[], seqContext: [] as string[] };
    if (!geneRow || contacts.length === 0) return empty;

    const s = Math.min(geneRow.start, geneRow.end);
    const e = Math.max(geneRow.start, geneRow.end);
    const plus = (geneRow.strand || "+") === "+";
    const length = e - s + 1;
    const flankLR = 5000;

    const inGene1 = (c: number) => c >= s && c <= e;
    const nearGene = (c: number) => c >= s - flankLR && c <= e + flankLR;

    const prof = new Array(length).fill(0);
    for (const { c1, c2 } of contacts) {
      // keep only long-range inter contacts
      if (inGene1(c1) && !nearGene(c2)) {
        const idx = plus ? c1 - s : e - c1;
        if (idx >= 0 && idx < length) prof[idx] += 1;
      } else if (inGene1(c2) && !nearGene(c1)) {
        const idx = plus ? c2 - s : e - c2;
        if (idx >= 0 && idx < length) prof[idx] += 1;
      }
    }
    // smooth (moving average)
    const w = Math.max(1, Math.floor(lrWindow));
    const kernel = new Array(w).fill(1 / w);
    const sm = prof.map((_, i) => {
      let sum = 0;
      for (let k = 0; k < w; k++) {
        const j = i + k - Math.floor(w / 2);
        if (j >= 0 && j < prof.length) sum += prof[j] * kernel[k];
      }
      return sum;
    });
    const pk = findLocalMaxima(sm, Math.max(1, lrDist), 0.25);

    // optional FASTA context (if uploaded)
    let ctx: string[] = [];
    if (fastaDict) {
      const chrom = (geneRow.chromosome || Object.keys(fastaDict)[0] || "").trim();
      const seq = fastaDict[chrom];
      if (seq) {
        const seqStart = s - 1;
        const subseq = seq.substring(seqStart, seqStart + length);
        ctx = pk.map((p) => {
          const flankCtx = 5;
          const a = Math.max(0, p - flankCtx);
          const b = Math.min(subseq.length, p + flankCtx + 1);
          return subseq.substring(a, b);
        });
      }
    }

    return { profile: prof, smooth: sm, peaks: pk, seqContext: ctx };
  }, [geneRow, contacts, lrWindow, lrDist, fastaDict]);

  // ---------- Upload handlers ----------
  async function onAnno(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setAnnotations(parseAnnoCSV(text));
  }
  async function onContacts(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setContacts(parseContacts(text, f.name));
  }
  async function onFASTA(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setFastaDict(parseFASTA(text));
  }

  // choose matrix by current norm
  const heat = matrix;

  // color scale
  const heatMax = useMemo(() => {
    const m = heat.flat().reduce((mx, v) => (v > mx ? v : mx), 0);
    return m || 1;
  }, [heat]);

  const svgVmax = Math.max(1e-9, Math.min(vmax, 1e9));
  const width = 520;
  const height = 520;
  const margin = { top: 30, right: 20, bottom: 40, left: 50 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  // ---------- Render ----------
  return (
    <div className="mx-auto max-w-6xl p-4 space-y-6">
      <h1 className="text-2xl font-semibold">foldMAP</h1>

      <div className="grid grid-cols-12 gap-4">
        {/* Controls */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <section className="border rounded-2xl p-3 space-y-3">
            <div>
              <div className="text-xs text-gray-600 mb-1">RNA (case-insensitive)</div>
              <input
                className="border rounded px-2 py-1 w-full"
                value={gene}
                onChange={(e) => setGene(e.target.value)}
                placeholder="e.g., gcvB"
              />
            </div>

            <div className="text-xs text-gray-600">Pairs / contacts (.bed or .csv)</div>
            <input ref={contactsRef} type="file" accept=".bed,.csv" onChange={onContacts} />
            <div className="text-xs text-gray-600 pt-2">Annotations CSV</div>
            <input ref={annoFileRef} type="file" accept=".csv" onChange={onAnno} />
            <div className="text-xs text-gray-600 pt-2">Optional FASTA (for maxima sequence context)</div>
            <input ref={fastaRef} type="file" accept=".fa,.fasta,.fa.gz,.fna" onChange={onFASTA} />

            <div className="pt-2 border-t" />

            <div className="text-sm font-medium">Heatmap params</div>
            <div className="text-xs text-gray-600">Flank (nt): {flank}</div>
            <input type="range" min={0} max={500} step={10} value={flank} onChange={(e) => setFlank(+e.target.value)} className="w-full" />
            <div className="text-xs text-gray-600">Bin size (nt): {bin}</div>
            <input type="range" min={5} max={50} step={1} value={bin} onChange={(e) => setBin(+e.target.value)} className="w-full" />
            <div className="flex items-center gap-2 text-xs">
              <span>Normalization:</span>
              <select className="border rounded px-1 py-0.5" value={norm} onChange={(e) => setNorm(e.target.value as any)}>
                <option value="raw">Raw</option>
                <option value="cov">Coverage</option>
                <option value="ice">ICE</option>
              </select>
            </div>
            <div className="text-xs text-gray-600">Vmax (color cap): {svgVmax}</div>
            <input type="range" min={1} max={100} step={1} value={vmax} onChange={(e) => setVmax(+e.target.value)} className="w-full" />
          </section>

          <section className="border rounded-2xl p-3 space-y-2">
            <div className="text-sm font-medium">Long-range profile</div>
            <div className="text-xs text-gray-600">Smoothing window: {lrWindow} nt</div>
            <input type="range" min={3} max={31} step={2} value={lrWindow} onChange={(e) => setLrWindow(+e.target.value)} className="w-full" />
            <div className="text-xs text-gray-600">Peak min distance: {lrDist} nt</div>
            <input type="range" min={2} max={30} step={1} value={lrDist} onChange={(e) => setLrDist(+e.target.value)} className="w-full" />
          </section>
        </div>

        {/* Plots */}
        <div className="col-span-12 lg:col-span-9 space-y-6">
          <section className="border rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-700">{geneRow ? label : "Load CSVs and enter a gene"}</div>
              <button
                className="text-xs border rounded px-2 py-1"
                onClick={() => downloadSVG("fold-heatmap", `${gene}_foldMAP_heatmap`)}
              >
                Export SVG
              </button>
            </div>

            <svg id="fold-heatmap" width={width} height={height}>
              <defs>
                <style>
                  {`text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:10px;fill:#374151}`}
                </style>
              </defs>
              <g transform={`translate(${margin.left},${margin.top})`}>
                {/* frame */}
                <rect x={-1} y={-1} width={innerW + 2} height={innerH + 2} fill="none" stroke="#111" strokeWidth={1} />
                {/* axes labels */}
                <text x={innerW / 2} y={innerH + 28} textAnchor="middle">position (5′→3′)</text>
                <text x={-34} y={innerH / 2} transform={`rotate(-90, -34, ${innerH / 2})`} textAnchor="middle">position (5′→3′)</text>

                {/* grid + heat */}
                {nBins > 0 && (
                  <>
                    {/* light grid */}
                    {Array.from({ length: nBins + 1 }).map((_, i) => {
                      const x = (i / nBins) * innerW;
                      const y = (i / nBins) * innerH;
                      return (
                        <g key={i}>
                          <line x1={x} y1={0} x2={x} y2={innerH} stroke="#eee" />
                          <line x1={0} y1={y} x2={innerW} y2={y} stroke="#eee" />
                        </g>
                      );
                    })}
                    {/* cells */}
                    {heat.map((row, i) =>
                      row.map((v, j) => {
                        const x = (j / nBins) * innerW;
                        const y = (i / nBins) * innerH;
                        const w = innerW / nBins;
                        const h = innerH / nBins;
                        // clamp 0..vmax
                        const val = Math.min(v as number, svgVmax);
                        const t = (val as number) / (svgVmax || 1); // 0..1
                        // simple Reds scale
                        const r = Math.round(255 * (0.6 + 0.4 * t));
                        const g = Math.round(255 * (1 - 0.85 * t));
                        const b = Math.round(255 * (1 - 0.85 * t));
                        return <rect key={`${i}-${j}`} x={x} y={y} width={w} height={h} fill={`rgb(${r},${g},${b})`} />;
                      })
                    )}
                  </>
                )}
              </g>
            </svg>
          </section>

          <section className="border rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-700">Long-range (>5 kb) interaction profile {geneRow ? `— ${geneRow.gene_name}` : ""}</div>
              <div className="flex gap-2">
                <button
                  className="text-xs border rounded px-2 py-1"
                  onClick={() => downloadSVG("fold-profile", `${gene}_foldMAP_profile`)}
                >
                  Export SVG
                </button>
                <button
                  className="text-xs border rounded px-2 py-1"
                  onClick={() => {
                    if (!geneRow) return;
                    // export CSV with positions (1-based) and optional sequence context
                    const rows = peaks.map((p, i) => ({
                      position_1based: p + 1,
                      context_5nt_each_side: seqContext[i] || "",
                    }));
                    const csv =
                      "position_1based,context_5nt_each_side\n" +
                      rows.map((r) => `${r.position_1based},${r.context_5nt_each_side}`).join("\n");
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${gene}_foldMAP_longrange_maxima.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export maxima CSV
                </button>
              </div>
            </div>

            {/* 1D profile SVG */}
            <svg id="fold-profile" width={width} height={260}>
              <defs>
                <style>
                  {`text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:10px;fill:#374151}`}
                </style>
              </defs>
              <g transform={`translate(${margin.left},${20})`}>
                <rect x={-1} y={-1} width={innerW + 2} height={200 + 2} fill="none" stroke="#111" strokeWidth={1} />
                {/* axes */}
                <text x={innerW / 2} y={220} textAnchor="middle">nt position (5′→3′)</text>
                <text x={-34} y={100} transform={`rotate(-90, -34, 100)`} textAnchor="middle">ligation events (smoothed)</text>

                {/* bars (raw) */}
                {profile.length > 0 &&
                  profile.map((v, i) => {
                    const x = (i / profile.length) * innerW;
                    const barH = Math.min(200, v); // simple capped bar
                    return <rect key={i} x={x} y={200 - barH} width={Math.max(1, innerW / profile.length)} height={barH} fill="#e5e7eb" />;
                  })}

                {/* smoothed line */}
                {smooth.length > 1 && (
                  <path
                    d={
                      "M" +
                      smooth
                        .map((sv, i) => {
                          const x = (i / (smooth.length - 1)) * innerW;
                          const y = 200 - Math.min(200, sv);
                          return `${x},${y}`;
                        })
                        .join(" L ")
                    }
                    fill="none"
                    stroke="#1f77b4"
                    strokeWidth={1.5}
                  />
                )}

                {/* peaks */}
                {peaks.map((p, k) => {
                  const x = (p / (smooth.length - 1)) * innerW;
                  const y = 200 - Math.min(200, smooth[p] || 0);
                  return <circle key={k} cx={x} cy={y} r={3.5} fill="#ef4444" stroke="white" />;
                })}
              </g>
            </svg>
          </section>
        </div>
      </div>
    </div>
  );
}
