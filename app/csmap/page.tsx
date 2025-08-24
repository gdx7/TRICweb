"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { PRESETS } from "@/lib/presets";

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

export default function CsMapPage() {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [anno, setAnno] = useState<Annotation[]>([]);
  const [genesInput, setGenesInput] = useState<string>("gene1, gene2, 5'gene3");
  const [sizeScaleFactor, setSizeScaleFactor] = useState<number>(1.0);

  const [loadedPairsName, setLoadedPairsName] = useState<string | null>(null);
  const [loadedAnnoName, setLoadedAnnoName] = useState<string | null>(null);

  const pairsRef = useRef<HTMLInputElement>(null);
  const annoRef = useRef<HTMLInputElement>(null);

  // Pre-fill from URL (no useSearchParams to avoid Suspense requirements)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const g = sp.get("genes");
    if (g) setGenesInput(g);
  }, []);

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
    if (label) setLoadedAnnoName(label);
  }
  async function loadPairsFromURL(url: string) {
    const res = await fetch(url);
    const text = await res.text();
    setPairs(parsePairsCSV(text));
    setLoadedPairsName(new URL(url).pathname.split("/").pop() || "interaction.csv");
  }

  const geneList = useMemo(
    () => genesInput.split(/[, \n\t\r]+/).map((g) => g.trim()).filter(Boolean),
    [genesInput]
  );

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

      let total = 0;
      for (const e of pairs) {
        if (cf(e.ref) === gCF && e.total_ref) { total = e.total_ref; break; }
        if (cf(e.target) === gCF && e.totals) { total = e.totals; break; }
      }
      totals.push({ gene: gRaw, total: Math.max(0, Math.floor(total)), type: annG?.feature_type });

      const cand: { pos: number; or: number; counts: number; type: FeatureType }[] = [];
      for (const e of pairs) {
        const isRef = cf(e.ref) === gCF;
        const isTgt = cf(e.target) === gCF;
        if (!isRef && !isTgt) continue;

        const partner = isRef ? e.target : e.ref;
        const annP = annoByCF.get(cf(partner));
        if (!annP || !annG) continue;

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
      peaks.sort((a, b) => b.counts - a.counts);

      for (const p of peaks) {
        const y = Math.min(OR_CAP, p.or);
        const yT = symlog(y);
        // area ∝ counts -> radius ∝ sqrt(counts)
        const r = Math.sqrt(p.counts) * 1.5 * sizeScaleFactor;
        dots.push({ col, yT, r, stroke: FEATURE_COLORS[p.type] || "#F78208" });
      }
    });

    return { dots, totals, warnings };
  }, [geneList, pairs, annoByCF, sizeScaleFactor]);

  const W = Math.max(560, 200 * Math.max(1, geneList.length));
  const SC_H = 560;
  const margin = { top: 40, right: 90, bottom: 88, left: 64 };
  const innerW = W - margin.left - margin.right;
  const innerH = SC_H - margin.top - margin.bottom;

  const yMaxT = 1 + Math.log10(5000 / 10);
  const yPix = (t: number) => innerH - (t / yMaxT) * innerH;

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
          placeholder="Enter genes (comma/space-separated), e.g., gene1, 5'gene2"
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
            <div className="text-xs text-slate-500 mt-1">{loadedPairsName || "(none loaded)"}</div>
          </label>

          <label className="text-sm">
            <div className="text-slate-700 mb-1">Annotations CSV</div>
            <div className="flex items-center gap-2">
              <select
                className="border rounded px-2 py-1 text-xs"
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
                  if (map[v]) loadPresetAnno(map[v], map[v].slice(1));
                }}
              >
                <option value="" disabled>Select preset…</option>
                <option value="preset-ec">Anno_EC.csv</option>
                <option value="preset-ss">Anno_SS.csv</option>
                <option value="preset-mx">Anno_MX.csv</option>
                <option value="preset-sa">Anno_SA.csv</option>
                <option value="preset-bs">Anno_BS.csv</option>
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
            <div className="text-xs text-slate-500 mt-1">{loadedAnnoName || "(none loaded)"}</div>
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
            <span className="ml-4 text-xs text-slate-500">Circle area ∝ counts</span>
          </div>
        </div>
      </div>

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
