"use client";

import React, { useMemo, useState, useRef } from "react";
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
  totals?: number;
  total_ref?: number;
  ref_type?: FeatureType;
  target_type?: FeatureType;
};

type ScatterRow = {
  partner: string;
  x: number;
  y: number;       // capped OR for plotting
  rawY: number;    // true odds_ratio
  counts: number;  // summed counts across duplicates
  type: FeatureType;
  distance: number;
};

const FEATURE_COLORS: Record<FeatureType, string> = {
  // sRNA and ncRNA share magenta
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

function simulateData(nGenes = 500) {
  const rng = ((seed: number) => () => (seed = (seed * 1664525 + 1013904223) % 0xffffffff) / 0xffffffff)(42);
  const ann: Annotation[] = [];
  const classes: FeatureType[] = ["CDS", "5'UTR", "3'UTR", "ncRNA", "tRNA", "sRNA"];
  const genomeLen = 4_600_000;
  for (let i = 0; i < nGenes; i++) {
    const ft = classes[Math.floor(rng() * classes.length)];
    const start = Math.floor(rng() * genomeLen);
    const len = Math.max(150, Math.floor(rng() * 1500));
    const end = Math.min(start + len, genomeLen - 1);
    const name = ft === "sRNA" ? `sRNA_${i}` : `gene_${i}`;
    ann.push({ gene_name: name, start, end, feature_type: ft, strand: rng() > 0.5 ? "+" : "-", chromosome: "chr" });
  }
  ann.push({ gene_name: "GcvB", start: 3500000, end: 3500600, feature_type: "sRNA", strand: "+", chromosome: "chr" });
  ann.push({ gene_name: "CpxQ", start: 1800000, end: 1800480, feature_type: "sRNA", strand: "+", chromosome: "chr" });

  const pairs: Pair[] = [];
  const genes = ann.map(a => a.gene_name);
  function addEdge(a: string, b: string, bias = 1) {
    const c = Math.max(1, Math.floor((rng() ** 2) * 120 * bias));
    const or = 0.5 + Math.pow(rng(), 0.4) * 400 * bias;
    const aAnn = ann.find(x => x.gene_name === a);
    const bAnn = ann.find(x => x.gene_name === b);
    pairs.push({
      ref: a,
      target: b,
      counts: c,
      odds_ratio: or,
      ref_type: aAnn?.feature_type,
      target_type: bAnn?.feature_type,
    });
  }
  for (let k = 0; k < nGenes * 2; k++) {
    const a = genes[Math.floor(rng() * genes.length)];
    let b = genes[Math.floor(rng() * genes.length)];
    if (a === b) continue;
    addEdge(a, b, 1);
  }
  const pick = (n: number) => Array.from({ length: n }, () => genes[Math.floor(rng() * genes.length)]);
  pick(60).forEach(g => addEdge("GcvB", g, 4));
  pick(40).forEach(g => addEdge("CpxQ", g, 3));

  return { annotations: ann, pairs };
}

function symlog(y: number, linthresh = 10, base = 10) {
  const s = Math.sign(y);
  const a = Math.abs(y);
  return a <= linthresh ? s * (a / linthresh) : s * (1 + Math.log(a / linthresh) / Math.log(base));
}

export default function Page() {
  const [data, setData] = useState(() => simulateData(500));
  const [focal, setFocal] = useState<string>("GcvB");
  const [minCounts, setMinCounts] = useState(5);
  const [minDistance, setMinDistance] = useState(5000);
  const [yCap, setYCap] = useState(5000);
  const [labelThreshold, setLabelThreshold] = useState(50);
  const [excludeTypes, setExcludeTypes] = useState<FeatureType[]>(["rRNA", "tRNA"]);
  const [query, setQuery] = useState("");
  const [highlightQuery, setHighlightQuery] = useState(""); // genes to face-fill yellow

  const filePairsRef = useRef<HTMLInputElement>(null);
  const fileAnnoRef = useRef<HTMLInputElement>(null);
  const [loadedPairsName, setLoadedPairsName] = useState<string | null>(null);
  const [loadedAnnoName, setLoadedAnnoName] = useState<string | null>(null);

  const annotations = data.annotations;
  const pairs = data.pairs;

  const geneIndex = useMemo(() => {
    const idx: Record<string, Annotation> = {};
    annotations.forEach(a => (idx[a.gene_name.trim()] = a));
    return idx;
  }, [annotations]);

  const allGenes = useMemo(() => annotations.map(a => a.gene_name).sort(), [annotations]);

  const highlightSet = useMemo(() => {
    // comma or whitespace separated
    const toks = highlightQuery
      .split(/[, \n\t\r]+/)
      .map(t => t.trim())
      .filter(Boolean);
    return new Set(toks);
  }, [highlightQuery]);

  // STRICT aggregation: sum counts, max odds_ratio for each partner
  const partners = useMemo<ScatterRow[]>(() => {
    const edges = pairs.filter(p => (String(p.ref).trim() === focal || String(p.target).trim() === focal));
    const acc = new Map<string, ScatterRow>();

    for (const e of edges) {
      const ref = String(e.ref || "").trim();
      const tgt = String(e.target || "").trim();
      const partner = ref === focal ? tgt : ref;
      if (!partner || partner === focal) continue;

      const partAnn = geneIndex[partner];
      const focalAnn = geneIndex[focal];
      if (!partAnn || !focalAnn) continue;

      const dist = Math.min(
        Math.abs(partAnn.start - focalAnn.end),
        Math.abs(partAnn.end - focalAnn.start),
        Math.abs(partAnn.start - focalAnn.start),
        Math.abs(partAnn.end - focalAnn.end)
      );

      const or = Number(e.odds_ratio) || 0;
      if (!(or > 0)) continue; // only odds_ratio

      const counts = Number(e.counts) || 0;
      const type = (ref === focal ? e.target_type : e.ref_type) || partAnn.feature_type || "CDS";

      const prev = acc.get(partner);
      if (prev) {
        prev.counts += counts;
        prev.rawY = Math.max(prev.rawY, or);
        prev.y = Math.min(prev.rawY, yCap);
        prev.type = prev.type || (type as FeatureType);
        prev.distance = Math.min(prev.distance, dist);
      } else {
        acc.set(partner, {
          partner,
          x: partAnn.start,
          y: Math.min(or, yCap),
          rawY: or,
          counts,
          type: type as FeatureType,
          distance: dist,
        });
      }
    }

    return Array.from(acc.values())
      .filter(r => r.counts >= minCounts)
      .filter(r => r.distance >= minDistance)
      .filter(r => !excludeTypes.includes(r.type))
      .sort((a, b) => b.rawY - a.rawY);
  }, [pairs, focal, geneIndex, minCounts, minDistance, excludeTypes, yCap]);

  const genomeMax = useMemo(() => Math.max(...annotations.map(a => a.end)), [annotations]);
  const focalAnn = geneIndex[focal];

  const yTicks = useMemo(() => [0, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000].filter(v => v <= yCap), [yCap]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query) return;
    const match =
      allGenes.find(g => g.toLowerCase() === query.toLowerCase()) ||
      allGenes.find(g => g.toLowerCase().includes(query.toLowerCase()));
    if (match) setFocal(match);
  }

  // CSV loaders (trim names)
  function parsePairsCSV(csv: string) {
    const { data } = Papa.parse<Pair>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
    const rows = (data as any[])
      .filter(r => r.ref && r.target)
      .map(r => ({ ...r, ref: String(r.ref).trim(), target: String(r.target).trim() }));
    return rows as Pair[];
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
  async function onPairsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parsePairsCSV(text);
    setData(prev => ({ ...prev, pairs: parsed }));
    setLoadedPairsName(file.name);
  }
  async function onAnnoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseAnnoCSV(text);
    setData(prev => ({ ...prev, annotations: parsed }));
    setLoadedAnnoName(file.name);
    if (parsed.length > 0) setFocal(parsed[0].gene_name);
  }

  // Export SVG with embedded fonts/styles
  function downloadSVG() {
    const el = document.getElementById("scatter-svg") as SVGSVGElement | null;
    if (!el) return;
    const clone = el.cloneNode(true) as SVGSVGElement;
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent =
      'text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#1f2937;font-size:10px}.axis-label{font-size:11px}';
    defs.appendChild(style);
    clone.insertBefore(defs, clone.firstChild);
    const ser = new XMLSerializer();
    const str = ser.serializeToString(clone);
    const blob = new Blob([str], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${focal}_interactome.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-xl font-semibold">TRIC-seq Interactome Explorer</div>
          <div className="text-xs text-gray-500">Demo uses simulated data — upload your CSVs below.</div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 grid grid-cols-12 gap-4">
        {/* Controls */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <section className="border rounded-2xl p-4 shadow-sm">
            <div className="font-semibold mb-2">Search</div>
            <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-2">
              <input
                className="border rounded px-2 py-1 w-full"
                placeholder="Enter RNA (e.g., GcvB)"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <button className="border rounded px-3">Go</button>
            </form>

            {/* Highlight list for yellow face color */}
            <div className="mt-3">
              <div className="text-xs text-gray-600 mb-1">Highlight genes (comma/space-separated)</div>
              <input
                className="border rounded px-2 py-1 w-full"
                placeholder="e.g., dnaK, tufA, sRNA_12"
                value={highlightQuery}
                onChange={e => setHighlightQuery(e.target.value)}
              />
              <div className="text-[11px] text-gray-500 mt-1">Highlighted genes appear with yellow fill if present in the map.</div>
            </div>
          </section>

          <section className="border rounded-2xl p-4 shadow-sm space-y-3">
            <div className="font-semibold">Filters</div>

            <label className="text-xs text-gray-600">Min counts: {minCounts}</label>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={minCounts}
              onChange={e => setMinCounts(Number(e.target.value))}
              className="w-full"
            />

            <label className="text-xs text-gray-600">Min distance (bp): {minDistance}</label>
            <input
              type="range"
              min={0}
              max={20000}
              step={500}
              value={minDistance}
              onChange={e => setMinDistance(Number(e.target.value))}
              className="w-full"
            />

            <label className="text-xs text-gray-600">Y cap (odds ratio): {yCap}</label>
            <input
              type="range"
              min={100}
              max={5000}
              step={100}
              value={yCap}
              onChange={e => setYCap(Number(e.target.value))}
              className="w-full"
            />

            <label className="text-xs text-gray-600">Label threshold: {labelThreshold}</label>
            <input
              type="range"
              min={0}
              max={500}
              step={5}
              value={labelThreshold}
              onChange={e => setLabelThreshold(Number(e.target.value))}
              className="w-full"
            />

            <div className="text-xs text-gray-700">
              Exclude types:
              <div className="mt-1 flex flex-wrap gap-1">
                {["rRNA", "tRNA", "hkRNA"].map(ft => {
                  const active = excludeTypes.includes(ft as FeatureType);
                  return (
                    <button
                      key={ft}
                      type="button"
                      className={`px-2 py-1 rounded border ${active ? "bg-gray-200" : "bg-white"}`}
                      onClick={() =>
                        setExcludeTypes(prev =>
                          prev.includes(ft as FeatureType)
                            ? prev.filter(x => x !== ft)
                            : [...prev, ft as FeatureType]
                        )
                      }
                    >
                      {ft}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="border rounded-2xl p-4 shadow-sm space-y-2">
            <div className="font-semibold">Data</div>
            <div className="flex gap-2 flex-wrap">
              <button className="border rounded px-3 py-1" onClick={() => setData(simulateData(500))}>
                Simulate
              </button>
              <button className="border rounded px-3 py-1" onClick={downloadSVG}>
                Export SVG
              </button>
            </div>
            <div className="text-xs text-gray-600">Pairs table CSV</div>
            <input ref={filePairsRef} type="file" accept=".csv" onChange={onPairsFile} />
            <div className="text-xs text-gray-500">{loadedPairsName || "(using simulated pairs)"}</div>
            <div className="text-xs text-gray-600 pt-2">Annotations CSV</div>
            <input ref={fileAnnoRef} type="file" accept=".csv" onChange={onAnnoFile} />
            <div className="text-xs text-gray-500">{loadedAnnoName || "(using simulated annotations)"}</div>
            <p className="text-[11px] text-gray-500 mt-2">
              Headers — Pairs: ref,target,counts,odds_ratio,… | Annotations: gene_name,start,end,feature_type,strand,chromosome
            </p>
          </section>
        </div>

        {/* Scatter + legend + full partner table */}
        <div className="col-span-12 lg:col-span-9 space-y-4">
          <section className="border rounded-2xl p-4 shadow-sm">
            <ScatterPlot
              focal={focal}
              focalAnn={geneIndex[focal]}
              partners={partners}
              genomeMax={genomeMax}
              yCap={yCap}
              yTicks={yTicks}
              labelThreshold={labelThreshold}
              highlightSet={highlightSet}
              onClickPartner={(name) => setFocal(name)}
            />

            {/* Legend below the plot (no obstruction) */}
            <div className="mt-3 flex flex-wrap gap-4 items-center">
              <span className="text-sm font-medium">Feature types</span>
              {["CDS","5'UTR","3'UTR","ncRNA","sRNA","tRNA","rRNA","sponge","hkRNA"].map(k => (
                <span key={k} className="inline-flex items-center gap-2 text-xs">
                  <span
                    className="inline-block w-3 h-3 rounded-full border"
                    style={{ background: "#fff", borderColor: pickColor(k as FeatureType), boxShadow: `inset 0 0 0 2px ${pickColor(k as FeatureType)}` }}
                  />
                  {k}
                </span>
              ))}
              <span className="ml-6 text-xs text-gray-500">Circle size = counts</span>
            </div>
          </section>

          <section className="border rounded-2xl p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <div className="font-semibold">
                Partners for <span className="text-blue-600">{focal}</span>{" "}
                <span className="text-xs text-gray-500">({partners.length} shown)</span>
              </div>
              <div className="text-xs text-gray-500">sorted by odds_ratio</div>
            </div>
            <div className="overflow-auto max-h-[500px]">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-white text-left text-gray-600">
                  <tr>
                    <th className="py-1 pr-4">Partner</th>
                    <th className="py-1 pr-4">Feature</th>
                    <th className="py-1 pr-4">Start</th>
                    <th className="py-1 pr-4">Counts</th>
                    <th className="py-1 pr-4">Odds ratio</th>
                    <th className="py-1 pr-4">Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map(row => (
                    <tr
                      key={row.partner}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setFocal(row.partner)}
                    >
                      <td className="py-1 pr-4 text-blue-700">{row.partner}</td>
                      <td className="py-1 pr-4">
                        <span
                          className="inline-block w-3 h-3 rounded-full mr-1"
                          style={{ background: pickColor(row.type), border: "1px solid #333" }}
                        />
                        {row.type}
                      </td>
                      <td className="py-1 pr-4">{row.x}</td>
                      <td className="py-1 pr-4">{row.counts}</td>
                      <td className="py-1 pr-4">{row.rawY.toFixed(1)}</td>
                      <td className="py-1 pr-4">{row.distance}</td>
                    </tr>
                  ))}
                  {partners.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-2 text-gray-500">
                        No partners after filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function ScatterPlot({
  focal,
  focalAnn,
  partners,
  genomeMax,
  yCap,
  yTicks,
  labelThreshold,
  highlightSet,
  onClickPartner,
}: {
  focal: string;
  focalAnn?: Annotation;
  partners: ScatterRow[];
  genomeMax: number;
  yCap: number;
  yTicks: number[];
  labelThreshold: number;
  highlightSet: Set<string>;
  onClickPartner: (gene: string) => void;
}) {
  const width = 900;
  const height = 520;
  const margin = { top: 12, right: 20, bottom: 42, left: 60 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const xScale = (x: number) => (x / (genomeMax * 1.05)) * innerW;
  const yScale = (v: number) => {
    const t = symlog(v, 10, 10);
    const tMax = symlog(yCap, 10, 10);
    return innerH - (t / tMax) * innerH;
  };
  const sizeScale = (c: number) => Math.sqrt(c) * 2 + 4;

  const sorted = [...partners].sort((a, b) => b.rawY - a.rawY);
  const placed: { x: number; y: number }[] = [];
  const labels = sorted
    .filter(p => p.rawY >= labelThreshold)
    .filter(p => {
      const px = xScale(p.x);
      const py = yScale(p.y);
      const tooClose = placed.some(q => Math.abs(q.x - px) < 12 && Math.abs(q.y - py) < 12);
      if (!tooClose) placed.push({ x: px, y: py });
      return !tooClose;
    })
    .slice(0, 80);

  return (
    <div className="w-full overflow-x-auto">
      <svg id="scatter-svg" width={width} height={height} className="mx-auto block">
        <defs>
          <style>{`text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#1f2937;font-size:10px}.axis-label{font-size:11px}`}</style>
        </defs>
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* X-axis */}
          <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#222" />
          {Array.from({ length: 6 }).map((_, i) => {
            const x = (i / 5) * genomeMax;
            return (
              <g key={i} transform={`translate(${xScale(x)},${innerH})`}>
                <line y2={6} stroke="#222" />
                <text y={20} textAnchor="middle">{Math.round(x / 1e6)} Mb</text>
              </g>
            );
          })}
          {/* Y-axis */}
          <line x1={0} y1={0} x2={0} y2={innerH} stroke="#222" />
          {yTicks.map((t, i) => (
            <g key={i} transform={`translate(0,${yScale(t)})`}>
              <line x2={-6} stroke="#222" />
              <text x={-9} y={3} textAnchor="end">{t}</text>
              <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eee" />
            </g>
          ))}
          <text transform={`translate(${-44},${innerH/2}) rotate(-90)`} className="axis-label">
            Odds ratio
          </text>

          {/* focal marker */}
          {focalAnn && (
            <g>
              <line x1={xScale(focalAnn.start)} y1={0} x2={xScale(focalAnn.start)} y2={innerH} stroke="#444" strokeDasharray="3 3" />
              <polygon points={`${xScale(focalAnn.start)-6},${innerH+10} ${xScale(focalAnn.start)+6},${innerH+10} ${xScale(focalAnn.start)},${innerH+2}`} fill="#000" />
              <text x={xScale(focalAnn.start)} y={-2} textAnchor="middle">{focal}</text>
            </g>
          )}

          {/* points */}
          {partners.sort((a,b) => b.counts - a.counts).map((p, idx) => {
            const highlighted = highlightSet.has(p.partner);
            const face = highlighted ? "#FFEB3B" : "#FFFFFF"; // yellow vs white
            return (
              <g key={idx} transform={`translate(${xScale(p.x)},${yScale(p.y)})`}>
                <circle
                  r={sizeScale(p.counts)}
                  fill={face}
                  stroke={pickColor(p.type)}
                  strokeWidth={2}
                  className="cursor-pointer hover:opacity-80"
                  onClick={() => onClickPartner(p.partner)}
                />
                <line x1={0} y1={0} x2={0} y2={Math.max(0, innerH - yScale(p.y))} stroke="#999" strokeDasharray="2 3" opacity={0.12} />
              </g>
            );
          })}

          {/* labels */}
          {labels.map((p, i) => (
            <g key={i} transform={`translate(${xScale(p.x)},${yScale(p.y)})`}>
              <text x={6} y={-6}>{p.partner}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
