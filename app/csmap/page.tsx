"use client";

import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";

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
  totals?: number;     // total counts when target == focal (upstream pipeline)
  total_ref?: number;  // total counts when ref == focal (upstream pipeline)
  ref_type?: FeatureType;
  target_type?: FeatureType;
};

const FEATURE_COLORS: Record<FeatureType, string> = {
  ncRNA: "#A40194",
  sRNA: "#A40194", // share magenta
  sponge: "#F12C2C",
  tRNA: "#82F778",
  hkRNA: "#C4C5C5",
  CDS: "#F78208",
  "5'UTR": "#76AAD7",
  "3'UTR": "#0C0C0C",
  rRNA: "#999999",
};

const pickColor = (ft?: FeatureType) => FEATURE_COLORS[ft || "CDS"] || "#F78208";

// ---------- helpers ----------
function symlog(y: number, linthresh = 10, base = 10) {
  const s = Math.sign(y);
  const a = Math.abs(y);
  return a <= linthresh ? s * (a / linthresh) : s * (1 + Math.log(a / linthresh) / Math.log(base));
}

function parsePairsCSV(csv: string) {
  const { data } = Papa.parse<Pair>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
  return (data as any[])
    .filter(r => r.ref && r.target)
    .map((r) => ({
      ...r,
      ref: String(r.ref).trim(),
      target: String(r.target).trim(),
    })) as Pair[];
}

function parseAnnoCSV(csv: string) {
  const { data } = Papa.parse<any>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
  const rows: Annotation[] = (data as any[])
    .filter(r => r.gene_name && (r.start != null) && (r.end != null))
    .map(r => ({
      gene_name: String(r.gene_name).trim(),
      start: Number(r.start),
      end: Number(r.end),
      feature_type: r.feature_type,
      strand: r.strand,
      chromosome: r.chromosome,
    }));
  return rows;
}

function basename(name: string) {
  return name.startsWith("5'") || name.startsWith("3'") ? name.slice(2) : name;
}

// pick a single “total interactions” value per input gene
function pickTotalForGene(gene: string, pairs: Pair[]) {
  let best = 0;
  for (const r of pairs) {
    if (r.ref === gene && r.total_ref != null) best = Math.max(best, Number(r.total_ref) || 0);
    if (r.target === gene && r.totals != null) best = Math.max(best, Number(r.totals) || 0);
  }
  return best;
}

