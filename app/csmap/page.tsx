"use client";

import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";

/** ---------- Types ---------- */
type FeatureType =
  | "CDS"
  | "5'UTR"
  | "3'UTR"
  | "ncRNA"
  | "tRNA"
  | "rRNA"
  | "sRNA"
  | "hkRNA"
  | string;

type Annotation = {
  gene_name: string;
  start: number;
  end: number;
  feature_type?: FeatureType;
  strand?: "+" | "-" | string;
  chromosome?: string;
};

type Pair = {
  ref: string;
  target: string;
  counts?: number;
  odds_ratio?: number;
  totals?: number; // total interactions for target if this row lists target as focal
  total_ref?: number; // total interactions for ref if this row lists ref as focal
  ref_type?: FeatureType;
  target_type?: FeatureType;
};

type PeakPoint = {
  gene: string; // input gene (column)
  partner: string; // target partner
  x: number; // column index (with tiny jitter for spread)
  y: number; // symlog-like plotted OR (capped)
  or: number; // raw OR
  counts: number;
  ft: FeatureType;
};

/** ---------- Colours (match globalMAP) ---------- */
// sRNA and ncRNA share magenta edge
const FEATURE_COLORS: Record<FeatureType, string> = {
  ncRNA: "#A40194",
  sRNA: "#A40194",
  sponge: "#F12C2C",
  tRNA: "#82F778",
  hkRNA: "#C4C5C5",
  CDS: "#F78208",
  "5'UTR": "#76AAD7",
  "3'UTR": "#0C0C0C",
  rRNA: "#999999",
};
const pickColor = (ft?: FeatureType) => FEATURE_COLORS[ft || "CDS"] || "#F78208";

/** ---------- Utils ---------- */
const symlog = (v: number, lin = 10, base = 10) => {
  const s = Math.sign(v);
  const a = Math.abs(v);
  return a <= lin ? s * (a / lin) : s * (1 + Math.log(a / lin) / Math.log(base));
};
const jitter = (seed: number) => {
  // simple LCG for deterministic jitter
  let x = seed | 0;
  return () => {
    x = (1664525 * x + 1013904223) % 0xffffffff;
    return (x / 0xffffffff - 0.5) * 0.08; // ~±0.04
  };
};

