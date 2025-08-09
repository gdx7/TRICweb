// app/csmap/page.tsx
"use client";

import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";

// ---------- Types ----------
type FeatureType =
  | "CDS" | "5'UTR" | "3'UTR" | "ncRNA" | "tRNA" | "rRNA" | "sRNA" | "hkRNA" | string;

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
  ncRNA: "#A40194", // sRNA & ncRNA share magenta
  sRNA:  "#A40194",
  sponge:"#F12C2C",
  tRNA:  "#82F778",
  hkRNA: "#C4C5C5",
  CDS:   "#F78208",
  "5'UTR":"#76AAD7",
  "3'UTR":"#0C0C0C",
  rRNA:  "#999999",
};
const cf = (s: string) => String(s || "").trim().toLowerCase();
const baseName = (g: string) => (g.startsWith("5'") || g.startsWith("3'")) ? g.slice(2) : g;

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

// ---------- Page ----------
export default function CsMapPage() {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [anno, setAnno] = useState<Annotation[]>([]);
  const [genesInput, setGenesInput] = useState<string>("gcvB, cpxQ"); // example
  const pairsRef = useRef<HTMLInputElement>(null);
  const annoRef = useRef<HTMLInputElement>(null);

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
  }
  async function onAnnoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const text = await f.text();
    setAnno(parseAnnoCSV(text));
  }

  // user list (case-insensitive)
  const geneList = useMemo(
    () => genesInput.split(/[, \n\t\r]+/).map((g) => g.trim()).filter(Boolean),
    [genesInput]
  );

  // ---------- Build csMAP dots + totals ----------
  const { dots, totals, warnings } = useMemo(() => {
    const warnings: string[] = [];
    const dots: { col: number; yT: number; r: number; stroke: string }[] = [];
    const totals: { gene: string; total: number }[] = [];

    const COUNT_MIN = 10;  // fixed per your request
    const DIST_MIN = 5000; // bp
    const OR_CAP = 5000;
    const LINTHRESH = 10;

    // symlog transform (base 10) for plotting
    const symlog = (v: number) => {
      const a = Math.abs(v);
      return a <= LINTHRESH ? (a / LINTHRESH) : (1 + Math.log10(a / LINTHRESH));
    };

    geneList.forEach((gRaw, col) => {
      const gCF = cf(gRaw);
      const annG = annoByCF.get(gCF);
      if (!annG) {
        warnings.push(`No annotation for ${gRaw}`);
        totals.push({ gene: baseName(gRaw), total: 0 });
        return;
      }

      // totals (prefer total_ref when gene is ref; totals when gene is target)
      let total = 0;
      for (const e of pairs) {
        if (cf(e.ref) === gCF && e.total_ref) { total = e.total_ref; break; }
        if (cf(e.target) === gCF && e.totals) { total = e.totals; break; }
      }
      totals.push({ gene: baseName(gRaw), total: Math.max(0, Math.floor(total)) });

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
          Math.abs(annP.start - annG.end),
          Math.abs(annP.end - annG.start),
          Math.abs(annP.start - annG.start),
          Math.abs(annP.end - annG.end)
        );

        const counts = Number(e.counts) || 0;
        const or = Number(e.odds_ratio) || 0;
        const type = (isRef ? e.target_type : e.ref_type) || annP.feature_type || "CDS";

        if (counts < COUNT_MIN) continue;
        if (!(or > 0)) continue;     // OR must be positive
        if (dist <= DIST_MIN) continue;
        if (type === "hkRNA") continue;

        cand.push({ pos: annP.start, or, counts, type: type as FeatureType });
      }

      // local peaks: 1 kb windows, keep max OR in each window
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

      // draw order: big counts first so smaller circles render last (on top)
      peaks.sort((a, b) => b.counts - a.counts);

      for (const p of peaks) {
        const y = Math.min(OR_CAP, p.or);
        const yT = symlog(y);             // transformed y
        const r = Math.sqrt(p.counts) * 1.5; // HALF the previous size
        dots.push({ col, yT, r, stroke: FEATURE_COLORS[p.type] || "#F78208" });
      }
    });

    return { dots, totals, warnings };
  }, [geneList, pairs, annoByCF]);

  // ---------- Layout / scales ----------
  const W = Math.max(560, 200 * Math.max(1, geneList.length));
  const SC_H = 560; // scatter height
  const margin = { top: 40, right: 90, bottom: 88, left: 64 };
  const innerW = W - margin.left - margin.right;
  const innerH = SC_H - margin.top - margin.bottom;

  // y scale uses symlog transform (0..~1.7 for 0..5000)
  const yMaxT = 1 + Math.log10(5000 / 10);
  const yPix = (t: number) => innerH - (t / yMaxT) * innerH;

  // bar chart sizing + log10 y-axis with ticks
  const BAR_H = 340;
  const bMargin = { top: 28, right: 40, bottom: 74, left: 64 }; // LEFT MARGIN for visible axis
  const bInnerW = W - bMargin.left - bMargin.right;
  const bInnerH = BAR_H - bMargin.top - bMargin.bottom;

  const tMax = Math.max(1, ...totals.map((t) => t.total));
  const log10 = (v: number) => (v <= 0 ? 0 : Math.log10(v));
  const barY = (v: number) => bInnerH - (log10(v) / log10(tMax || 1)) * bInnerH;

  // slimmer bars
  const barW = Math.min(18, Math.max(12, bInnerW / (geneList.length * 3)));

  // ticks for bar log axis: 1, 10, 100, ... up to tMax
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
          placeholder="Enter genes (comma/space-separated, case-insensitive), e.g., gcvB, sroC, arrS"
          value={genesInput}
          onChange={(e) => setGenesInput(e.target.value)}
        />
        <div className="flex-1" />
        <div className="flex flex-col sm:flex-row gap-6">
          <label className="text-sm">
            <div className="text-slate-700 mb-1">Pairs table CSV</div>
            <input ref={pairsRef} type="file" accept=".csv" onChange={onPairsFile} />
          </label>
          <label className="text-sm">
            <div className="text-slate-700 mb-1">Annotations CSV</div>
            <input ref={annoRef} type="file" accept=".csv" onChange={onAnnoFile} />
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
              return (
                <g key={i} transform={`translate(${cx},${innerH})`}>
                  <line y2={6} stroke="#222" />
                  <text y={24} textAnchor="middle">{baseName(g.toLowerCase())}</text>
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

            {/* dots: big first, small last (small drawn on top) */}
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
            {["CDS","5'UTR","3'UTR","ncRNA","sRNA","tRNA","rRNA","sponge","hkRNA"].map((k) => (
              <span key={k} className="inline-flex items-center gap-2 text-xs">
                <span
                  className="inline-block w-3 h-3 rounded-full border"
                  style={{
                    background: "#fff",
                    borderColor: FEATURE_COLORS[k as FeatureType] || "#F78208",
                    boxShadow: `inset 0 0 0 2px ${FEATURE_COLORS[k as FeatureType] || "#F78208"}`
                  }}
                />
                {k}
              </span>
            ))}
            <span className="ml-4 text-xs text-slate-500">Circle size ∝ √counts</span>
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

            {/* bars (slimmer) */}
            {totals.map((t, i) => {
              const x = (i + 0.5) * (bInnerW / Math.max(1, totals.length)) - barW / 2;
              const y = barY(Math.max(1, t.total));
              const h = bInnerH - y;
              return (
                <g key={i}>
                  <rect x={x} y={y} width={barW} height={h} fill="#93c5fd" stroke="#60a5fa" />
                  <text x={x + barW / 2} y={bInnerH + 18} textAnchor="middle">
                    {t.gene.toLowerCase()}
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
