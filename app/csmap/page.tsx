"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { PRESETS } from "@/lib/presets";

// ---------- Types ----------
type FeatureType =
  | "CDS" | "5'UTR" | "3'UTR" | "ncRNA" | "tRNA" | "rRNA" | "sRNA" | "hkRNA" | "sponge" | string;

type Annotation = {
  gene_name: string;
  start: number;
  end: number;
  feature_type?: FeatureType;
  strand?: string;
  chromosome?: string;
};

type Pair = {
  ref: string;
  target: string;
  counts?: number;
  odds_ratio?: number;
  totals?: number;
  total_ref?: number;
  ref_type?: FeatureType;
  target_type?: FeatureType;
};

// ---------- Colors ----------
const FEATURE_COLORS: Record<FeatureType, string> = {
  ncRNA: "#A40194",
  sRNA:  "#A40194",
  sponge:"#F12C2C",
  tRNA:  "#82F778",
  hkRNA: "#999999",
  rRNA:  "#999999",
  CDS:   "#F78208",
  "5'UTR":"#76AAD7",
  "3'UTR":"#0C0C0C",
};
const cf = (s: string) => String(s || "").trim().toLowerCase();
const cap1 = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
function formatGeneName(name: string, type?: FeatureType): { text: string; italic: boolean } {
  const t = (type || "CDS") as FeatureType;
  if (t === "sRNA" || t === "ncRNA" || t === "sponge") return { text: cap1(name), italic: false };
  return { text: name, italic: true };
}

// ---------- CSV parsing ----------
function parsePairsCSV(csv: string): Pair[] {
  const { data } = Papa.parse<Pair>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
  return (data as any[])
    .filter((r) => r.ref && r.target)
    .map((r) => ({
      ref: String(r.ref).trim(),
      target: String(r.target).trim(),
      counts: Number(r.counts) || 0,
      odds_ratio: Number(r.odds_ratio) || 0,
      totals: r.totals != null ? Number(r.totals) : undefined,
      total_ref: r.total_ref != null ? Number(r.total_ref) : undefined,
      ref_type: r.ref_type,
      target_type: r.target_type,
    }));
}

function parseAnnoCSV(csv: string): Annotation[] {
  const { data } = Papa.parse<any>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
  return (data as any[])
    .filter((r) => r.gene_name && (r.start != null) && (r.end != null))
    .map((r) => ({
      gene_name: String(r.gene_name).trim(),
      start: Number(r.start),
      end: Number(r.end),
      feature_type: r.feature_type,
      strand: r.strand,
      chromosome: r.chromosome,
    }));
}

// ---------- Demo simulation (dense, synthetic names) ----------
function simulateDense(nGenes = 500) {
  const rng = ((seed: number) => () => (seed = (seed * 1664525 + 1013904223) % 0xffffffff) / 0xffffffff)(77);
  const genomeLen = 4_600_000;
  const anno: Annotation[] = [];

  for (let i = 1; i <= nGenes; i++) {
    const start = Math.floor(rng() * (genomeLen - 2000)) + 1;
    const len = Math.max(150, Math.floor(rng() * 1500));
    const end = Math.min(start + len, genomeLen);
    anno.push({ gene_name: `gene${i}`, start, end, feature_type: "CDS", strand: rng() > 0.5 ? "+" : "-", chromosome: "chr" });
    if (rng() > 0.4) anno.push({ gene_name: `5'gene${i}`, start: Math.max(1, start - Math.floor(rng() * 200)), end: Math.min(start + Math.floor(len * 0.25), genomeLen), feature_type: "5'UTR", strand: "+", chromosome: "chr" });
    if (rng() > 0.4) anno.push({ gene_name: `3'gene${i}`, start: Math.max(end - Math.floor(len * 0.25), 1), end: Math.min(end + Math.floor(rng() * 200), genomeLen), feature_type: "3'UTR", strand: "+", chromosome: "chr" });
  }
  for (let i = 1; i <= Math.floor(nGenes * 0.12); i++) {
    const start = Math.floor(rng() * (genomeLen - 400)) + 1;
    const end = Math.min(start + 200 + Math.floor(rng() * 250), genomeLen);
    const t = rng() < 0.55 ? "sRNA" : "ncRNA";
    anno.push({ gene_name: `${t.toLowerCase()}${i}`, start, end, feature_type: t, strand: "+", chromosome: "chr" });
  }

  const pairs: Pair[] = [];
  const genes = anno.map(a => a.gene_name);
  function addEdge(a: string, b: string, bias = 1) {
    const c = Math.max(1, Math.floor((rng() ** 0.7) * 220 * bias));
    const or = 0.8 + Math.pow(rng(), 0.35) * 650 * bias;
    const aAnn = anno.find(x => x.gene_name === a);
    const bAnn = anno.find(x => x.gene_name === b);
    pairs.push({ ref: a, target: b, counts: c, odds_ratio: or, ref_type: aAnn?.feature_type, target_type: bAnn?.feature_type });
  }
  for (let k = 0; k < nGenes * 5.5; k++) {
    const a = genes[Math.floor(rng() * genes.length)];
    const b = genes[Math.floor(rng() * genes.length)];
    if (a !== b) addEdge(a, b, 1);
  }
  const hubs = anno.filter(a => a.feature_type === "sRNA" || a.feature_type === "ncRNA").map(a => a.gene_name);
  if (hubs.length) {
    for (let i = 0; i < 140; i++) {
      const h = hubs[Math.floor(rng() * hubs.length)];
      const g = genes[Math.floor(rng() * genes.length)];
      if (h !== g) addEdge(h, g, 5);
    }
  }
  return { anno, pairs };
}

