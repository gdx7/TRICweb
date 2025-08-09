"use client";

import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";

// ---------------- Types ----------------
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
  ref_type?: FeatureType;
  target_type?: FeatureType;
};

const FEATURE_COLORS: Record<FeatureType, string> = {
  ncRNA: "#A40194",
  sRNA: "#A40194", // sRNA == ncRNA color (magenta)
  sponge: "#F12C2C",
  tRNA: "#82F778",
  hkRNA: "#C4C5C5",
  CDS: "#F78208",
  "5'UTR": "#76AAD7",
  "3'UTR": "#0C0C0C",
  rRNA: "#999999",
};
const pickColor = (ft?: FeatureType) => FEATURE_COLORS[ft || "CDS"] || "#F78208";

// ---------------- Utils ----------------
function symlog(y: number, linthresh = 10, base = 10) {
  const s = Math.sign(y);
  const a = Math.abs(y);
  return a <= linthresh ? s * (a / linthresh) : s * (1 + Math.log(a / linthresh) / Math.log(base));
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Parse CSVs
function parsePairsCSV(csv: string) {
  const { data } = Papa.parse<Pair>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
  return (data as any[])
    .filter((r) => r.ref && r.target)
    .map((r) => ({ ...r, ref: String(r.ref).trim(), target: String(r.target).trim() })) as Pair[];
}
function parseAnnoCSV(csv: string) {
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
    })) as Annotation[];
}

