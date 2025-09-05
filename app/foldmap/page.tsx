"use client";

import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { PRESETS } from "@/lib/presets";

type FeatureType =
  | "CDS" | "5'UTR" | "3'UTR" | "ncRNA" | "tRNA" | "rRNA" | "sRNA" | "hkRNA" | "sponge" | string;

type Annotation = {
  gene_name: string;
  start: number;
  end: number;
  strand?: "+" | "-" | string;
  chromosome?: string;
  feature_type?: FeatureType;
};

type Interaction = { c1: number; c2: number };

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
function mean(arr: number[]) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }
function std(arr: number[]) { if (!arr.length) return 0; const m = mean(arr); return Math.sqrt(mean(arr.map(v => (v - m) * (v - m)))); }
function movingAverage(x: number[], k: number) {
  if (k <= 1) return x.slice();
  const half = Math.floor(k / 2), out = new Array(x.length).fill(0);
  for (let i = 0; i < x.length; i++) {
    let s = 0, c = 0;
    for (let j = -half; j <= half; j++) { const idx = i + j; if (idx >= 0 && idx < x.length) { s += x[idx]; c++; } }
    out[i] = c ? s / c : 0;
  }
  return out;
}
function findLocalMaxima(sig: number[], minDistance: number, minProm: number) {
  const peaks: number[] = [];
  for (let i = 1; i < sig.length - 1; i++) if (sig[i] > sig[i - 1] && sig[i] >= sig[i + 1]) peaks.push(i);
  const filtered: number[] = [], taken = new Array(sig.length).fill(false);
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
function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
const cap1 = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
function formatGeneName(name: string, type?: FeatureType): { text: string; italic: boolean } {
  const t = (type || "CDS") as FeatureType;
  return (t === "sRNA" || t === "ncRNA" || t === "sponge") ? { text: cap1(name), italic: false } : { text: name, italic: true };
}

/* ---------------- Small reusable UI ---------------- */
function FilePickerButton({
  id,
  label,
  accept,
  multiple = false,
  onFiles,
}: {
  id: string;
  label: string;
  accept?: string;
  multiple?: boolean;
  onFiles: (files: FileList) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        className="inline-flex h-8 items-center rounded border bg-white px-3 text-sm hover:bg-slate-50"
        onClick={() => {
          if (ref.current) {
            // Allow selecting the same file(s) again
            ref.current.value = "";
            ref.current.click();
          }
        }}
      >
        {label}
      </button>
      <input
        ref={ref}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => { if (e.target.files && e.target.files.length) onFiles(e.target.files); }}
      />
    </>
  );
}

/* ---------------- Parsing ---------------- */
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
        feature_type: r.feature_type,
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
function parseInteractionText(text: string): Interaction[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];
  const out: Interaction[] = [];
  const body = lines.filter(l => !/^track|^browser/i.test(l));
  for (const ln of body) {
    const t = ln.split(/\t|,|\s+/).filter(Boolean);
    if (t.length >= 3 && !isNaN(Number(t[1])) && !isNaN(Number(t[2]))) {
      out.push({ c1: Number(t[1]), c2: Number(t[2]) });
    } else if (t.length >= 2 && !isNaN(Number(t[0])) && !isNaN(Number(t[1]))) {
      out.push({ c1: Number(t[0]), c2: Number(t[1]) });
    }
  }
  return out;
}
async function parseInteractionFiles(files: FileList | null): Promise<Interaction[]> {
  if (!files || files.length === 0) return [];
  const all: Interaction[] = [];
  for (const f of Array.from(files)) {
    const text = await f.text();
    all.push(...parseInteractionText(text));
  }
  return all;
}