// ---------- Page ----------
export default function CsMapPage() {
  // Demo defaults (dense, synthetic)
  const demo = useMemo(() => simulateDense(520), []);
  const [pairs, setPairs] = useState<Pair[]>(demo.pairs);
  const [anno, setAnno] = useState<Annotation[]>(demo.anno);
  const [genesInput, setGenesInput] = useState<string>("srna1, gene15, 5'gene28");
  const [sizeScaleFactor, setSizeScaleFactor] = useState<number>(1.0);

  const [loadedPairsName, setLoadedPairsName] = useState<string | null>(null);
  const [loadedAnnoName, setLoadedAnnoName] = useState<string | null>(null);

  const pairsRef = useRef<HTMLInputElement>(null);
  const annoRef = useRef<HTMLInputElement>(null);

  // remember / auto-load presets across tools
  function remember(k: string, v: string) { try { localStorage.setItem(k, v); } catch {} }
  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    const p = qs.get("pairs");
    const a = qs.get("anno");
    const g = qs.get("genes");
    if (p) loadPairsFromURL(p);
    if (a) loadPresetAnno(a, a.split("/").pop() || "annotations.csv");
    if (g) setGenesInput(g);
    if (!p && !a) {
      const lp = localStorage.getItem("TRIC_pairsURL");
      const la = localStorage.getItem("TRIC_annoURL");
      const laLabel = localStorage.getItem("TRIC_annoLabel") || undefined;
      if (lp) loadPairsFromURL(lp);
      if (la) loadPresetAnno(la, laLabel);
    }
  }, []);

  // case-insensitive index for annotations
  const annoByCF = useMemo(() => {
    const m = new Map<string, Annotation>();
    for (const a of anno) m.set(cf(a.gene_name), a);
    return m;
  }, [anno]);

  async function onPairsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const text = await f.text();
    setPairs(parsePairsCSV(text));
    setLoadedPairsName(f.name);
  }
  async function onAnnoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const text = await f.text();
    setAnno(parseAnnoCSV(text));
    setLoadedAnnoName(f.name);
  }

  async function loadPresetAnno(path: string, label?: string) {
    const res = await fetch(path);
    const text = await res.text();
    setAnno(parseAnnoCSV(text));
    setLoadedAnnoName(label || path.split("/").pop() || "annotations.csv");
    remember("TRIC_annoURL", path);
    remember("TRIC_annoLabel", label || "");
  }

  async function loadPairsFromURL(url: string) {
    const res = await fetch(url);
    const text = await res.text();
    setPairs(parsePairsCSV(text));
    setLoadedPairsName(new URL(url).pathname.split("/").pop() || "interaction.csv");
    remember("TRIC_pairsURL", url);
  }

  const geneList = useMemo(
    () => genesInput.split(/[, \n\t\r]+/).map((g) => g.trim()).filter(Boolean),
    [genesInput]
  );

  // ---------- Build csMAP dots + totals ----------
  const { dots, totals, warnings } = useMemo(() => {
    const warnings: string[] = [];
    const dots: { col: number; yT: number; r: number; stroke: string }[] = [];
    const totals: { gene: string; total: number; type?: FeatureType }[] = [];

    const COUNT_MIN = 10;
    const DIST_MIN = 5000;
    const OR_CAP = 5000;
    const LINTHRESH = 10;

    const symlog = (v: number) => {
      const a = Math.abs(v);
      return a <= LINTHRESH ? (a / LINTHRESH) : (1 + Math.log10(a / LINTHRESH));
    };

    geneList.forEach((gRaw, col) => {
      const gCF = cf(gRaw);
      const annG = annoByCF.get(gCF);
      if (!annG) warnings.push(`No annotation for ${gRaw}`);

      // totals (prefer total_ref when gene is ref; totals when gene is target)
      let total = 0;
      for (const e of pairs) {
        if (cf(e.ref) === gCF && e.total_ref) { total = e.total_ref; break; }
        if (cf(e.target) === gCF && e.totals) { total = e.totals; break; }
      }
      totals.push({ gene: gRaw, total: Math.max(0, Math.floor(total)), type: annG?.feature_type });

      // collect candidates for this gene (both directions)
      const cand: { pos: number; or: number; counts: number; type: FeatureType }[] = [];
      for (const e of pairs) {
        const isRef = cf(e.ref) === gCF;
        const isTgt = cf(e.target) === gCF;
        if (!isRef && !isTgt) continue;

        const partner = isRef ? e.target : e.ref;
        const annP = annoByCF.get(cf(partner));
        if (!annP) continue;

        const dist = Math.min(
          Math.abs(annP.start - (annG?.end ?? annP.end)),
          Math.abs(annP.end - (annG?.start ?? annP.start)),
          Math.abs(annP.start - (annG?.start ?? annP.start)),
          Math.abs(annP.end - (annG?.end ?? annP.end))
        );

        const counts = Number(e.counts) || 0;
        const or = Number(e.odds_ratio) || 0;
        const type = (isRef ? e.target_type : e.ref_type) || annP.feature_type || "CDS";

        if (counts < COUNT_MIN) continue;
        if (!(or > 0)) continue;
        if (dist <= DIST_MIN) continue;
        if (type === "hkRNA") continue;

        cand.push({ pos: annP.start, or, counts, type: type as FeatureType });
      }

      cand.sort((a, b) => a.pos - b.pos);
      const peaks: typeof cand = [];
      let cur = cand[0];
      for (let i = 1; i < cand.length; i++) {
        const nx = cand[i];
        if (nx.pos > cur.pos + 1000) {
          peaks.push(cur);
          cur = nx;
        } else if (nx.or > cur.or) {
          cur = nx;
        }
      }
      if (cur) peaks.push(cur);

      // big first so small are drawn on top
      peaks.sort((a, b) => b.counts - a.counts);

      for (const p of peaks) {
        const y = Math.min(OR_CAP, p.or);
        const yT = symlog(y);
        // NEW: radius ∝ √(counts + 1) so area ∝ counts (+1)
        const r = Math.sqrt(Math.max(0, p.counts) + 1) * 1.5 * sizeScaleFactor;
        dots.push({ col, yT, r, stroke: FEATURE_COLORS[p.type] || "#F78208" });
      }
    });

    return { dots, totals, warnings };
  }, [geneList, pairs, annoByCF, sizeScaleFactor]);

  // ---------- Layout / scales ----------
  const W = Math.max(560, 200 * Math.max(1, geneList.length));
  const SC_H = 560;
  const margin = { top: 40, right: 90, bottom: 88, left: 64 };
  const innerW = W - margin.left - margin.right;
  const innerH = SC_H - margin.top - margin.bottom;

  const yMaxT = 1 + Math.log10(5000 / 10);
  const yPix = (t: number) => innerH - (t / yMaxT) * innerH;

  // bar chart sizing + log10 y-axis with ticks
  const BAR_H = 340;
  const bMargin = { top: 28, right: 40, bottom: 74, left: 64 };
  const bInnerW = W - bMargin.left - bMargin.right;
  const bInnerH = BAR_H - bMargin.top - bMargin.bottom;

  const tMax = Math.max(1, ...totals.map((t) => t.total));
  const log10 = (v: number) => (v <= 0 ? 0 : Math.log10(v));
  const barY = (v: number) => bInnerH - (log10(v) / log10(tMax || 1)) * bInnerH;

  const barW = Math.min(18, Math.max(12, bInnerW / (geneList.length * 3)));
  const maxPow = Math.ceil(log10(tMax || 1));
  const barTicks = Array.from({ length: maxPow + 1 }, (_, k) => Math.pow(10, k));

  return (
    <div className="mx-auto max-w-[1300px] p-4">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold">TRIC-seq — csMAP</h1>
        <div className="text-xs text-slate-500">
          Counts ≥ 10; distance &gt; 5 kb; hkRNA excluded; OR &gt; 0; local peaks in 1 kb windows.
        </div>
      </div>

      {/* Inputs */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          className="border rounded px-3 py-2 w-full sm:w-[520px]"
          placeholder="Enter genes (comma/space), e.g., srna1, gene15, 5'gene28"
          value={genesInput}
          onChange={(e) => setGenesInput(e.target.value)}
        />

        {/* Circle size slider */}
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-700 whitespace-nowrap">Circle size ×{sizeScaleFactor.toFixed(1)}</div>
          <input
            type="range"
            min={0.1}
            max={2}
            step={0.1}
            value={sizeScaleFactor}
            onChange={(e) => setSizeScaleFactor(Number(e.target.value))}
          />
        </div>

        <div className="flex-1" />

        <div className="flex flex-col sm:flex-row gap-6">
          {/* Interaction analysis CSV */}
          <label className="text-sm">
            <div className="text-slate-700 mb-1">Interaction analysis CSV</div>
            <div className="flex items-center gap-2">
              <select
                className="border rounded px-2 py-1 text-xs"
                defaultValue=""
                onChange={(e) => { const u = e.target.value; if (u) loadPairsFromURL(u); }}
              >
                <option value="" disabled>Select preset…</option>
                {PRESETS.interactions.map(p => (
                  <option key={p.url} value={p.url}>{p.label}</option>
                ))}
              </select>
              <input ref={pairsRef} type="file" accept=".csv" onChange={onPairsFile} className="hidden" />
              <button
                className="border rounded px-3 py-1"
                type="button"
                onClick={() => pairsRef.current?.click()}
              >
                Choose File
              </button>
            </div>
            <div className="text-xs text-slate-500 mt-1">{loadedPairsName || "(using simulated interactions)"}</div>
          </label>

          {/* Annotations CSV */}
          <label className="text-sm">
            <div className="text-slate-700 mb-1">Annotations CSV</div>
            <div className="flex items-center gap-2">
              <select
                className="border rounded px-2 py-1 text-xs"
                defaultValue=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) loadPresetAnno(v, v.split("/").pop() || "annotations.csv");
                }}
              >
                <option value="" disabled>Select preset…</option>
                <option value="/Anno_EC.csv">Anno_EC.csv</option>
                <option value="/Anno_SS.csv">Anno_SS.csv</option>
                <option value="/Anno_MX.csv">Anno_MX.csv</option>
                <option value="/Anno_SA.csv">Anno_SA.csv</option>
                <option value="/Anno_BS.csv">Anno_BS.csv</option>
              </select>
              <input ref={annoRef} type="file" accept=".csv" onChange={onAnnoFile} className="hidden" />
              <button
                className="border rounded px-3 py-1"
                type="button"
                onClick={() => annoRef.current?.click()}
              >
                Choose File
              </button>
            </div>
            <div className="text-xs text-slate-500 mt-1">{loadedAnnoName || "(using simulated annotations)"}</div>
          </label>
        </div>
      </div>

      {/* Collapsed scatter */}
      <div className="relative overflow-x-auto rounded-lg border bg-white">
        <button
          onClick={() => exportSVG("csmap-scatter", "csMAP_scatter")}
          className="absolute right-3 top-3 text-xs px-2 py-1 border rounded bg-white hover:bg-slate-50"
        >
          Export SVG
        </button>
        <svg id="csmap-scatter" width={W} height={SC_H} style={{ display: "block" }}>
          <defs>
            <style>{`text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#334155;font-size:11px}`}</style>
          </defs>
          <g transform={`translate(${margin.left},${margin.top})`}>
            {/* axes */}
            <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#222" />
            {geneList.map((g, i) => {
              const cx = ((i + 0.5) / geneList.length) * innerW;
              const annG = annoByCF.get(cf(g));
              const disp = formatGeneName(g, annG?.feature_type);
              return (
                <g key={i} transform={`translate(${cx},${innerH})`}>
                  <line y2={6} stroke="#222" />
                  <text y={24} textAnchor="middle" style={{ fontStyle: disp.italic ? "italic" : "normal" }}>
                    {disp.text}
                  </text>
                </g>
              );
            })}
            {/* y (symlog) ticks */}
            {[0, 1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000].map((v, i) => {
              const t = v <= 10 ? v / 10 : 1 + Math.log10(v / 10);
              return (
                <g key={i} transform={`translate(0,${yPix(t)})`}>
                  <line x2={-6} stroke="#222" />
                  <text x={-9} y={3} textAnchor="end">{v}</text>
                  <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eef2f7" />
                </g>
              );
            })}
            <text transform={`translate(${-50},${innerH/2}) rotate(-90)`}>Odds ratio (symlog)</text>

            {/* dots: big first, small last */}
            {dots.map((d, idx) => {
              const cx = ((d.col + 0.5) / geneList.length) * innerW + (Math.random() - 0.5) * 6;
              const cy = yPix(d.yT);
              return (
                <g key={idx} transform={`translate(${cx},${cy})`}>
                  <circle r={d.r} fill="#fff" stroke={d.stroke} strokeWidth={2} />
                </g>
              );
            })}
          </g>
        </svg>

        {/* Legend */}
        <div className="px-4 pb-4">
          <div className="mt-2 flex flex-wrap gap-4 items-center">
            <span className="text-sm font-medium">Feature types</span>
            {[
              { key: "CDS", color: FEATURE_COLORS.CDS, label: "CDS" },
              { key: "5'UTR", color: FEATURE_COLORS["5'UTR"], label: "5'UTR" },
              { key: "3'UTR", color: FEATURE_COLORS["3'UTR"], label: "3'UTR" },
              { key: "sRNA/ncRNA", color: FEATURE_COLORS.sRNA, label: "sRNA/ncRNA" },
              { key: "tRNA", color: FEATURE_COLORS.tRNA, label: "tRNA" },
              { key: "rRNA/hkRNA", color: FEATURE_COLORS.rRNA, label: "rRNA/hkRNA" },
              { key: "sponge", color: FEATURE_COLORS.sponge, label: "Sponge" },
            ].map((item) => (
              <span key={item.key} className="inline-flex items-center gap-2 text-xs">
                <span
                  className="inline-block w-3 h-3 rounded-full border"
                  style={{ background: "#fff", borderColor: item.color, boxShadow: `inset 0 0 0 2px ${item.color}` }}
                />
                {item.label}
              </span>
            ))}
            <span className="ml-4 text-xs text-slate-500">Circle area ∝ counts (+1 offset)</span>
          </div>
        </div>
      </div>

      {/* Totals bar chart (log10) */}
      <div className="relative overflow-x-auto rounded-lg border bg-white mt-6">
        <button
          onClick={() => exportSVG("csmap-bars", "csMAP_totals")}
          className="absolute right-3 top-3 text-xs px-2 py-1 border rounded bg-white hover:bg-slate-50"
        >
          Export SVG
        </button>
        <svg id="csmap-bars" width={W} height={BAR_H} style={{ display: "block" }}>
          <defs>
            <style>{`text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#334155;font-size:11px}`}</style>
          </defs>
        <g transform={`translate(${bMargin.left},${bMargin.top})`}>
            {/* axes + grid */}
            <line x1={0} y1={bInnerH} x2={bInnerW} y2={bInnerH} stroke="#222" />
            {barTicks.map((v, i) => {
              const y = barY(v);
              return (
                <g key={i} transform={`translate(0,${y})`}>
                  <line x2={-6} stroke="#222" />
                  <text x={-9} y={3} textAnchor="end">{v}</text>
                  <line x1={0} x2={bInnerW} y1={0} y2={0} stroke="#eef2f7" />
                </g>
              );
            })}
            <text transform={`translate(${-46},${bInnerH/2}) rotate(-90)`}>Total interactions (log10)</text>

            {/* bars */}
            {totals.map((t, i) => {
              const x = (i + 0.5) * (bInnerW / Math.max(1, totals.length)) - barW / 2;
              const y = barY(Math.max(1, t.total));
              const h = bInnerH - y;
              const disp = formatGeneName(t.gene, t.type);
              return (
                <g key={i}>
                  <rect x={x} y={y} width={barW} height={h} fill="#93c5fd" stroke="#60a5fa" />
                  <text x={x + barW / 2} y={bInnerH + 18} textAnchor="middle" style={{ fontStyle: disp.italic ? "italic" : "normal" }}>
                    {disp.text}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {warnings.length > 0 && (
        <div className="mt-3 text-xs text-amber-700">
          {warnings.join(" · ")}
        </div>
      )}
    </div>
  );
}

// ---------- Export helper ----------
function exportSVG(svgId: string, filename: string) {
  const el = document.getElementById(svgId) as SVGSVGElement | null;
  if (!el) return;
  const clone = el.cloneNode(true) as SVGSVGElement;
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent =
    'text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#334155;font-size:11px}';
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