function parsePairsCSV(csv: string): Pair[] {
  const { data } = Papa.parse<Pair>(csv, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return (data as any[])
    .filter((r) => r.ref && r.target)
    .map((r) => ({
      ...r,
      ref: String(r.ref).trim(),
      target: String(r.target).trim(),
    }));
}

function parseAnnoCSV(csv: string): Annotation[] {
  const { data } = Papa.parse<any>(csv, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return (data as any[])
    .filter((r) => r.gene_name && r.start != null && r.end != null)
    .map((r) => ({
      gene_name: String(r.gene_name).trim(),
      start: Number(r.start),
      end: Number(r.end),
      feature_type: r.feature_type,
      strand: r.strand,
      chromosome: r.chromosome,
    }));
}

function exportSVG(id: string, filename: string) {
  const node = document.getElementById(id) as SVGSVGElement | null;
  if (!node) return;
  const clone = node.cloneNode(true) as SVGSVGElement;
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
  a.download = `${filename}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

/** ---------- Page ---------- */
export default function CsMAPPage() {
  const [geneInput, setGeneInput] = useState("gcvB, cpxQ"); // example
  const [countsCutoff, setCountsCutoff] = useState(10); // per request
  const [pairsCSVName, setPairsCSVName] = useState<string | null>(null);
  const [annoCSVName, setAnnoCSVName] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [ann, setAnn] = useState<Annotation[]>([]);

  const filePairsRef = useRef<HTMLInputElement>(null);
  const fileAnnoRef = useRef<HTMLInputElement>(null);

  // lowercased annotation index for case-insensitivity
  const annoIndex = useMemo(() => {
    const idx: Record<string, Annotation> = {};
    ann.forEach((a) => (idx[a.gene_name.toLowerCase()] = a));
    return idx;
  }, [ann]);

  const geneList = useMemo(() => {
    return geneInput
      .split(/[, \n\r\t]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.toLowerCase());
  }, [geneInput]);

  // compute peaks per input gene & totals per input gene
  const { peaks, totals } = useMemo(() => {
    const allPeaks: PeakPoint[] = [];
    const totalsByGene: { gene: string; total: number }[] = [];

    const distBetween = (a: Annotation, b: Annotation) =>
      Math.min(
        Math.abs(a.start - b.end),
        Math.abs(a.end - b.start),
        Math.abs(a.start - b.start),
        Math.abs(a.end - b.end)
      );

    const rng = jitter(42);

    for (let gi = 0; gi < geneList.length; gi++) {
      const g = geneList[gi];
      const gAnn = annoIndex[g];
      if (!gAnn) {
        totalsByGene.push({ gene: g, total: 0 });
        continue;
      }

      // gather totals
      let totalVal = 0;
      // prefer a line where this gene is ref (use total_ref), else any where it's target (use totals)
      const asRef = pairs.find((p) => p.ref.toLowerCase() === g);
      const asTgt = pairs.find((p) => p.target.toLowerCase() === g);
      if (asRef && (asRef.total_ref ?? 0) > 0) totalVal = Number(asRef.total_ref);
      else if (asTgt && (asTgt.totals ?? 0) > 0) totalVal = Number(asTgt.totals);
      else {
        // fallback: sum counts where g involved
        totalVal = pairs.reduce((acc, p) => {
          if (p.ref.toLowerCase() === g || p.target.toLowerCase() === g) {
            acc += Number(p.counts || 0);
          }
          return acc;
        }, 0);
      }
      totalsByGene.push({ gene: g, total: totalVal });

      // collect candidates for peaks (this page follows your Colab filters)
      // Only rows where this gene is the REF (consistent with your script)
      const rows = pairs.filter((p) => p.ref.toLowerCase() === g);

      // build list with partner positions + OR, apply filters (counts>=cutoff, OR>0, distance>5kb, exclude hkRNA)
      const candidates: { pos: number; or: number; counts: number; ft: FeatureType; partner: string }[] = [];
      for (const p of rows) {
        const partnerName = p.target;
        const partAnn = annoIndex[partnerName.toLowerCase()];
        if (!partAnn) continue;

        const counts = Number(p.counts || 0);
        const or = Number(p.odds_ratio || 0);
        const ft = (p.target_type || partAnn.feature_type || "CDS") as FeatureType;

        if (ft === "hkRNA") continue;
        if (!(counts >= countsCutoff)) continue;
        if (!(or > 0)) continue;

        const d = distBetween(gAnn, partAnn);
        if (d <= 5000) continue;

        candidates.push({
          pos: partAnn.start,
          or,
          counts,
          ft,
          partner: partnerName,
        });
      }

      // sort by genomic position, then pick local maxima in 1kb windows
      candidates.sort((a, b) => a.pos - b.pos);
      const peaksForG: typeof candidates = [];
      if (candidates.length > 0) {
        let current = candidates[0];
        for (let i = 1; i < candidates.length; i++) {
          const nxt = candidates[i];
          if (nxt.pos > current.pos + 1000) {
            peaksForG.push(current);
            current = nxt;
          } else if (nxt.or > current.or) {
            current = nxt;
          }
        }
        peaksForG.push(current);
      }

      // convert to plotted points: x = column index + jitter, y = symlog(OR) with cap 5000
      const cap = 5000;
      // draw order: big first, small later -> small circles on top (less obscured)
      peaksForG
        .slice()
        .sort((a, b) => b.counts - a.counts)
        .forEach((pk) => {
          const x = gi + 0.5 + rng();
          const y = symlog(Math.min(pk.or, cap), 10, 10);
          allPeaks.push({
            gene: g,
            partner: pk.partner,
            x,
            y,
            or: pk.or,
            counts: pk.counts,
            ft: pk.ft,
          });
        });
    }

    return { peaks: allPeaks, totals: totalsByGene };
  }, [geneList, annoIndex, pairs, countsCutoff]);

  /** ---------- Handlers ---------- */
  async function onPairsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setPairs(parsePairsCSV(text));
    setPairsCSVName(f.name);
  }
  async function onAnnoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setAnn(parseAnnoCSV(text));
    setAnnoCSVName(f.name);
  }

  /** ---------- Render ---------- */
  // figure layout
  const cap = 5000;
  const yTicks = [0, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
  const W = Math.max(720, 260 * Math.max(1, geneList.length));
  const H = 400;
  const margin = { top: 28, right: 28, bottom: 70, left: 72 };
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top - margin.bottom;

  const xScale = (x: number) => {
    // columns 0..n-1 spread across innerW, jitter is small offset
    const n = Math.max(1, geneList.length);
    return (x / n) * innerW;
  };
  const yScalePlot = (or: number) => {
    const t = symlog(or, 10, 10);
    const tMax = symlog(cap, 10, 10);
    return innerH - (t / tMax) * innerH;
  };
  // half-size circles: counts × 25 (area-ish look via radius sqrt)
  const rScale = (c: number) => Math.sqrt(Math.max(1, c)) * 2.5 + 6;

  // group peaks by column to draw column grid and labels
  const peaksByCol = useMemo(() => {
    const map: Record<number, PeakPoint[]> = {};
    peaks.forEach((p) => {
      const col = Math.floor(p.x); // 0..n-1
      (map[col] ||= []).push(p);
    });
    return map;
  }, [peaks]);

  return (
    <div className="p-4 mx-auto max-w-7xl">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">TRIC-seq — csMAP</h1>
        <nav className="text-sm">
          <a className="text-blue-600 hover:underline mr-4" href="/global">
            globalMAP
          </a>
          <a className="text-blue-600 hover:underline mr-4" href="/csmap">
            csMAP
          </a>
          <a className="text-blue-600 hover:underline" href="/pairmap">
            pairMAP
          </a>
        </nav>
      </header>

      <div className="grid grid-cols-12 gap-4 mt-3">
        {/* Controls */}
        <section className="col-span-12 md:col-span-4 lg:col-span-3 border rounded-lg p-3 bg-white">
          <div className="text-sm font-semibold mb-2">Inputs</div>
          <div className="text-xs text-gray-600 mb-1">
            Gene list (comma or space separated)
          </div>
          <textarea
            className="w-full border rounded p-2 text-sm"
            rows={3}
            value={geneInput}
            onChange={(e) => setGeneInput(e.target.value)}
            placeholder="e.g., gcvB, sroC, arrS, lpp, CpxQ"
          />

          <div className="mt-3 text-xs text-gray-600">Pairs table CSV</div>
          <input ref={filePairsRef} type="file" accept=".csv" onChange={onPairsFile} />
          <div className="text-[11px] text-gray-500">
            {pairsCSVName || "(waiting for CSV)"}
          </div>

          <div className="mt-3 text-xs text-gray-600">Annotations CSV</div>
          <input ref={fileAnnoRef} type="file" accept=".csv" onChange={onAnnoFile} />
          <div className="text-[11px] text-gray-500">
            {annoCSVName || "(waiting for CSV)"}
          </div>

          <div className="mt-4 text-xs text-gray-600">
            Counts cutoff <span className="font-medium">({countsCutoff})</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={countsCutoff}
            onChange={(e) => setCountsCutoff(Number(e.target.value))}
            className="w-full"
          />

          <p className="mt-3 text-[11px] text-gray-500">
            Filters used: counts ≥ {countsCutoff}; distance &gt; 5 kb; hkRNA excluded; odds
            ratio &gt; 0; local peaks in 1 kb windows. Case-insensitive gene matching.
          </p>
        </section>

        {/* csMAP scatter */}
        <section className="relative col-span-12 md:col-span-8 lg:col-span-9 border rounded-lg p-2 bg-white">
          <button
            onClick={() => exportSVG("csmap-scatter", "csMAP_scatter")}
            className="absolute right-3 top-3 text-xs px-2 py-1 border rounded bg-white hover:bg-slate-50"
          >
            Export SVG
          </button>

          <svg id="csmap-scatter" width={W} height={H} style={{ display: "block" }}>
            <defs>
              <style>{`text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#334155;font-size:11px}`}</style>
            </defs>
            <g transform={`translate(${margin.left},${margin.top})`}>
              {/* Axes */}
              <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#222" />
              {/* y ticks */}
              {yTicks.map((t, i) => (
                <g key={i} transform={`translate(0,${yScalePlot(t)})`}>
                  <line x2={-6} stroke="#222" />
                  <text x={-9} y={3} textAnchor="end">
                    {t}
                  </text>
                  <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eef2f7" />
                </g>
              ))}
              <text transform={`translate(${-54},${innerH / 2}) rotate(-90)`}>Odds ratio (symlog)</text>

              {/* vertical grid + x labels */}
              {geneList.map((g, i) => {
                const x0 = xScale(i);
                const x1 = xScale(i + 1);
                const mid = (x0 + x1) / 2;
                return (
                  <g key={i}>
                    <line x1={x0} x2={x0} y1={0} y2={innerH} stroke="#f3f4f6" />
                    <text x={mid} y={innerH + 22} textAnchor="middle" transform={`rotate(-30,${mid},${innerH + 22})`}>
                      {g}
                    </text>
                  </g>
                );
              })}
              <line x1={xScale(geneList.length)} x2={xScale(geneList.length)} y1={0} y2={innerH} stroke="#f3f4f6" />

              {/* Points — big first, small last so small are on top */}
              {Object.entries(peaksByCol).map(([colStr, pts]) => {
                const col = Number(colStr);
                const x0 = xScale(col);
                const x1 = xScale(col + 1);
                return (
                  <g key={col}>
                    {pts
                      .slice()
                      .sort((a, b) => b.counts - a.counts)
                      .map((p, idx) => {
                        const cx = x0 + (p.x - col) * (x1 - x0);
                        const cy = yScalePlot(Math.min(p.or, cap));
                        return (
                          <g key={idx} transform={`translate(${cx},${cy})`}>
                            <circle
                              r={rScale(p.counts)}
                              fill="#fff"
                              stroke={pickColor(p.ft)}
                              strokeWidth={2}
                              opacity={0.9}
                            />
                          </g>
                        );
                      })}
                    {/* draw small last */}
                    {pts
                      .slice()
                      .sort((a, b) => a.counts - b.counts)
                      .map((p, idx) => {
                        const cx = x0 + (p.x - col) * (x1 - x0);
                        const cy = yScalePlot(Math.min(p.or, cap));
                        return (
                          <g key={`top-${idx}`} transform={`translate(${cx},${cy})`}>
                            <circle
                              r={Math.max(1, rScale(p.counts) - 0.01)}
                              fill="none"
                              stroke={pickColor(p.ft)}
                              strokeWidth={2}
                            />
                          </g>
                        );
                      })}
                  </g>
                );
              })}
            </g>

            {/* Legend */}
            <g transform={`translate(${W - 200},${H - 110})`}>
              <text>Feature types</text>
              {["CDS", "5'UTR", "3'UTR", "ncRNA", "sRNA", "tRNA", "rRNA", "sponge", "hkRNA"].map(
                (k, i) => (
                  <g key={k} transform={`translate(0,${14 + i * 14})`}>
                    <circle r={5} cx={6} cy={6} fill="#fff" stroke={pickColor(k)} strokeWidth={2} />
                    <text x={18} y={10}>
                      {k}
                    </text>
                  </g>
                )
              )}
              <text y={14 + 10 * 14 + 6}>Circle size = counts × 25</text>
            </g>
          </svg>
        </section>
      </div>

      {/* Totals bar chart (log10 axis) */}
      <div className="relative overflow-x-auto rounded-lg border bg-white mt-6">
        <button
          onClick={() => exportSVG("csmap-bars", "csMAP_totals")}
          className="absolute right-3 top-3 text-xs px-2 py-1 border rounded bg-white hover:bg-slate-50"
        >
          Export SVG
        </button>

        {(() => {
          const Wb = Math.max(540, 160 * Math.max(1, geneList.length));
          const Hb = 320;
          const m = { top: 28, right: 50, bottom: 70, left: 72 };
          const iw = Wb - m.left - m.right;
          const ih = Hb - m.top - m.bottom;

          const tMax = Math.max(1, ...totals.map((t) => t.total || 1));
          const maxPow = Math.pow(10, Math.ceil(Math.log10(tMax)));
          const yTicks: number[] = [];
          for (let p = 0; p <= Math.ceil(Math.log10(maxPow)); p++) yTicks.push(Math.pow(10, p));
          const y = (v: number) =>
            ih - (Math.log10(Math.max(1, v)) / Math.log10(maxPow)) * ih;

          const step = iw / Math.max(1, geneList.length);
          const barW = Math.min(24, Math.max(10, step * 0.35));

          return (
            <svg id="csmap-bars" width={Wb} height={Hb} style={{ display: "block" }}>
              <defs>
                <style>{`text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#334155;font-size:11px}`}</style>
              </defs>
              <g transform={`translate(${m.left},${m.top})`}>
                <line x1={0} y1={ih} x2={iw} y2={ih} stroke="#222" />
                {yTicks.map((v, i) => (
                  <g key={i} transform={`translate(0,${y(v)})`}>
                    <line x2={-6} stroke="#222" />
                    <text x={-9} y={3} textAnchor="end">
                      {v.toLocaleString()}
                    </text>
                    <line x1={0} x2={iw} y1={0} y2={0} stroke="#eef2f7" />
                  </g>
                ))}
                <text transform={`translate(${-54},${ih / 2}) rotate(-90)`}>
                  Total interactions (log10)
                </text>

                {totals.map((t, i) => {
                  const x = i * step + (step - barW) / 2;
                  const yy = y(t.total || 0);
                  const h = ih - yy;
                  return (
                    <g key={i} transform={`translate(${x},${yy})`}>
                      <rect width={barW} height={Math.max(0, h)} fill="#93c5fd" stroke="#60a5fa" />
                      <text x={barW / 2} y={-6} textAnchor="middle" style={{ fontSize: "10px" }}>
                        {t.total || 0}
                      </text>
                    </g>
                  );
                })}

                {totals.map((t, i) => {
                  const x = i * step + step / 2;
                  return (
                    <g key={i} transform={`translate(${x},${ih})`}>
                      <text y={20} textAnchor="middle" transform="rotate(-30)">
                        {t.gene.toLowerCase()}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          );
        })()}
      </div>
    </div>
  );
}