export default function CsMapPage() {
  const [countsCutoff, setCountsCutoff] = useState(10); // per your request
  const [query, setQuery] = useState("gcvB, sroC, arrS, lpp, CpxQ");
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [ann, setAnn] = useState<Annotation[]>([]);

  const filePairsRef = useRef<HTMLInputElement>(null);
  const fileAnnoRef = useRef<HTMLInputElement>(null);

  const geneIndex = useMemo(() => {
    const idx: Record<string, Annotation> = {};
    ann.forEach(a => (idx[a.gene_name] = a));
    return idx;
  }, [ann]);

  // --- INPUT GENES (columns) ---
  const inputGenes = useMemo(() => {
    return query
      .split(/[, \n\t\r]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }, [query]);

  // --- COLLAPSED PEAKS (one column per input gene) ---
  const yCap = 5000;
  const peaksPerGene = useMemo(() => {
    const out: {
      gene: string; // column
      partner: string;
      x: number; // column index transformed to x later
      counts: number;
      odds: number;
      feature: FeatureType;
    }[] = [];

    for (const gene of inputGenes) {
      const base = basename(gene);
      const gAnn = geneIndex[gene] || geneIndex[base];
      const gStart = gAnn?.start;
      const gEnd = gAnn?.end;

      // collect eligible targets for this gene
      // — counts >= cutoff
      // — hkRNA filtered out
      // — positive odds_ratio
      const eligible = pairs
        .filter(r => (r.ref === gene || r.target === gene || r.ref === base || r.target === base))
        .filter(r => (Number(r.counts) || 0) >= countsCutoff)
        .filter(r => (r.ref === gene ? r.target_type !== "hkRNA" : r.ref_type !== "hkRNA"))
        .filter(r => (Number(r.odds_ratio) || 0) > 0);

      if (eligible.length === 0) continue;

      // map to partner annotation and genome position
      const mapped = eligible.map(e => {
        const partner = e.ref === gene || e.ref === base ? e.target : e.ref;
        const pAnn = geneIndex[partner] || geneIndex[basename(partner)];
        if (!pAnn) return null;

        // long-range filter (>= 5kb) using both ends when available
        if (gStart != null && gEnd != null) {
          const dist = Math.min(
            Math.abs(pAnn.start - gEnd),
            Math.abs(pAnn.end - gStart),
            Math.abs(pAnn.start - gStart),
            Math.abs(pAnn.end - gEnd)
          );
          if (dist < 5000) return null;
        }

        return {
          partner,
          pos: pAnn.start,
          counts: Number(e.counts) || 0,
          odds: Math.min(Number(e.odds_ratio) || 0, yCap),
          feature: (e.ref === gene || e.ref === base ? e.target_type : e.ref_type) || pAnn.feature_type || "CDS",
        };
      }).filter(Boolean) as { partner: string; pos: number; counts: number; odds: number; feature: FeatureType }[];

      if (mapped.length === 0) continue;

      // sort by genome position
      mapped.sort((a, b) => a.pos - b.pos);

      // local-peak collapse within 1 kb windows: keep highest odds in the window
      const collapsed: typeof mapped = [];
      let current = mapped[0];
      for (let i = 1; i < mapped.length; i++) {
        const next = mapped[i];
        if (next.pos > current.pos + 1000) {
          collapsed.push(current);
          current = next;
        } else if (next.odds > current.odds) {
          current = next;
        }
      }
      collapsed.push(current);

      // push to output (x assigned by column index later)
      const col = gene;
      for (const c of collapsed) {
        out.push({
          gene: col,
          partner: c.partner,
          x: 0,
          counts: c.counts,
          odds: c.odds,
          feature: c.feature,
        });
      }
    }

    return out;
  }, [pairs, geneIndex, inputGenes, countsCutoff]);

  // --- totals per gene (bar chart) ---
  const totals = useMemo(() => {
    return inputGenes.map((g) => ({
      gene: g,
      total: pickTotalForGene(g, pairs),
    }));
  }, [inputGenes, pairs]);

  // ---------- file loaders ----------
  async function onPairsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setPairs(parsePairsCSV(text));
  }
  async function onAnnoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setAnn(parseAnnoCSV(text));
  }

  // ---------- SVG exporters ----------
  function exportSVG(id: string, name: string) {
    const el = document.getElementById(id) as SVGSVGElement | null;
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
    a.download = name.endsWith(".svg") ? name : `${name}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- RENDER ----------
  return (
    <div className="mx-auto max-w-7xl p-4 space-y-6">
      {/* Controls + Scatter */}
      <div className="grid grid-cols-12 gap-4">
        {/* controls */}
        <section className="col-span-12 md:col-span-3 border rounded-2xl p-4 space-y-4">
          <div className="font-semibold">Inputs</div>

          <div>
            <div className="text-xs text-gray-600 mb-1">Gene list (comma or space separated)</div>
            <textarea
              className="w-full border rounded p-2 h-24"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div>
            <div className="text-xs text-gray-600">Pairs table CSV</div>
            <input ref={filePairsRef} type="file" accept=".csv" onChange={onPairsFile} />
          </div>

          <div>
            <div className="text-xs text-gray-600">Annotations CSV</div>
            <input ref={fileAnnoRef} type="file" accept=".csv" onChange={onAnnoFile} />
          </div>

          <div>
            <div className="text-xs text-gray-600">Counts cutoff</div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={countsCutoff}
              onChange={(e) => setCountsCutoff(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-[11px] text-gray-600 mt-1">{countsCutoff}</div>
          </div>
        </section>

        {/* scatter */}
        <section className="col-span-12 md:col-span-9 border rounded-2xl p-4 relative">
          <button
            onClick={() => exportSVG("csmap-scatter", "csMAP_scatter.svg")}
            className="absolute right-3 top-3 text-xs border rounded px-2 py-1"
          >
            Export SVG
          </button>

          <div className="text-sm font-semibold mb-2">Collapsed Interaction Profiles (Local Peaks)</div>

          <SvgCollapsed
            id="csmap-scatter"
            genes={inputGenes}
            points={peaksPerGene}
          />

          {/* legend */}
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <span className="text-xs text-gray-700">Feature types</span>
            {["ncRNA","sRNA","sponge","tRNA","CDS","5'UTR","3'UTR","rRNA"].map((k) => (
              <span key={k} className="inline-flex items-center gap-2 text-xs">
                <span className="inline-block w-3 h-3 rounded-full border" style={{ borderColor: pickColor(k as FeatureType) }} />
                {k}
              </span>
            ))}
            <span className="text-[11px] text-gray-500">Circle radius ≈ ½ (previous) • small circles are drawn on top</span>
          </div>
        </section>
      </div>

      {/* totals bar chart */}
      <section className="border rounded-2xl p-4 relative">
        <button
          onClick={() => exportSVG("csmap-bars", "csMAP_totals.svg")}
          className="absolute right-3 top-3 text-xs border rounded px-2 py-1"
        >
          Export SVG
        </button>

        <div className="text-sm font-semibold mb-2">Total Interactions per Input Gene (log10)</div>
        <SvgTotals id="csmap-bars" totals={totals} />
      </section>
    </div>
  );
}

// ---------- SVG components ----------

function SvgCollapsed({
  id,
  genes,
  points,
}: {
  id: string;
  genes: string[];
  points: {
    gene: string;
    partner: string;
    x: number;
    counts: number;
    odds: number;
    feature: FeatureType;
  }[];
}) {
  const width = 860;
  const height = 360;
  const margin = { top: 24, right: 24, bottom: 48, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const yCap = 5000;
  const yTicks = [0, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
  const yScale = (v: number) => {
    const t = symlog(Math.min(v, yCap), 10, 10);
    const tMax = symlog(yCap, 10, 10);
    return innerH - (t / tMax) * innerH;
  };

  // place columns with side padding so edge circles don’t spill out
  const maxR = 24; // forecasted maximum radius (safe pad)
  const sidePad = Math.max(40, maxR + 8);
  const colW = (innerW - sidePad * 2) / Math.max(1, genes.length - 1 || 1);
  const xCol = (i: number) => sidePad + i * colW;

  // assign x position by column index
  const enriched = points.map(p => ({
    ...p,
    cx: xCol(Math.max(0, genes.indexOf(p.gene))),
    cy: yScale(p.odds),
    // **half-size circles**: radius scale reduced by 50%
    r: Math.sqrt(Math.max(1, p.counts)) * 2.5, // was ~5 → now half
    stroke: pickColor(p.feature),
  }));

  // draw big first, small last (small on top)
  enriched.sort((a, b) => b.r - a.r);

  return (
    <svg id={id} width={width} height={height}>
      <defs>
        <style>{'text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#1f2937;font-size:10px}'}</style>
      </defs>
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* axes */}
        <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#222" />
        {genes.map((g, i) => (
          <g key={g} transform={`translate(${xCol(i)},${innerH}) rotate(45)`}>
            <line y2={-6} stroke="#222" />
            <text y={12} textAnchor="start">{basename(g)}</text>
          </g>
        ))}
        <line x1={0} y1={0} x2={0} y2={innerH} stroke="#222" />
        {yTicks.map((t, i) => (
          <g key={i} transform={`translate(0,${yScale(t)})`}>
            <line x2={-6} stroke="#222" />
            <text x={-9} y={3} textAnchor="end">{t}</text>
            <line x1={0} y1={0} x2={innerW} y2={0} stroke="#eee" />
          </g>
        ))}
        <text transform={`translate(${-44},${innerH/2}) rotate(-90)`}>Odds ratio</text>

        {/* points (big first, small last) */}
        {enriched.map((p, i) => (
          <g key={i} transform={`translate(${p.cx},${p.cy})`}>
            <circle r={p.r} fill="#fff" stroke={p.stroke} strokeWidth={3} opacity={0.9} />
          </g>
        ))}
      </g>
    </svg>
  );
}

function SvgTotals({ id, totals }: { id: string; totals: { gene: string; total: number }[] }) {
  const width = 860;
  const height = 360;
  const margin = { top: 24, right: 24, bottom: 56, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const vals = totals.map(t => Math.max(1, t.total));
  const maxV = Math.max(...vals, 1);
  const yScale = (v: number) => {
    const t = Math.log10(Math.max(1, v));
    const tMax = Math.log10(Math.max(10, maxV));
    return innerH - (t / tMax) * innerH;
  };

  const n = Math.max(1, totals.length);
  const band = innerW / n;
  const barW = band * 0.45; // slimmer bars

  return (
    <svg id={id} width={width} height={height}>
      <defs>
        <style>{'text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#1f2937;font-size:10px}'}</style>
      </defs>
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* axes */}
        <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#222" />
        {totals.map((t, i) => (
          <g key={t.gene} transform={`translate(${i * band + band / 2},${innerH}) rotate(45)`}>
            <line y2={-6} stroke="#222" />
            <text y={12} textAnchor="start">{basename(t.gene)}</text>
          </g>
        ))}
        <line x1={0} y1={0} x2={0} y2={innerH} stroke="#222" />
        {[1, 10, 100, 1000, 10000, 100000].filter(v => v <= Math.max(maxV, 100000)).map((v) => (
          <g key={v} transform={`translate(0,${yScale(v)})`}>
            <line x2={-6} stroke="#222" />
            <text x={-9} y={3} textAnchor="end">{Math.round(Math.log10(v))}</text>
            <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eee" />
          </g>
        ))}
        <text transform={`translate(${-44},${innerH/2}) rotate(-90)`}>Total interactions (log10)</text>

        {/* bars */}
        {totals.map((t, i) => {
          const top = yScale(Math.max(1, t.total));
          const h = innerH - top;
          return (
            <g key={i} transform={`translate(${i * band + (band - barW) / 2},${top})`}>
              <rect width={barW} height={h} fill="#9BC7FF" stroke="#5A8BD8" />
              <text x={barW / 2} y={-6} textAnchor="middle">{Math.round(Math.log10(Math.max(1, t.total)))}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
