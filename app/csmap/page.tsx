// app/csmap/page.tsx
"use client";

import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";

// types
type FeatureType = "CDS" | "5'UTR" | "3'UTR" | "ncRNA" | "tRNA" | "rRNA" | "sRNA" | "hkRNA" | string;
type Annotation = { gene_name: string; start: number; end: number; feature_type?: FeatureType; strand?: string; chromosome?: string; };
type Pair = { ref: string; target: string; counts?: number; odds_ratio?: number; ref_type?: FeatureType; target_type?: FeatureType; totals?: number; total_ref?: number; };

const FEATURE_COLORS: Record<FeatureType, string> = {
  ncRNA: "#A40194", sRNA: "#A40194", sponge: "#F12C2C", tRNA: "#82F778",
  hkRNA: "#C4C5C5", CDS: "#F78208", "5'UTR": "#76AAD7", "3'UTR": "#0C0C0C", rRNA: "#999999",
};

// helpers
const cf = (s: string) => String(s || "").trim().toLowerCase();
const baseName = (g: string) => (g.startsWith("5'") || g.startsWith("3'")) ? g.slice(2) : g;

// parse CSVs (we keep original names but build casefold indices for lookups)
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
      ref_type: r.ref_type, target_type: r.target_type
    }));
}
function parseAnnoCSV(csv: string): Annotation[] {
  const { data } = Papa.parse<any>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
  return (data as any[])
    .filter((r) => r.gene_name && (r.start != null) && (r.end != null))
    .map((r) => ({
      gene_name: String(r.gene_name).trim(),
      start: Number(r.start), end: Number(r.end),
      feature_type: r.feature_type, strand: r.strand, chromosome: r.chromosome
    }));
}

