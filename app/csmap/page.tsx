"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  Annotation,
  Pair,
  FEATURE_COLORS,
  pickColor,
  parseAnnoCSV,
  parsePairsCSV,
  geneIndex as buildIndex,
  distanceBetween,
} from "@/lib/shared";

/** --- small helpers --- */
function symlog(y: number, linthresh = 10, base = Math.E) {
  const s = Math.sign(y);
  const a = Math.abs(y);
  return a <= linthresh ? s * (a / linthresh) : s * (1 + Math.log(a / linthresh) / Math.log(base));
}
function invSymlog(t: number, linthresh = 10, base = Math.E) {
  const s = Math.sign(t);
  const a = Math.abs(t);
  return a <= 1 ? s * a * linthresh : s * linthresh * Math.pow(base, (a - 1));
}
function jitter(seed: number) {
  // cheap deterministic pseudo-rng in [−0.08, +0.08]
  const x = Math.sin(seed * 9999) * 43758.5453;
  return (x - Math.floor(x)) * 0.16 - 0.08;
}

/** local peak picking: pick max-odds item per 1kb window along genome */
function pickLocalPeaks(
  rows: { x: number; odds: number }[],
  windowBp = 1000
) {
  if (rows.length === 0) return [] as number[];
  const sorted = rows.map((r, i) => ({ ...r, i })).sort((a, b) => a.x - b.x);
  const peaks: number[] = [];
  let cur = sorted[0];
  for (let k = 1; k < sorted.length; k++) {
    const r = sorted[k];
    if (r.x > cur.x + windowBp) {
      peaks.push(cur.i);
      cur = r;
    } else if (r.odds > cur.odds) {
      cur = r;
    }
  }
  peaks.push(cur.i);
  return peaks;
}

type Item = {
  gene: string;      // input gene (column)
  partner: string;   // partner gene
  x: number;         // partner start coord
  odds: number;      // odds ratio (or adjusted_score)
  counts: number;    // counts
  type?: string;     // partner feature_type
  dist: number;      // inter-gene distance
};