/* ---------------- Matrix helpers ---------------- */
function buildSelfMatrixRaw(
  interactions: Interaction[], start: number, end: number, strand: string | undefined, flank: number, bin: number
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
    const p1 = toPos(c1), p2 = toPos(c2);
    const b1 = Math.floor(p1 / bin), b2 = Math.floor(p2 / bin);
    if (b1 >= 0 && b1 < nBins && b2 >= 0 && b2 < nBins) { mat[b1][b2] += 1; if (b1 !== b2) mat[b2][b1] += 1; }
  }
  return { ws, we, length, nBins, raw: mat, bin, start, end };
}
function iceNormalize(raw: number[][], maxIter = 40) {
  const n = raw.length;
  const mat = raw.map(row => row.slice());
  let bias = new Array(n).fill(1);
  for (let it = 0; it < maxIter; it++) {
    const rowSums = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < n; j++) s += bias[i] && bias[j] ? mat[i][j] / (bias[i] * bias[j]) : 0;
      rowSums[i] = s;
    }
    const m = mean(rowSums) || 1;
    let change = 0;
    const newBias = bias.map((b, i) => (rowSums[i] ? b * (rowSums[i] / m) : b));
    const avg = mean(newBias) || 1;
    for (let i = 0; i < n; i++) {
      const v = newBias[i] ? newBias[i] / avg : 1;
      change += (v - bias[i]) * (v - bias[i]);
      bias[i] = v;
    }
    if (Math.sqrt(change / n) < 1e-4) break;
  }
  const out = new Array(n).fill(0).map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out[i][j] = bias[i] && bias[j] ? mat[i][j] / (bias[i] * bias[j]) : 0;
  return out;
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

/* ---------------- Instant demo ---------------- */
function demoFoldData() {
  const ann: Annotation[] = [
    { gene_name: "gene10", start: 1_000_000, end: 1_001_200, strand: "+", feature_type: "CDS" },
  ];
  const ints: Interaction[] = [];
  // dense diagonal around gene10 with flank contacts
  for (let i = 0; i < 900; i++) {
    const a = 1_000_020 + (i % 600);
    const b = 1_000_030 + ((i * 7) % 600);
    ints.push({ c1: a, c2: b });
  }
  // a couple of domain blocks
  for (let i = 0; i < 300; i++) {
    const a = 1_000_100 + (i % 120);
    const b = 1_000_600 + (i % 120);
    ints.push({ c1: a, c2: b });
  }
  // some long-range hits (>= 5 kb away) to feed profile
  for (let i = 0; i < 200; i++) {
    ints.push({ c1: 1_000_050 + (i % 200), c2: 1_010_000 + (i % 500) });
  }
  return { ann, ints };
}