export default function CsMapPage() {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [anno, setAnno] = useState<Annotation[]>([]);
  const [genesInput, setGenesInput] = useState<string>("gcvB, cpxQ"); // example
  const pairsRef = useRef<HTMLInputElement>(null);
  const annoRef = useRef<HTMLInputElement>(null);

  // indices
  const annoByCF = useMemo(() => {
    const m = new Map<string, Annotation>();
    for (const a of anno) m.set(cf(a.gene_name), a);
    return m;
  }, [anno]);

  // parse uploads
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

  // user genes (case-insensitive)
  const geneList = useMemo(() => {
    return genesInput
      .split(/[, \n\t\r]+/)
      .map((g) => g.trim())
      .filter(Boolean);
  }, [genesInput]);

  // build collapsed scatter + totals
  const { dots, totals, warnings } = useMemo(() => {
    const warnings: string[] = [];
    const dots: { col: number; y: number; r: number; stroke: string; label: string }[] = [];
    const totals: { gene: string; total: number }[] = [];

    const COUNT_MIN = 10;     // your request: counts cutoff = 10
    const OR_CAP = 5000;      // keep cap for visual stability
    const LINTHRESH = 10;     // symlog-ish display

    function symlog(v: number) {
      const s = Math.sign(v); const a = Math.abs(v);
      return a <= LINTHRESH ? s * (a / LINTHRESH) : s * (1 + Math.log10(a / LINTHRESH));
    }

    geneList.forEach((gRaw, col) => {
      const gCF = cf(gRaw);
      const annG = annoByCF.get(gCF);
      if (!annG) { warnings.push(`No annotation for ${gRaw}`); totals.push({ gene: gRaw, total: 0 }); return; }

      // total interactions (from totals or total_ref columns; first row that matches either side)
      let totalForGene = 0;
      for (const e of pairs) {
        if (cf(e.ref) === gCF && e.total_ref) { totalForGene = e.total_ref; break; }
        if (cf(e.target) === gCF && e.totals) { totalForGene = e.totals; break; }
      }
      totals.push({ gene: baseName(gRaw), total: Math.max(0, Math.floor(totalForGene)) });

      // gather candidates (both directions), filters:
      // - counts >= 10
      // - odds_ratio > 0
      // - distance > 5000
      // - exclude hkRNA
      const candidates: { pos: number; or: number; counts: number; label: string; type: FeatureType }[] = [];
      for (const e of pairs) {
        const isRef = cf(e.ref) === gCF;
        const isTgt = cf(e.target) === gCF;
        if (!isRef && !isTgt) continue;

        const partner = isRef ? e.target : e.ref;
        const partnerCF = cf(partner);
        const annP = annoByCF.get(partnerCF);
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
        if (!(or > 0)) continue;
        if (dist <= 5000) continue;
        if (type === "hkRNA") continue;

        candidates.push({ pos: annP.start, or, counts, label: partner, type: type as FeatureType });
      }

      // sort by genome pos and take local peaks (1 kb windows, keep max OR)
      candidates.sort((a, b) => a.pos - b.pos);
      const peaks: typeof candidates = [];
      let current = candidates[0];
      for (let i = 1; i < candidates.length; i++) {
        const nxt = candidates[i];
        if (nxt.pos > current.pos + 1000) {
          peaks.push(current);
          current = nxt;
        } else if (nxt.or > current.or) {
          current = nxt;
        }
      }
      if (current) peaks.push(current);

      // draw: larger counts first so small-count dots are on top (not obscured)
      peaks.sort((a, b) => b.counts - a.counts);

      for (const p of peaks) {
        const y = Math.min(OR_CAP, p.or);
        const yT = symlog(y);                  // 0..~something
        const rBase = Math.sqrt(p.counts) * 3; // previous scale
        const r = rBase * 0.5;                 // half the size (your request)
        dots.push({
          col,
          y: yT,
          r,
          stroke: FEATURE_COLORS[p.type] || "#F78208",
          label: p.label,
        });
      }
    });

    return { dots, totals, warnings };
  }, [geneList, pairs, annoByCF]);

  // SVG layout
  const W = Math.max(480, 180 * Math.max(1, geneList.length));
  const H = 540;
  const margin = { top: 40, right: 80, bottom: 80, left: 60 };
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top - margin.bottom;

  // y scale: we used symlog() values with LINTHRESH=10; map to 0..1 roughly for [0..5000] cap
  const yMaxT = 1 + Math.log10(5000 / 10); // symlog(5000)
  const yPix = (t: number) => innerH - (t / yMaxT) * innerH;

  // bar chart params (narrower bars)
  const barW = Math.min(18, Math.max(12, innerW / (geneList.length * 3)));
  const barMax = Math.max(1, ...totals.map((t) => t.total));
  const barY = (v: number) => (200 - (v / barMax) * 200);

  return (
    <div className="mx-auto max-w-[1200px] p-4">
      <h1 className="text-2xl font-semibold mb-3">csMAP</h1>
      <p className="text-sm text-slate-600 mb-4">
        Enter a comma-separated list of genes (case-insensitive). Upload your pairs + annotation CSVs.
        This view shows collapsed interaction peaks (local maxima) and total interactions per input gene.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          className="border rounded px-3 py-2 w-full sm:w-[420px]"
          placeholder="e.g., gcvB, cpxQ, dnaK"
          value={genesInput}
          onChange={(e) => setGenesInput(e.target.value)}
        />
        <div className="text-xs text-slate-500">Counts ≥ 10; distance &gt; 5 kb; hkRNA excluded; OR &gt; 0; local peaks in 1 kb windows.</div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 mb-6">
        <div className="flex-1 space-y-2">
          <div className="text-sm font-medium">Pairs table CSV</div>
          <input ref={pairsRef} type="file" accept=".csv" onChange={onPairsFile} />
        </div>
        <div className="flex-1 space-y-2">
          <div className="text-sm font-medium">Annotations CSV</div>
          <input ref={annoRef} type="file" accept=".csv" onChange={onAnnoFile} />
        </div>
      </div>

      {/* Collapsed scatter */}
      <div className="overflow-x-auto">
        <svg width={W} height={H} style={{ display: "block" }}>
          <defs>
            <style>{`text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#334155;font-size:11px}`}</style>
          </defs>
          <g transform={`translate(${margin.left},${margin.top})`}>
            {/* axes */}
            <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#222" />
            {/* x ticks (gene columns) */}
            {geneList.map((g, i) => {
              const cx = ((i + 0.5) / geneList.length) * innerW;
              return (
                <g key={i} transform={`translate(${cx},${innerH})`}>
                  <line y2={6} stroke="#222" />
                  <text y={24} textAnchor="middle">{baseName(g)}</text>
                </g>
              );
            })}
            {/* y ticks */}
            {[0, 10, 50, 100, 500, 1000, 5000].map((v, i) => {
              const t = v <= 10 ? v / 10 : 1 + Math.log10(v / 10);
              return (
                <g key={i} transform={`translate(0,${yPix(t)})`}>
                  <line x2={-6} stroke="#222" />
                  <text x={-9} y={3} textAnchor="end">{v}</text>
                  <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eef2f7" />
                </g>
              );
            })}
            <text transform={`translate(${-46},${innerH/2}) rotate(-90)`}>Odds ratio (symlog)</text>

            {/* dots — columns spaced evenly; jitter slightly; large counts first so small ones draw on top */}
            {dots.map((d, idx) => {
              const cx = ((d.col + 0.5) / geneList.length) * innerW + (Math.random() - 0.5) * 6;
              const cy = yPix(d.y);
              return (
                <g key={idx} transform={`translate(${cx},${cy})`}>
                  <circle r={d.r} fill="#fff" stroke={d.stroke} strokeWidth={2} />
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Totals bar chart (narrower bars) */}
      <div className="overflow-x-auto mt-8">
        <svg width={W} height={260} style={{ display: "block" }}>
          <defs>
            <style>{`text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#334155;font-size:11px}`}</style>
          </defs>
          <g transform={`translate(${margin.left},20)`}>
            {/* axis line */}
            <line x1={0} y1={200} x2={innerW} y2={200} stroke="#222" />
            {totals.map((t, i) => {
              const cx = ((i + 0.5) / geneList.length) * innerW;
              const h = 200 - barY(t.total);
              return (
                <g key={i} transform={`translate(${cx},0)`}>
                  <rect x={-barW/2} y={barY(t.total)} width={barW} height={h} fill="#8ecae6" stroke="#1f2937" />
                  <text y={220} textAnchor="middle">{t.gene}</text>
                </g>
              );
            })}
            <text x={-6} y={-6} textAnchor="end">Total interactions (log-like scale)</text>
          </g>
        </svg>
      </div>

      {warnings.length > 0 && (
        <div className="mt-4 text-xs text-amber-700">
          {warnings.map((w, i) => <div key={i}>• {w}</div>)}
        </div>
      )}
    </div>
  );
}