// ---------------- Page ----------------
export default function CsMAPPage() {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [ann, setAnn] = useState<Annotation[]>([]);
  const [genesInput, setGenesInput] = useState("gcvB, sroC"); // default text
  const [countsCutoff, setCountsCutoff] = useState(10); // you asked for 10
  const yCap = 5000;

  const filePairsRef = useRef<HTMLInputElement>(null);
  const fileAnnoRef = useRef<HTMLInputElement>(null);

  const geneIndex = useMemo(() => {
    const idx: Record<string, Annotation> = {};
    ann.forEach((a) => (idx[a.gene_name] = a));
    return idx;
  }, [ann]);

  const genes = useMemo(
    () =>
      genesInput
        .split(/[,\s]+/)
        .map((g) => g.trim())
        .filter(Boolean),
    [genesInput]
  );

  type PeakPoint = {
    gene: string; // input gene (column)
    partner: string;
    xCat: number; // gene index (for x)
    xJit: number; // jitter
    y: number; // plot y (capped)
    rawY: number; // true OR
    counts: number;
    type: FeatureType;
  };

  // Compute “collapsed” local peaks per gene (1 kb grouping, keep max OR; counts >= cutoff; exclude hkRNA; inter >5kb)
  const { points, totals } = useMemo(() => {
    const pts: PeakPoint[] = [];
    const totalsMap = new Map<string, number>();

    genes.forEach((g, gi) => {
      const gAnn = geneIndex[g];
      if (!gAnn) {
        totalsMap.set(g, 0);
        return;
      }

      // --- total interactions for gene g (sum of counts where ref==g or target==g)
      const edgesForTotal = pairs.filter((e) => e.ref === g || e.target === g);
      const totalCounts =
        edgesForTotal.reduce((acc, e) => acc + (Number(e.counts) || 0), 0) || 0;
      totalsMap.set(g, totalCounts);

      // --- candidate targets (ref==g), with filters (no OR threshold anymore)
      const raw = pairs
        .filter((e) => e.ref === g)
        .filter((e) => (Number(e.counts) || 0) >= countsCutoff)
        .filter((e) => {
          // exclude hkRNA targets
          if ((e.target_type as FeatureType) === "hkRNA") return false;
          // inter > 5 kb
          const tAnn = geneIndex[e.target];
          if (!tAnn) return false;
          const interDist = Math.min(
            Math.abs(tAnn.start - gAnn.end),
            Math.abs(tAnn.end - gAnn.start),
            Math.abs(tAnn.start - gAnn.start),
            Math.abs(tAnn.end - gAnn.end)
          );
          return interDist > 5000;
        })
        .filter((e) => (Number(e.odds_ratio) || 0) > 0);

      // sort by genomic start then pick local maxima in 1 kb neighborhoods (by OR)
      const withPos = raw
        .map((e) => ({ e, targ: geneIndex[e.target], or: Number(e.odds_ratio) || 0 }))
        .filter((r) => !!r.targ)
        .sort((a, b) => a.targ!.start - b.targ!.start);

      const peaks: typeof withPos = [];
      let cur = withPos[0];
      for (let i = 1; i < withPos.length; i++) {
        const nxt = withPos[i];
        if (!cur) {
          cur = nxt;
          continue;
        }
        if (nxt.targ!.start > cur.targ!.start + 1000) {
          peaks.push(cur);
          cur = nxt;
        } else {
          // keep the one with higher OR within the 1kb window
          cur = nxt.or > cur.or ? nxt : cur;
        }
      }
      if (cur) peaks.push(cur);

      // push points (x jitter safe near edges)
      peaks.forEach(({ e, targ, or }) => {
        const jitter = clamp((Math.random() - 0.5) * 0.28, -0.24, 0.24); // tighter jitter
        pts.push({
          gene: g,
          partner: e.target,
          xCat: gi,
          xJit: jitter,
          y: Math.min(or, yCap),
          rawY: or,
          counts: Number(e.counts) || 0,
          type: (e.target_type as FeatureType) || targ!.feature_type || "CDS",
        });
      });
    });

    return { points: pts, totals: totalsMap };
  }, [genes, geneIndex, pairs, countsCutoff]);

  // ---------- SVG helpers ----------
  function exportSVG(id: string, name: string) {
    const node = document.getElementById(id) as SVGSVGElement | null;
    if (!node) return;
    const svg = node.cloneNode(true) as SVGSVGElement;
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent =
      'text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#1f2937;font-size:12px}';
    defs.appendChild(style);
    svg.insertBefore(defs, svg.firstChild);
    const ser = new XMLSerializer();
    const str = ser.serializeToString(svg);
    const blob = new Blob([str], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Render ----------
  // paddings to keep circles inside; also used by xScale
  const xPadLeft = 0.6;
  const xPadRight = 0.6;

  // y ticks (same as your global map)
  const yTicks = [0, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

  // bar-data (totals)
  const totalsArr = genes.map((g) => ({ g, total: totals.get(g) || 0 }));

  return (
    <div className="mx-auto max-w-7xl p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">TRIC-seq — csMAP</h1>
        <button
          className="border rounded px-3 py-1 text-sm"
          onClick={() => exportSVG("csmap-svg", "csMAP.svg")}
        >
          Export SVG
        </button>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-3 space-y-3 border rounded-2xl p-4 shadow-sm">
          <div className="text-sm font-medium">Inputs</div>
          <label className="text-xs text-gray-600">Gene list (comma or space separated)</label>
          <textarea
            className="w-full border rounded p-2 text-sm"
            rows={3}
            value={genesInput}
            onChange={(e) => setGenesInput(e.target.value)}
            placeholder="gcvB, sroC, ..."
          />
          <div className="text-xs text-gray-600">Pairs table CSV</div>
          <input ref={filePairsRef} type="file" accept=".csv" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            const txt = await f.text();
            setPairs(parsePairsCSV(txt));
          }} />
          <div className="text-xs text-gray-600 pt-2">Annotations CSV</div>
          <input ref={fileAnnoRef} type="file" accept=".csv" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            const txt = await f.text();
            setAnn(parseAnnoCSV(txt));
          }} />

          <div className="pt-2">
            <label className="text-xs text-gray-600">Counts cutoff</label>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={countsCutoff}
              onChange={(e) => setCountsCutoff(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-gray-700">{countsCutoff}</div>
          </div>
        </div>

        {/* Collapsed scatter */}
        <div className="col-span-12 lg:col-span-9 border rounded-2xl p-4 shadow-sm">
          <div className="text-sm font-medium mb-2">Collapsed Interaction Profiles (Local Peaks)</div>
          <CollapsedScatter
            svgId="csmap-svg"
            points={points}
            genes={genes}
            xPadLeft={xPadLeft}
            xPadRight={xPadRight}
            yCap={yCap}
            yTicks={yTicks}
          />

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-4 items-center">
            <span className="text-sm font-medium">Feature types</span>
            {["ncRNA","sRNA","sponge","tRNA","CDS","5'UTR","3'UTR","rRNA"].map((k) => (
              <span key={k} className="inline-flex items-center gap-2 text-xs">
                <span
                  className="inline-block w-3 h-3 rounded-full border"
                  style={{ background: "#fff", borderColor: pickColor(k as FeatureType), boxShadow: `inset 0 0 0 2px ${pickColor(k as FeatureType)}` }}
                />
                {k}
              </span>
            ))}
            <span className="ml-6 text-xs text-gray-500">Circle size = counts × 50</span>
          </div>
        </div>
      </div>

      {/* Totals bar */}
      <div className="border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Total Interactions per Input Gene (log10)</div>
          <button
            className="border rounded px-3 py-1 text-sm"
            onClick={() => exportSVG("totals-svg", "csMAP_totals.svg")}
          >
            Export SVG
          </button>
        </div>
        <TotalsBar svgId="totals-svg" rows={totalsArr} />
      </div>
    </div>
  );
}

// ---------- Collapsed scatter SVG ----------
function CollapsedScatter({
  svgId,
  points,
  genes,
  xPadLeft,
  xPadRight,
  yCap,
  yTicks,
}: {
  svgId: string;
  points: {
    gene: string;
    partner: string;
    xCat: number;
    xJit: number;
    y: number;
    rawY: number;
    counts: number;
    type: FeatureType;
  }[];
  genes: string[];
  xPadLeft: number;
  xPadRight: number;
  yCap: number;
  yTicks: number[];
}) {
  const width = 960;
  const height = 520;
  const margin = { top: 16, right: 20, bottom: 60, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  // scales
  const xDomainMin = -xPadLeft;
  const xDomainMax = genes.length - 1 + xPadRight;
  const xScale = (x: number) => ((x - xDomainMin) / (xDomainMax - xDomainMin)) * innerW;
  const yScale = (v: number) => {
    const t = symlog(v, 10, 10);
    const tMax = symlog(yCap, 10, 10);
    return innerH - (t / tMax) * innerH;
  };
  const sizeScale = (c: number) => Math.sqrt(c) * 4 + 4;

  // order: big first, small last -> small on top
  const draw = [...points].sort((a, b) => b.counts - a.counts);

  // x tick positions (under each gene)
  const xTicks = genes.map((g, i) => ({ g, x: i }));

  return (
    <svg id={svgId} width={width} height={height} className="w-full">
      <defs>
        <style>{'text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#1f2937;font-size:12px}'}</style>
      </defs>
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* axes */}
        <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#222" />
        {xTicks.map((t, i) => (
          <g key={i} transform={`translate(${xScale(t.x)},${innerH})`}>
            <line y2={6} stroke="#222" />
            <text y={22} textAnchor="middle" transform="rotate(45) translate(10,0)">
              {t.g}
            </text>
          </g>
        ))}
        <line x1={0} y1={0} x2={0} y2={innerH} stroke="#222" />
        {yTicks.map((t, i) => (
          <g key={i} transform={`translate(0,${yScale(t)})`}>
            <line x2={-6} stroke="#222" />
            <text x={-9} y={4} textAnchor="end">
              {t}
            </text>
            <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eee" />
          </g>
        ))}
        <text transform={`translate(${-44},${innerH / 2}) rotate(-90)`}>Odds ratio</text>

        {/* points */}
        {draw.map((p, i) => {
          const xx = xScale(p.xCat + p.xJit);
          const yy = yScale(p.y);
          return (
            <g key={i} transform={`translate(${xx},${yy})`}>
              <circle
                r={sizeScale(p.counts)}
                fill="#fff"
                stroke={pickColor(p.type)}
                strokeWidth={3}
                opacity={0.85}
              />
              <line x1={0} y1={0} x2={0} y2={Math.max(0, innerH - yy)} stroke="#999" strokeDasharray="2 3" opacity={0.08} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// ---------- Totals bar SVG ----------
function TotalsBar({ svgId, rows }: { svgId: string; rows: { g: string; total: number }[] }) {
  const width = 960;
  const height = 360;
  const margin = { top: 16, right: 24, bottom: 56, left: 72 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  const yScale = (v: number) => {
    const logv = v <= 0 ? 0 : Math.log10(v);
    const logMax = Math.log10(maxTotal);
    return innerH - (logv / logMax) * innerH;
  };

  const barW = innerW / Math.max(1, rows.length);

  return (
    <svg id={svgId} width={width} height={height} className="w-full">
      <defs>
        <style>{'text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#1f2937;font-size:12px}'}</style>
      </defs>
      <g transform={`translate(${margin.left},${margin.top})`}>
        <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#222" />
        {/* y ticks (log10) */}
        {[0, 1, 2, 3, 4, 5].map((p) => (
          <g key={p} transform={`translate(0,${yScale(Math.pow(10, p))})`}>
            <line x2={-6} stroke="#222" />
            <text x={-9} y={4} textAnchor="end">
              {p}
            </text>
            <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eee" />
          </g>
        ))}
        <text transform={`translate(${-48},${innerH / 2}) rotate(-90)`}>Total interactions (log10)</text>

        {rows.map((r, i) => {
          const h = innerH - yScale(r.total);
          return (
            <g key={r.g} transform={`translate(${i * barW},${yScale(r.total)})`}>
              <rect width={barW * 0.6} height={h} fill="#8ec9ff" />
              <text x={(barW * 0.6) / 2} y={-6} textAnchor="middle">
                {r.total}
              </text>
              <text
                transform={`translate(${(barW * 0.6) / 2},${h + 16}) rotate(45)`}
                textAnchor="start"
              >
                {r.g}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
