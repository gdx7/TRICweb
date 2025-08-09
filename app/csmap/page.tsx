"use client";

import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import "../styles/globals.css";

type FeatureType =
  | "CDS"
  | "5'UTR"
  | "3'UTR"
  | "ncRNA"
  | "tRNA"
  | "rRNA"
  | "sRNA"
  | "sponge"
  | "hkRNA"
  | string;

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
  totals?: number;
  total_ref?: number;
  ref_type?: FeatureType;
  target_type?: FeatureType;
  odds_ratio?: number;
  start_ref?: number;
  end_ref?: number;
  start_target?: number;
  end_target?: number;
};

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

const LINTHRESH = 10;
const YCAP = 5000;

function symlog(y: number, linthresh = LINTHRESH, base = 10) {
  const s = Math.sign(y);
  const a = Math.abs(y);
  return a <= linthresh ? s * (a / linthresh) : s * (1 + Math.log(a / linthresh) / Math.log(base));
}

function getBaseName(name: string) {
  return name.startsWith("5'") || name.startsWith("3'") ? name.slice(2) : name;
}

export default function Page() {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [ann, setAnn] = useState<Annotation[]>([]);
  const [genesInput, setGenesInput] = useState<string>("gcvB,sroC"); // placeholder
  const pairsRef = useRef<HTMLInputElement>(null);
  const annRef = useRef<HTMLInputElement>(null);

  const annIndex = useMemo(() => {
    const m = new Map<string, Annotation>();
    ann.forEach(a => m.set(String(a.gene_name).trim(), a));
    return m;
  }, [ann]);

  const genomeMax = useMemo(() => {
    return ann.length ? Math.max(...ann.map(a => a.end)) : 4_700_000;
  }, [ann]);

  // CSV loaders
  function parsePairsCSV(csv: string) {
    const { data } = Papa.parse<Pair>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
    return (data as any[])
      .filter(r => r.ref && r.target)
      .map(r => ({
        ...r,
        ref: String(r.ref).trim(),
        target: String(r.target).trim(),
      })) as Pair[];
  }
  function parseAnnoCSV(csv: string) {
    const { data } = Papa.parse<any>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
    return (data as any[])
      .filter(r => r.gene_name && (r.start != null) && (r.end != null))
      .map(r => ({
        gene_name: String(r.gene_name).trim(),
        start: Number(r.start),
        end: Number(r.end),
        feature_type: r.feature_type,
        strand: r.strand,
        chromosome: r.chromosome,
      })) as Annotation[];
  }
  async function onPairs(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const txt = await f.text();
    setPairs(parsePairsCSV(txt));
  }
  async function onAnn(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const txt = await f.text();
    setAnn(parseAnnoCSV(txt));
  }

  // Build data per your Python logic
  const { points, totalsPerGene, orderedGenes } = useMemo(() => {
    const list = genesInput
      .split(/[, \n\t\r]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const points: { x: number; y: number; size: number; color: string; label: string }[] = [];
    const totalsPerGene: Record<string, number> = {};
    const ORDERED: string[] = [];

    if (!list.length || !pairs.length || !ann.length) {
      return { points, totalsPerGene, orderedGenes: ORDERED };
    }

    const FLANK_FILTER = 5000;
    const PEAK_GAP = 1000;

    list.forEach((gene, idx) => {
      ORDERED.push(gene);
      const focal = annIndex.get(gene);
      if (!focal) {
        totalsPerGene[gene] = 0;
        return;
      }
      const focalStart = focal.start;

      // total interactions (match your "initial_data_for_total" logic)
      const totalRowAsRef = pairs.find(p => p.ref === gene && (p.counts ?? 0) >= 5);
      const totalRowAsTgt = pairs.find(p => p.target === gene && (p.counts ?? 0) >= 5);
      const totalVal =
        (totalRowAsRef?.total_ref != null ? Number(totalRowAsRef.total_ref) : null) ??
        (totalRowAsTgt?.totals != null ? Number(totalRowAsTgt.totals) : null) ??
        0;
      totalsPerGene[gene] = totalVal;

      // filter rows: ref == gene (like your code)
      const filtered = pairs.filter(
        r =>
          r.ref === gene &&
          Number(r.counts) >= 5 &&
          r.odds_ratio != null &&
          Number(r.odds_ratio) > 0 &&
          r.target_type !== "hkRNA"
      );

      // get target positions (annotation-driven; fallback to start_target)
      const targetsWithPos: { pos: number; odds: number; label: string; counts: number; color: string }[] = [];
      for (const row of filtered) {
        const tName = String(row.target);
        const tAnn = annIndex.get(tName);
        const start = tAnn?.start ?? Number(row.start_target);
        if (!Number.isFinite(start)) continue;
        if (Math.abs(focalStart - start) <= FLANK_FILTER) continue; // distance filter >5kb
        const odds = Number(row.odds_ratio) || 0;
        const counts = Number(row.counts) || 0;
        const color = pickColor(row.target_type);
        targetsWithPos.push({ pos: start, odds, label: tName, counts, color });
      }

      // sort by genomic pos
      targetsWithPos.sort((a, b) => a.pos - b.pos);

      // pick local peaks with 1kb separation, taking the max-odds peak within each window
      const peaks: typeof targetsWithPos = [];
      if (targetsWithPos.length) {
        let cur = targetsWithPos[0];
        for (let k = 1; k < targetsWithPos.length; k++) {
          const nxt = targetsWithPos[k];
          if (nxt.pos > cur.pos + PEAK_GAP) {
            peaks.push(cur);
            cur = nxt;
          } else if (nxt.odds > cur.odds) {
            cur = nxt;
          }
        }
        peaks.push(cur);
      }

      // add to scatter (x = column index + jitter, y = capped odds, size = counts*50, color by feature)
      peaks.forEach(p => {
        const jitter = (Math.random() - 0.5) * 0.08; // ~N(0, 0.04)
        const x = idx + jitter;
        const y = Math.min(p.odds, 2000);
        const size = Math.max(1, p.counts) * 50;
        let color = p.color;
        // special rRNA labels like your snippet (optional)
        if (p.label === "rrsH") color = "grey";
        if (p.label === "rrlH") color = "darkgrey";
        points.push({ x, y, size, color, label: p.label });
      });
    });

    return { points, totalsPerGene, orderedGenes: ORDERED };
  }, [genesInput, pairs, ann, annIndex]);

  function downloadSVG(id: string, fname: string) {
    const el = document.getElementById(id) as SVGSVGElement | null;
    if (!el) return;
    const clone = el.cloneNode(true) as SVGSVGElement;
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent =
      'text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#1f2937;font-size:12px}';
    defs.appendChild(style);
    clone.insertBefore(defs, clone.firstChild);
    const ser = new XMLSerializer();
    const str = ser.serializeToString(clone);
    const blob = new Blob([str], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fname.endsWith(".svg") ? fname : `${fname}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Render
  return (
    <div className="mx-auto max-w-7xl p-4 space-y-4">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b">
        <div className="px-2 py-3 font-semibold">TRIC-seq — csMAP</div>
      </header>

      <section className="border rounded-2xl p-4 shadow-sm">
        <div className="font-semibold mb-2">Inputs</div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-600 mb-1">Comma-separated RNAs</div>
            <input
              className="border rounded px-2 py-1 w-full"
              placeholder="e.g., gcvB,sroC,thrL"
              value={genesInput}
              onChange={e => setGenesInput(e.target.value)}
            />
          </div>
          <div className="text-xs text-gray-600">
            <div>Pairs CSV</div>
            <input ref={pairsRef} type="file" accept=".csv" onChange={onPairs} />
            <div className="mt-2">Annotations CSV</div>
            <input ref={annRef} type="file" accept=".csv" onChange={onAnn} />
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          Headers — Pairs: ref,target,counts,odds_ratio,totals,total_ref,ref_type,target_type,start_target,end_target… | Annotations:
          gene_name,start,end,feature_type,strand,chromosome
        </p>
      </section>

      {/* Collapsed scatter */}
      <section className="border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Collapsed Interaction Profiles (Local Peaks)</div>
          <button
            className="border rounded px-3 py-1 text-sm"
            onClick={() => downloadSVG("csmap-scatter", "csMAP_scatter")}
          >
            Export SVG
          </button>
        </div>

        <CollapsedScatter
          id="csmap-scatter"
          points={points}
          genes={orderedGenes}
          ycap={YCAP}
        />

        {/* Legend excluding hkRNA */}
        <div className="mt-3 flex flex-wrap gap-4 items-center">
          <span className="text-sm font-medium">Feature types</span>
          {Object.entries(FEATURE_COLORS)
            .filter(([k]) => k !== "hkRNA")
            .map(([k, color]) => (
              <span key={k} className="inline-flex items-center gap-2 text-xs">
                <span className="inline-block w-3 h-3 rounded-full border" style={{ background: "#fff", borderColor: color, boxShadow: `inset 0 0 0 2px ${color}` }} />
                {k}
              </span>
            ))}
          <span className="ml-6 text-xs text-gray-500">Circle size = counts × 50</span>
        </div>
      </section>

      {/* Totals bar (log axis) */}
      <section className="border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Total Interactions per Input Gene (log10)</div>
          <button
            className="border rounded px-3 py-1 text-sm"
            onClick={() => downloadSVG("csmap-bar", "csMAP_totals")}
          >
            Export SVG
          </button>
        </div>
        <TotalsBar id="csmap-bar" totals={totalsPerGene} genes={orderedGenes} />
      </section>
    </div>
  );
}

// ---------- viz components ----------

function CollapsedScatter({
  id,
  points,
  genes,
  ycap,
}: {
  id: string;
  points: { x: number; y: number; size: number; color: string; label: string }[];
  genes: string[];
  ycap: number;
}) {
  const width = Math.max(700, genes.length * 100 + 160); // width per gene + legend gutter
  const height = 520;
  const margin = { top: 12, right: 40, bottom: 80, left: 60 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const xScale = (xx: number) => (xx / Math.max(1, genes.length - 1)) * (innerW - 20) + 10;
  const yScale = (v: number) => {
    const t = symlog(v);
    return innerH - (t / symlog(ycap)) * innerH;
  };

  return (
    <svg id={id} width={width} height={height} className="block mx-auto">
      <defs>
        <style>{`text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#1f2937;font-size:12px}`}</style>
      </defs>
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* axes */}
        <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#222" />
        {/* x ticks = genes */}
        {genes.map((g, i) => (
          <g key={g} transform={`translate(${xScale(i)},${innerH})`}>
            <line y2={6} stroke="#222" />
            <text y={16} textAnchor="end" transform="rotate(-35)">{g}</text>
          </g>
        ))}
        {/* y axis */}
        <line x1={0} y1={0} x2={0} y2={innerH} stroke="#222" />
        {[0,5,10,25,50,100,250,500,1000,2500,5000].map(t => (
          t <= ycap && (
            <g key={t} transform={`translate(0,${yScale(t)})`}>
              <line x2={-6} stroke="#222" />
              <text x={-9} y={3} textAnchor="end">{t}</text>
              <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eee" />
            </g>
          )
        ))}
        <text transform={`translate(${-44},${innerH/2}) rotate(-90)`}>Odds ratio</text>

        {/* points */}
        {points.map((p, i) => (
          <g key={i} transform={`translate(${xScale(p.x)},${yScale(p.y)})`}>
            <circle r={Math.sqrt(p.size) / 2} fill="#fff" stroke={p.color} strokeWidth={3} opacity={0.85} />
          </g>
        ))}
      </g>
    </svg>
  );
}

function TotalsBar({
  id,
  totals,
  genes,
}: {
  id: string;
  totals: Record<string, number>;
  genes: string[];
}) {
  const width = Math.max(700, genes.length * 100 + 160);
  const height = 420;
  const margin = { top: 12, right: 40, bottom: 80, left: 70 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const vals = genes.map(g => Math.max(1, Number(totals[g] || 0)));
  const maxV = Math.max(...vals);
  const log = (v: number) => Math.log10(v);
  const yScale = (v: number) => innerH - (log(v) / log(maxV)) * innerH;
  const xScale = (i: number) => (i / Math.max(1, genes.length)) * innerW + 10;
  const barW = Math.max(18, innerW / Math.max(genes.length * 1.5, 10));

  return (
    <svg id={id} width={width} height={height} className="block mx-auto">
      <defs>
        <style>{`text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#1f2937;font-size:12px}`}</style>
      </defs>
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* axes */}
        <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#222" />
        {/* x ticks (genes) */}
        {genes.map((g, i) => (
          <g key={g} transform={`translate(${xScale(i)},${innerH})`}>
            <line y2={6} stroke="#222" />
            <text y={16} textAnchor="end" transform="rotate(-35)">{g}</text>
          </g>
        ))}
        {/* y axis (log10 labels) */}
        <line x1={0} y1={0} x2={0} y2={innerH} stroke="#222" />
        {Array.from(new Set([1,2,5,10,20,50,100,200,500,1000,2000,5000,10000].filter(v => v <= maxV))).map(v => (
          <g key={v} transform={`translate(0,${yScale(v)})`}>
            <line x2={-6} stroke="#222" />
            <text x={-10} y={3} textAnchor="end">{v}</text>
            <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eee" />
          </g>
        ))}
        <text transform={`translate(${-52},${innerH/2}) rotate(-90)`}>Total Interactions (log10)</text>

        {/* bars */}
        {genes.map((g, i) => {
          const v = Math.max(1, Number(totals[g] || 0));
          const y = yScale(v);
          return (
            <g key={g} transform={`translate(${xScale(i) - barW/2},${y})`}>
              <rect width={barW} height={innerH - y} fill="#7dd3fc" stroke="#0ea5e9" />
              <text x={barW/2} y={-4} textAnchor="middle" fontSize="11">{v}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