export default function CsMapPage() {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [genesText, setGenesText] = useState("GcvB,CpxQ");
  const [minCounts, setMinCounts] = useState(5);
  const [minDistance, setMinDistance] = useState(5000);
  const [yCap, setYCap] = useState(5000);
  const [peakWindow, setPeakWindow] = useState(1000); // 1 kb
  const [excludeHK, setExcludeHK] = useState(true);

  const filePairsRef = useRef<HTMLInputElement>(null);
  const fileAnnoRef = useRef<HTMLInputElement>(null);

  const idx = useMemo(() => buildIndex(annotations), [annotations]);
  const genomeMax = useMemo(
    () => (annotations.length ? Math.max(...annotations.map(a => a.end)) : 4_700_000),
    [annotations]
  );

  async function onPairsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setPairs(parsePairsCSV(text));
  }
  async function onAnnoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setAnnotations(parseAnnoCSV(text));
  }

  const geneList = useMemo(
    () => genesText.split(",").map(s => s.trim()).filter(Boolean),
    [genesText]
  );

  const totalsByGene = useMemo(() => {
    // sum of counts for each input gene
    const t: Record<string, number> = {};
    geneList.forEach(g => (t[g] = 0));
    for (const e of pairs) {
      if (t[e.ref] !== undefined) t[e.ref] += e.counts ?? 0;
      if (t[e.target] !== undefined) t[e.target] += e.counts ?? 0;
    }
    return t;
  }, [pairs, geneList]);

  const allItems = useMemo(() => {
    const items: Item[] = [];

    for (const g of geneList) {
      const gAnn = idx[g];
      if (!gAnn) continue;

      // edges involving g
      const edges = pairs.filter(e => e.ref === g || e.target === g);

      const raw: Item[] = edges.map(e => {
        const partner = e.ref === g ? e.target : e.ref;
        const pAnn = idx[partner];
        if (!pAnn) return null;

        const counts = e.counts ?? 0;
        const odds = Number(e.odds_ratio ?? e.adjusted_score ?? 0);
        const type = e.ref === g ? e.target_type : e.ref_type;
        const dist = distanceBetween(gAnn, pAnn);
        return { gene: g, partner, x: pAnn.start, odds, counts, type, dist };
      }).filter(Boolean) as Item[];

      // filters
      let filtered = raw
        .filter(r => r.counts >= minCounts)
        .filter(r => r.odds > 0)
        .filter(r => r.dist >= minDistance);
      if (excludeHK) filtered = filtered.filter(r => r.type !== "hkRNA");

      // local peaks per genome for this gene
      const peaksIdx = pickLocalPeaks(filtered.map(r => ({ x: r.x, odds: r.odds })), peakWindow);
      const kept = peaksIdx.map(i => filtered[i]);
      items.push(...kept);
    }

    return items;
  }, [geneList, idx, pairs, minCounts, minDistance, excludeHK, peakWindow]);

  function downloadSVG() {
    const node = document.getElementById("csmap-svg") as SVGSVGElement | null;
    if (!node) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(node);
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `csMAP.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl p-4 space-y-4">
      <header className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">csMAP — Collapsed multi-gene interaction map</h1>
          <p className="text-xs text-gray-600">
            Upload the same Pairs and Annotations CSV as the global map. Enter a comma-separated gene list. Points are local peaks (1 kb) of partner odds-ratio; size=counts; color=feature type.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="border rounded px-3 py-1" onClick={downloadSVG}>Export SVG</button>
        </div>
      </header>

      {/* Controls */}
      <div className="grid grid-cols-12 gap-4">
        <section className="col-span-12 lg:col-span-3 border rounded-2xl p-4 space-y-3">
          <div>
            <div className="text-sm font-medium mb-1">Pairs CSV</div>
            <input ref={filePairsRef} type="file" accept=".csv" onChange={onPairsFile} />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Annotations CSV</div>
            <input ref={fileAnnoRef} type="file" accept=".csv" onChange={onAnnoFile} />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Gene list (comma-separated)</div>
            <textarea
              className="w-full border rounded p-2 text-sm"
              rows={3}
              value={genesText}
              onChange={e => setGenesText(e.target.value)}
              placeholder="e.g. GcvB,CpxQ,MicF"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Min counts: {minCounts}</label>
            <input type="range" min={0} max={100} step={1} value={minCounts} onChange={e => setMinCounts(+e.target.value)} className="w-full" />
          </div>
          <div>
            <label className="text-xs text-gray-600">Min distance (bp): {minDistance}</label>
            <input type="range" min={0} max={20000} step={500} value={minDistance} onChange={e => setMinDistance(+e.target.value)} className="w-full" />
          </div>
          <div>
            <label className="text-xs text-gray-600">Y cap (odds ratio): {yCap}</label>
            <input type="range" min={100} max={5000} step={100} value={yCap} onChange={e => setYCap(+e.target.value)} className="w-full" />
          </div>
          <div>
            <label className="text-xs text-gray-600">Peak window (bp): {peakWindow}</label>
            <input type="range" min={200} max={5000} step={100} value={peakWindow} onChange={e => setPeakWindow(+e.target.value)} className="w-full" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <input id="exHK" type="checkbox" checked={excludeHK} onChange={e => setExcludeHK(e.target.checked)} />
            <label htmlFor="exHK">Exclude hkRNA</label>
          </div>
        </section>

        {/* Plots */}
        <section className="col-span-12 lg:col-span-9 space-y-6">
          <CollapsedScatter
            items={allItems}
            genes={geneList}
            yCap={yCap}
          />
          <TotalsBar totals={geneList.map(g => ({ gene: g, total: totalsByGene[g] ?? 0 }))} />
        </section>
      </div>
    </div>
  );
}

/** -------- Collapsed Scatter (one column per input gene) -------- */
function CollapsedScatter({ items, genes, yCap }:{
  items: Item[];
  genes: string[];
  yCap: number;
}) {
  const width = Math.max(900, genes.length * 120);
  const height = 520;
  const margin = { top: 16, right: 170, bottom: 64, left: 60 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const yTicks = [0, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000].filter(v => v <= yCap);

  const sizeScale = (c: number) => Math.sqrt(Math.max(1, c)) * 2 + 4;

  return (
    <div className="w-full overflow-x-auto">
      <svg id="csmap-svg" width={width} height={height} className="mx-auto block">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* axes */}
          <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#222" />
          {genes.map((g, i) => {
            const gx = (i + 0.5) * (innerW / genes.length);
            return (
              <g key={g} transform={`translate(${gx},${innerH})`}>
                <line y2={6} stroke="#222" />
                <text y={22} textAnchor="middle" className="fill-gray-700 text-[11px] rotate-45">{g}</text>
              </g>
            );
          })}
          <line x1={0} y1={0} x2={0} y2={innerH} stroke="#222" />
          {yTicks.map((t, i) => {
            const ty = innerH - (symlog(t,10,10) / symlog(yCap,10,10)) * innerH;
            return (
              <g key={i} transform={`translate(0,${ty})`}>
                <line x2={-6} stroke="#222" />
                <text x={-9} y={3} textAnchor="end" className="fill-gray-700 text-[10px]">{t}</text>
                <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eee" />
              </g>
            );
          })}
          <text transform={`translate(${-44},${innerH/2}) rotate(-90)`} className="fill-gray-700 text-[11px]">Odds ratio (symlog)</text>

          {/* dots */}
          {items.map((it, k) => {
            const col = genes.indexOf(it.gene);
            if (col < 0) return null;
            const cx = ((col + 0.5) * (innerW / genes.length)) + jitter(k) * (innerW / genes.length);
            const cy = innerH - (symlog(Math.min(it.odds, yCap),10,10) / symlog(yCap,10,10)) * innerH;
            const stroke = pickColor(it.type as any);
            return (
              <g key={`${it.gene}:${it.partner}:${k}`} transform={`translate(${cx},${cy})`}>
                <circle r={sizeScale(it.counts)} fill="#fff" stroke={stroke} strokeWidth={2} />
              </g>
            );
          })}
        </g>

        {/* Legend */}
        <g transform={`translate(${width-160},${20})`}>
          <text className="text-[11px] fill-gray-800">Feature type</text>
          {Object.entries(FEATURE_COLORS).map(([k, color], i) => (
            <g key={k} transform={`translate(0,${14 + i*14})`}>
              <circle r={5} cx={6} cy={6} fill="#fff" stroke={color} strokeWidth={2} />
              <text x={18} y={10} className="text-[10px] fill-gray-700">{k}</text>
            </g>
          ))}
          <g transform={`translate(0,${14 + 9*14})`}>
            <text className="text-[11px] fill-gray-800">Circle size = counts</text>
          </g>
        </g>
      </svg>
    </div>
  );
}

/** -------- Totals log bar -------- */
function TotalsBar({ totals }:{ totals: { gene: string; total: number }[] }) {
  if (!totals.length) return null;

  const maxTotal = Math.max(...totals.map(t => Math.max(1, t.total)));
  const width = Math.max(900, totals.length * 120);
  const height = 380;
  const margin = { top: 12, right: 20, bottom: 64, left: 80 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const yTicks = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].filter(v => v <= maxTotal);

  function yPos(v: number) {
    const t = Math.log10(v);
    const tMax = Math.log10(maxTotal);
    return innerH - (t / tMax) * innerH;
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} className="mx-auto block">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* axes */}
          <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#222" />
          {totals.map((t, i) => {
            const x = (i + 0.5) * (innerW / totals.length);
            return (
              <g key={t.gene} transform={`translate(${x},${innerH})`}>
                <text y={22} textAnchor="middle" className="fill-gray-700 text-[11px] rotate-45">{t.gene}</text>
              </g>
            );
          })}
          <line x1={0} y1={0} x2={0} y2={innerH} stroke="#222" />
          {yTicks.map((v, i) => (
            <g key={i} transform={`translate(0,${yPos(v)})`}>
              <line x2={-6} stroke="#222" />
              <text x={-9} y={3} textAnchor="end" className="fill-gray-700 text-[10px]">{v}</text>
              <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eee" />
            </g>
          ))}
          <text transform={`translate(${-56},${innerH/2}) rotate(-90)`} className="fill-gray-700 text-[11px]">Total interactions (log₁₀)</text>

          {/* bars */}
          {totals.map((t, i) => {
            const x = (i + 0.5) * (innerW / totals.length);
            const y0 = yPos(1);
            const y1 = yPos(Math.max(1, t.total));
            const barH = Math.max(2, y0 - y1);
            const barW = Math.max(10, (innerW / totals.length) * 0.6);
            return (
              <rect key={t.gene} x={x - barW/2} y={y1} width={barW} height={barH} fill="#87CEEB" stroke="#222" />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