export default function FoldMapPage() {
  const demo = useMemo(demoFoldData, []);
  const [ann, setAnn] = useState<Annotation[]>(demo.ann);
  const [ints, setInts] = useState<Interaction[]>(demo.ints);

  const [annFileName, setAnnFileName] = useState<string | null>(null);
  const [chimeraFilesLabel, setChimeraFilesLabel] = useState<string | null>(null);

  const [inputGene, setInputGene] = useState("gene10");
  const [selectedGene, setSelectedGene] = useState("gene10");

  const [bin, setBin] = useState(20);   // slightly larger bin speeds rendering
  const [flank, setFlank] = useState(200);
  const [norm, setNorm] = useState<"raw" | "ice">("raw"); // raw first → instant

  const [profileWin, setProfileWin] = useState(3);
  const [profileMinDist, setProfileMinDist] = useState(3);
  const [profilePromFactor, setProfilePromFactor] = useState(0.25);

  const geneRow = useMemo(() => {
    if (!ann.length || !selectedGene.trim()) return undefined;
    const q = selectedGene.trim().toLowerCase();
    return ann.find((a) => a.gene_name.toLowerCase() === q) || ann.find((a) => a.gene_name.toLowerCase().includes(q));
  }, [ann, selectedGene]);

  const matRaw = useMemo(() => {
    if (!geneRow || !ints.length) return undefined;
    return buildSelfMatrixRaw(ints, geneRow.start, geneRow.end, geneRow.strand, clamp(flank, 0, 500), clamp(bin, 1, 200));
  }, [geneRow, ints, flank, bin]);

  const matICE = useMemo(() => {
    if (!matRaw) return undefined;
    const ice = iceNormalize(matRaw.raw, 40);
    return { ...matRaw, ice };
  }, [matRaw]);

  const matBundle = norm === "ice" ? matICE : matRaw;

  const longProfile = useMemo(() => {
    if (!geneRow || !ints.length) return undefined;
    const ws = Math.max(1, geneRow.start - clamp(flank, 0, 500));
    const we = geneRow.end + clamp(flank, 0, 500);
    const strand = (geneRow.strand || "+").toString();
    const width = we - ws + 1;

    const inWin = (c: number) => c >= ws && c <= we;
    const inNear = (c: number) => c >= ws - 5000 && c <= we + 5000;

    const within = ints.filter(({ c1, c2 }) => (inWin(c1) && !inNear(c2)) || (inWin(c2) && !inNear(c1)));
    const prof = new Array(width).fill(0);
    const toPos = (c: number) => (strand === "-" ? we - c : c - ws);

    for (const { c1, c2 } of within) {
      if (inWin(c1) && !inNear(c2)) { const p = toPos(c1); if (p >= 0 && p < width) prof[p] += 1; }
      if (inWin(c2) && !inNear(c1)) { const p = toPos(c2); if (p >= 0 && p < width) prof[p] += 1; }
    }
    const sm = movingAverage(prof, clamp(profileWin, 1, 51));
    const peaks = findLocalMaxima(sm, clamp(profileMinDist, 1, 50), std(sm) * profilePromFactor);
    return { ws, we, prof, smooth: sm, peaks };
  }, [geneRow, ints, flank, profileWin, profileMinDist, profilePromFactor]);

  async function onAnnFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const text = await f.text();
    setAnn(parseAnnotationCSV(text));
    setAnnFileName(f.name);
  }
  async function onIntsFileList(files: FileList) {
    const arr = await parseInteractionFiles(files);
    setInts(arr);
    const names = Array.from(files).map(f => f.name);
    setChimeraFilesLabel(names.length ? names.join(", ") : null);
  }
  async function loadPresetAnno(path: string) {
    const res = await fetch(path);
    const text = await res.text();
    setAnn(parseAnnotationCSV(text));
    const base = path.split("/").pop() || path;
    setAnnFileName(base);
  }
  async function loadChimerasFromURL(url: string, label?: string) {
    const res = await fetch(url);
    const text = await res.text();
    const parsed = parseInteractionText(text);
    setInts(parsed);
    setChimeraFilesLabel(label || (new URL(url).pathname.split("/").pop() ?? "contacts"));
  }

  function onSubmitGene(e: React.FormEvent) { e.preventDefault(); setSelectedGene(inputGene); }

  function exportMatrixSVG() {
    if (!geneRow || !matBundle) return;
    const mat = (matBundle as any).ice ?? (matBundle as any).raw;
    const width = 680, height = 680;
    const pad = 44, x0 = pad, y0 = pad, W = width - pad * 2, H = height - pad * 2;
    const cw = W / matBundle.nBins, ch = H / matBundle.nBins;

    const vals = (mat as number[][]).flat().filter((v) => v > 0);
    const vmax = vals.length ? percentile(vals, 95) : 1;
    const color = (v: number) => {
      const t = Math.min(1, v / (vmax || 1));
      const r = 255, g = Math.round(255 * (1 - t)), b = Math.round(255 * (1 - t));
      return `rgb(${r},${g},${b})`;
    };

    const bStart = Math.floor((geneRow.start - matBundle.ws) / matBundle.bin);
    const bEndEdge = Math.floor((geneRow.end - matBundle.ws) / matBundle.bin) + 1;

    let rects = "";
    for (let i = 0; i < matBundle.nBins; i++) {
      for (let j = 0; j < matBundle.nBins; j++) {
        const v = (mat as number[][])[i][j];
        rects += `<rect x="${x0 + j * cw}" y="${y0 + i * ch}" width="${cw}" height="${ch}" fill="${v > 0 ? color(v) : "#ffffff"}"/>`;
      }
    }

    const lfW = bStart * cw, rfX = x0 + bEndEdge * cw, rfW = W - bEndEdge * cw;
    const overlay = `
      <rect x="${x0}" y="${y0}" width="${lfW}" height="${H}" fill="#000000" opacity="0.04"/>
      <rect x="${rfX}" y="${y0}" width="${rfW}" height="${H}" fill="#000000" opacity="0.04"/>
      <line x1="${x0 + bStart * cw}" y1="${y0}" x2="${x0 + bStart * cw}" y2="${y0 + H}" stroke="#111827" stroke-width="1"/>
      <line x1="${x0 + bEndEdge * cw}" y1="${y0}" x2="${x0 + bEndEdge * cw}" y2="${y0 + H}" stroke="#111827" stroke-width="1"/>
      <line x1="${x0}" y1="${y0 + bStart * ch}" x2="${x0 + W}" y2="${y0 + bStart * ch}" stroke="#111827" stroke-width="1"/>
      <line x1="${x0}" y1="${y0 + bEndEdge * ch}" x2="${x0 + W}" y2="${y0 + bEndEdge * ch}" stroke="#111827" stroke-width="1"/>
    `;

    const disp = formatGeneName(geneRow.gene_name, geneRow.feature_type);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>
      <text x="${x0}" y="${y0 - 10}" font-family="ui-sans-serif" font-size="12"${disp.italic ? ' font-style="italic"' : ""}>${disp.text}</text>
      <text x="${x0 + 180}" y="${y0 - 10}" font-family="ui-sans-serif" font-size="12">— ${(matBundle as any).ice ? "ICE" : "RAW"} (bin ${matBundle.bin} nt, flank ${flank} nt)</text>
      ${rects}
      ${overlay}
      <text x="${x0 + W / 2}" y="${height - 10}" text-anchor="middle" font-size="11" fill="#6b7280">5′ → 3′ (bins)</text>
      <text transform="translate(16,${y0 + H / 2}) rotate(-90)" font-size="11" fill="#6b7280">5′ → 3′ (bins)</text>
    </svg>`;
    downloadText(`${disp.text}_foldMAP_${(matBundle as any).ice ? "ICE" : "RAW"}.svg`, svg);
  }

  function exportProfileSVG() {
    if (!geneRow || !longProfile) return;
    const disp = formatGeneName(geneRow.gene_name, geneRow.feature_type);
    const width = 840, height = 300;
    const padL = 54, padR = 18, padT = 28, padB = 44;
    const innerW = width - padL - padR, innerH = height - padT - padB;
    const vals = longProfile.smooth;
    const maxY = Math.max(1, ...vals);
    const xScale = (i: number) => padL + (i / Math.max(1, vals.length - 1)) * innerW;
    const yScale = (v: number) => padT + innerH - (v / maxY) * innerH;

    const geneStartPos = geneRow.start - longProfile.ws;
    const geneEndPos = geneRow.end - longProfile.ws;

    let bars = "";
    const w = Math.max(1, innerW / Math.max(1, vals.length));
    for (let i = 0; i < vals.length; i++) {
      const x = xScale(i), y = yScale(vals[i]);
      bars += `<rect x="${x}" y="${y}" width="${w}" height="${padT + innerH - y}" fill="#e5e7eb"/>`;
    }

    let dots = "";
    longProfile.peaks.forEach((i) => { dots += `<circle cx="${xScale(i)}" cy="${yScale(vals[i])}" r="3" fill="#ef4444"/>`; });

    const overlay = `
      <rect x="${padL}" y="${padT}" width="${xScale(geneStartPos) - padL}" height="${innerH}" fill="#000000" opacity="0.04"/>
      <rect x="${xScale(geneEndPos)}" y="${padT}" width="${padL + innerW - xScale(geneEndPos)}" height="${innerH}" fill="#000000" opacity="0.04"/>
      <line x1="${xScale(geneStartPos)}" y1="${padT}" x2="${xScale(geneStartPos)}" y2="${padT + innerH}" stroke="#111827" stroke-width="1"/>
      <line x1="${xScale(geneEndPos)}" y1="${padT}" x2="${xScale(geneEndPos)}" y2="${padT + innerH}" stroke="#111827" stroke-width="1"/>
    `;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>
      <text x="${padL}" y="${padT - 10}" font-family="ui-sans-serif" font-size="12"${disp.italic ? ' font-style="italic"' : ""}>Long-range (≥ 5 kb) interaction profile — ${disp.text}</text>
      ${bars}
      ${overlay}
      ${dots}
      <text x="${padL + innerW / 2}" y="${height - 12}" text-anchor="middle" font-size="11" fill="#6b7280">Window (5′ → 3′): flank — gene — flank</text>
      <text transform="translate(18,${padT + innerH / 2}) rotate(-90)" font-size="11" fill="#6b7280">Smoothed ligation events</text>
    </svg>`;
    downloadText(`${disp.text}_longrange_profile.svg`, svg);
  }

  function exportPeaksCSV() {
    if (!geneRow || !longProfile) return;
    const disp = formatGeneName(geneRow.gene_name, geneRow.feature_type);
    const rows = [["Feature_Type", "Position_in_window(nt)", "Notes"]];
    longProfile.peaks.forEach((p) => rows.push(["Maxima (ssRNA)", String(p + 1), "long-range maxima"]));
    downloadText(`${disp.text}_longrange_maxima.csv`, rows.map((r) => r.join(",")).join("\n"));
  }

  const dispMat = useMemo(() => (matBundle ? ((matBundle as any).ice ? (matBundle as any).ice : (matBundle as any).raw) : undefined), [matBundle]);
  const dispGene = geneRow ? formatGeneName(geneRow.gene_name, geneRow.feature_type) : undefined;

  return (
    <div className="mx-auto max-w-7xl p-4">
      <h1 className="text-2xl font-semibold mb-4">foldMAP</h1>

      <div className="grid grid-cols-12 gap-4">
        {/* Controls */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <section className="border rounded-2xl p-4">
            <div className="font-semibold mb-2">Data</div>

            <div className="text-xs text-gray-600">Annotation CSV</div>
            <div className="flex items-center gap-2">
              <select
                className="border h-8 rounded px-2 py-1 text-sm"
                defaultValue=""
                onChange={(e) => {
                  const map: Record<string, string> = {
                    "preset-ec": "/Anno_EC.csv",
                    "preset-ss": "/Anno_SS.csv",
                    "preset-mx": "/Anno_MX.csv",
                    "preset-sa": "/Anno_SA.csv",
                    "preset-bs": "/Anno_BS.csv",
                  };
                  const v = e.target.value;
                  if (map[v]) loadPresetAnno(map[v]);
                }}
              >
                <option value="" disabled>Select preset…</option>
                <option value="preset-ec">Anno_EC.csv</option>
                <option value="preset-ss">Anno_SS.csv</option>
                <option value="preset-mx">Anno_MX.csv</option>
                <option value="preset-sa">Anno_SA.csv</option>
                <option value="preset-bs">Anno_BS.csv</option>
              </select>

              {/* File chooser (annotation) — uses a button + hidden input for robust browser behavior */}
              <FilePickerButton
                id="ann-file"
                label="Choose File"
                accept=".csv,text/csv,application/vnd.ms-excel"
                onFiles={async (files) => {
                  const f = files[0];
                  if (!f) return;
                  const text = await f.text();
                  setAnn(parseAnnotationCSV(text));
                  setAnnFileName(f.name);
                }}
              />
            </div>
            <div className="text-[11px] text-gray-500 mt-1">{annFileName || "(demo loaded)"}</div>

            <div className="text-xs text-gray-600 mt-3">Chimeras (.bed / .csv)</div>
            <div className="flex items-center gap-2">
              <select
                className="border h-8 rounded px-2 py-1 text-sm"
                defaultValue=""
                onChange={(e) => {
                  const url = e.target.value;
                  if (!url) return;
                  const item = PRESETS.chimeras.find(p => p.url === url);
                  loadChimerasFromURL(url, item?.label);
                }}
              >
                <option value="" disabled>Select preset…</option>
                {PRESETS.chimeras.map((p) => (
                  <option key={p.url} value={p.url}>{p.label}</option>
                ))}
              </select>

              {/* File chooser (chimera) — fixed so local files can be selected reliably and matches annotation styling */}
              <FilePickerButton
                id="chimera-files"
                label="Choose Files"
                accept=".bed,.csv,.tsv,text/tab-separated-values,text/csv,text/plain"
                multiple
                onFiles={onIntsFileList}
              />
            </div>
            <div className="text-[11px] text-gray-500 mt-1">{chimeraFilesLabel || "(demo loaded)"}</div>
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
              <button className="border rounded px-3 py-1 h-8">Load</button>
            </form>
            <div className="text-xs text-gray-500">
              {geneRow ? (
                <>Loaded: <span className="font-medium" style={{ fontStyle: dispGene?.italic ? "italic" : "normal" }}>{dispGene?.text}</span> — {geneRow.start}–{geneRow.end} ({(geneRow.strand || "+").toString()})</>
              ) : selectedGene ? ( <>No match for “{selectedGene}”.</> ) : ( <>Type a gene and press Load.</> )}
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
              <select className="border rounded px-2 py-1 h-8 text-sm" value={norm} onChange={(e) => (setNorm(e.target.value as any))}>
                <option value="raw">Raw</option>
                <option value="ice">ICE</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button className="border rounded px-2 py-1 text-xs h-8 disabled:opacity-50" disabled={!geneRow || !matBundle} onClick={exportMatrixSVG}>
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
              <button className="border rounded px-2 py-1 text-xs h-8 disabled:opacity-50" disabled={!geneRow || !longProfile} onClick={exportProfileSVG}>
                Export SVG
              </button>
              <button className="border rounded px-2 py-1 text-xs h-8 disabled:opacity-50" disabled={!geneRow || !longProfile} onClick={exportPeaksCSV}>
                Export CSV
              </button>
            </div>
          </section>
        </div>

        {/* Plots */}
        <div className="col-span-12 lg:col-span-9 space-y-4">
          <section className="border rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-700">
                Intramolecular contact map {geneRow ? <>— <span style={{ fontStyle: dispGene?.italic ? "italic" : "normal" }}>{dispGene?.text}</span></> : null}
              </div>
              {matBundle && (
                <div className="text-[11px] text-gray-500">bins: {matBundle.nBins} × {matBundle.nBins} (bin {matBundle.bin} nt, flank {flank} nt)</div>
              )}
            </div>

            <div className="w-full overflow-auto">
              {geneRow && dispMat ? (
                <svg xmlns="http://www.w3.org/2000/svg" width={680} height={680} className="mx-auto block border rounded">
                  {(() => {
                    const mat = dispMat as number[][];
                    const pad = 44, x0 = pad, y0 = pad, W = 680 - pad * 2, H = 680 - pad * 2;
                    const cw = W / matBundle!.nBins, ch = H / matBundle!.nBins;
                    const vals = mat.flat().filter((v) => v > 0);
                    const vmax = vals.length ? percentile(vals, 95) : 1;
                    const color = (v: number) => { const t = Math.min(1, v / (vmax || 1)); const r = 255, g = Math.round(255 * (1 - t)), b = Math.round(255 * (1 - t)); return `rgb(${r},${g},${b})`; };

                    const cells: JSX.Element[] = [];
                    for (let i = 0; i < matBundle!.nBins; i++) for (let j = 0; j < matBundle!.nBins; j++) {
                      const v = mat[i][j];
                      cells.push(<rect key={`${i}-${j}`} x={x0 + j * cw} y={y0 + i * ch} width={cw} height={ch} fill={v > 0 ? color(v) : "#ffffff"} />);
                    }

                    const bStart = Math.floor((geneRow.start - matBundle!.ws) / matBundle!.bin);
                    const bEndEdge = Math.floor((geneRow.end - matBundle!.ws) / matBundle!.bin) + 1;
                    const leftW = bStart * cw, rightX = x0 + bEndEdge * cw, rightW = W - bEndEdge * cw;

                    return (
                      <>
                        <rect x={x0} y={y0} width={leftW} height={H} fill="#000000" opacity="0.04" />
                        <rect x={rightX} y={y0} width={rightW} height={H} fill="#000000" opacity="0.04" />
                        {cells}
                        <line x1={x0 + bStart * cw} y1={y0} x2={x0 + bStart * cw} y2={y0 + H} stroke="#111827" strokeWidth={1} />
                        <line x1={x0 + bEndEdge * cw} y1={y0} x2={x0 + bEndEdge * cw} y2={y0 + H} stroke="#111827" strokeWidth={1} />
                        <line x1={x0} y1={y0 + bStart * ch} x2={x0 + W} y2={y0 + bStart * ch} stroke="#111827" strokeWidth={1} />
                        <line x1={x0} y1={y0 + bEndEdge * ch} x2={x0 + W} y2={y0 + bEndEdge * ch} stroke="#111827" strokeWidth={1} />
                        <text x={x0 + W / 2} y={680 - 12} textAnchor="middle" fontSize={11} fill="#6b7280">5′ → 3′ (bins)</text>
                        <text x={18} y={y0 + H / 2} fontSize={11} fill="#6b7280" transform={`rotate(-90 18 ${y0 + H / 2})`} textAnchor="middle">5′ → 3′ (bins)</text>
                      </>
                    );
                  })()}
                </svg>
              ) : (
                <div className="text-sm text-gray-500 p-6 text-center">Load data, enter a gene, then press <span className="font-medium">Load</span>.</div>
              )}
            </div>
          </section>

          <section className="border rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-700">
                Long-range (&gt; 5 kb) interaction profile {geneRow ? <>— <span style={{ fontStyle: dispGene?.italic ? "italic" : "normal" }}>{dispGene?.text}</span></> : null}
              </div>
              {longProfile && <div className="text-[11px] text-gray-500">peaks: {longProfile.peaks.length} • window flank: {flank} nt</div>}
            </div>

            <div className="w-full overflow-auto">
              {geneRow && longProfile ? (
                <svg xmlns="http://www.w3.org/2000/svg" width={840} height={300} className="mx-auto block">
                  {(() => {
                    const padL = 54, padR = 18, padT = 28, padB = 44;
                    const W = 840, H = 300;
                    const innerW = W - padL - padR, innerH = H - padT - padB;
                    const vals = longProfile.smooth;
                    const maxY = Math.max(1, ...vals);
                    const xScale = (i: number) => padL + (i / Math.max(1, vals.length - 1)) * innerW;
                    const yScale = (v: number) => padT + innerH - (v / maxY) * innerH;

                    const geneStartPos = geneRow.start - longProfile.ws;
                    const geneEndPos = geneRow.end - longProfile.ws;

                    const w = Math.max(1, innerW / Math.max(1, vals.length));
                    const bars: JSX.Element[] = [];
                    for (let i = 0; i < vals.length; i++) { const x = xScale(i), y = yScale(vals[i]); bars.push(<rect key={i} x={x} y={y} width={w} height={padT + innerH - y} fill="#e5e7eb" />); }
                    const dots = longProfile.peaks.map((i, k) => <circle key={k} cx={xScale(i)} cy={yScale(vals[i])} r={3} fill="#ef4444" />);

                    return (
                      <>
                        <rect x={0} y={0} width={W} height={H} fill="#ffffff" />
                        <rect x={padL} y={padT} width={xScale(geneStartPos) - padL} height={innerH} fill="#000000" opacity="0.04" />
                        <rect x={xScale(geneEndPos)} y={padT} width={padL + innerW - xScale(geneEndPos)} height={innerH} fill="#000000" opacity="0.04" />
                        {bars}
                        {dots}
                        <line x1={xScale(geneStartPos)} y1={padT} x2={xScale(geneStartPos)} y2={padT + innerH} stroke="#111827" strokeWidth={1} />
                        <line x1={xScale(geneEndPos)} y1={padT} x2={xScale(geneEndPos)} y2={padT + innerH} stroke="#111827" strokeWidth={1} />
                        <text x={padL + innerW / 2} y={H - 12} textAnchor="middle" fontSize={11} fill="#6b7280">Window (5′ → 3′): flank — gene — flank</text>
                        <text x={18} y={padT + innerH / 2} fontSize={11} fill="#6b7280" transform={`rotate(-90 18 ${padT + innerH / 2})`} textAnchor="middle">Smoothed ligation events</text>
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
