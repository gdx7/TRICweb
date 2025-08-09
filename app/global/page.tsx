// app/global/page.tsx
"use client";
import React, { useMemo, useRef, useState } from "react";
import { Annotation, Pair, FEATURE_COLORS, pickColor, symlog, parsePairsCSV, parseAnnoCSV, geneIndex, distanceBetween, FeatureType } from "@/lib/shared";

type ScatterRow = {
  partner: string;
  x: number;
  y: number;
  rawY: number;
  counts: number;
  type: FeatureType;
  distance: number;
};

function simulateData(nGenes = 500) {
  const rng = ((seed: number) => () => (seed = (seed * 1664525 + 1013904223) % 0xffffffff) / 0xffffffff)(42);
  const ann: Annotation[] = [];
  const classes: FeatureType[] = ["CDS","5'UTR","3'UTR","ncRNA","tRNA","sRNA"];
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

  const pairs: Pair[] = [];
  const genes = ann.map(a => a.gene_name);
  function addEdge(a: string, b: string, bias = 1) {
    const c = Math.max(1, Math.floor((rng() ** 2) * 120 * bias));
    const or = 0.5 + Math.pow(rng(), 0.4) * 400 * bias;
    const aAnn = ann.find(x => x.gene_name === a);
    const bAnn = ann.find(x => x.gene_name === b);
    pairs.push({
      ref: a, target: b, counts: c, odds_ratio: or, adjusted_score: or,
      ref_type: aAnn?.feature_type, target_type: bAnn?.feature_type,
      start_ref: aAnn?.start, end_ref: aAnn?.end, start_target: bAnn?.start, end_target: bAnn?.end
    });
  }
  for (let k = 0; k < nGenes * 2; k++) {
    const a = genes[Math.floor(rng() * genes.length)];
    const b = genes[Math.floor(rng() * genes.length)];
    if (a === b) continue;
    addEdge(a, b, 1);
  }
  Array.from({length: 60}).forEach(() => addEdge("GcvB", genes[Math.floor(rng() * genes.length)], 4));
  return { annotations: ann, pairs };
}

export default function GlobalPage() {
  const [data, setData] = useState(() => simulateData(500));
  const [focal, setFocal] = useState<string>("GcvB");
  const [query, setQuery] = useState("");
  const [minCounts, setMinCounts] = useState(5);
  const [minDistance, setMinDistance] = useState(5000);
  const [yCap, setYCap] = useState(5000);
  const [labelThreshold, setLabelThreshold] = useState(50);
  const [excludeTypes, setExcludeTypes] = useState<FeatureType[]>(["rRNA","tRNA"]);
  const [highlightList, setHighlightList] = useState<string>(""); // comma-separated
  const [sortKey, setSortKey] = useState<"odds"|"counts"|"pos">("odds");
  const [sortDir, setSortDir] = useState<"desc"|"asc">("desc");

  const filePairsRef = useRef<HTMLInputElement>(null);
  const fileAnnoRef = useRef<HTMLInputElement>(null);
  const [loadedPairsName, setLoadedPairsName] = useState<string | null>(null);
  const [loadedAnnoName, setLoadedAnnoName] = useState<string | null>(null);

  const annotations = data.annotations;
  const pairs = data.pairs;
  const idx = useMemo(() => geneIndex(annotations), [annotations]);
  const allGenes = useMemo(() => annotations.map(a => a.gene_name).sort(), [annotations]);
  const focalAnn = idx[focal];
  const genomeMax = useMemo(() => Math.max(...annotations.map(a => a.end)), [annotations]);

  const highlightSet = useMemo(() => new Set(highlightList.split(",").map(s => s.trim()).filter(Boolean)), [highlightList]);

  const partners = useMemo<ScatterRow[]>(() => {
    const edges = (pairs || []).filter(p => (p.ref === focal || p.target === focal));
    const rows = edges.map(e => {
      const partner = e.ref === focal ? e.target : e.ref;
      const pAnn = idx[partner];
      if (!pAnn || !focalAnn) return null;
      const dist = distanceBetween(pAnn, focalAnn);
      const counts = Number(e.counts || 0);
      const weight = Number(e.odds_ratio || 0);
      const type = (e.ref === focal ? e.target_type : e.ref_type) || pAnn.feature_type || "CDS";
      return {
        partner,
        x: pAnn.start,
        y: Math.min(weight, yCap),
        rawY: weight,
        counts,
        type: type as FeatureType,
        distance: dist,
      };
    }).filter(Boolean) as ScatterRow[];

    return rows
      .filter(r => r.counts >= minCounts)
      .filter(r => r.distance >= minDistance)
      .filter(r => !excludeTypes.includes(r.type));
  }, [pairs, focal, idx, focalAnn, minCounts, minDistance, excludeTypes, yCap]);

  const yTicks = useMemo(() => [0,5,10,25,50,100,250,500,1000,2500,5000].filter(v => v <= yCap), [yCap]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query) return;
    const match = allGenes.find(g => g.toLowerCase() === query.toLowerCase())
      || allGenes.find(g => g.toLowerCase().includes(query.toLowerCase()));
    if (match) setFocal(match);
  }

  function exportSVG() {
    const node = document.getElementById("scatter-svg") as SVGSVGElement | null;
    if (!node) return;
    const svg = node.cloneNode(true) as SVGSVGElement;
    const style = document.createElementNS("http://www.w3.org/2000/svg","style");
    style.textContent = `text, tspan { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"; font-size: 10px; }`;
    svg.insertBefore(style, svg.firstChild);
    const s = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([s], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `${focal}_interactome.svg` });
    a.click(); URL.revokeObjectURL(url);
  }

  async function onPairsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    setData(prev => ({ ...prev, pairs: parsePairsCSV(text) })); setLoadedPairsName(file.name);
  }
  async function onAnnoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    const parsed = parseAnnoCSV(text);
    setData(prev => ({ ...prev, annotations: parsed })); setLoadedAnnoName(file.name);
    if (parsed.length > 0) setFocal(parsed[0].gene_name);
  }

  const sortedPartners = useMemo(() => {
    const arr = [...partners];
    arr.sort((a,b) => {
      const cmp = sortKey === "odds" ? b.rawY - a.rawY : sortKey === "counts" ? b.counts - a.counts : a.x - b.x;
      return sortDir === "desc" ? cmp : -cmp;
    });
    return arr;
  }, [partners, sortKey, sortDir]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/90 border-b">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-xl font-semibold">Global Interaction Map</div>
          <a href="/" className="text-sm text-blue-600 hover:underline">Home</a>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 grid grid-cols-12 gap-4">
        {/* Controls */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <section className="border rounded-2xl p-4 shadow-sm">
            <div className="font-semibold mb-2">Search</div>
            <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-2">
              <input className="border rounded px-2 py-1 w-full" placeholder="Enter RNA (e.g., GcvB)" value={query} onChange={e => setQuery(e.target.value)} />
              <button className="border rounded px-3">Go</button>
            </form>
            <select className="border rounded px-2 py-1 w-full" value={focal} onChange={e => setFocal(e.target.value)}>
              {allGenes.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </section>

          <section className="border rounded-2xl p-4 shadow-sm space-y-3">
            <div className="font-semibold">Filters</div>

            <label className="text-xs text-gray-600">Min counts: {minCounts}</label>
            <input type="range" min={0} max={50} step={1} value={minCounts} onChange={e => setMinCounts(Number(e.target.value))} className="w-full" />

            <label className="text-xs text-gray-600">Min distance (bp): {minDistance}</label>
            <input type="range" min={0} max={20000} step={500} value={minDistance} onChange={e => setMinDistance(Number(e.target.value))} className="w-full" />

            <label className="text-xs text-gray-600">Y cap (odds ratio): {yCap}</label>
            <input type="range" min={100} max={5000} step={100} value={yCap} onChange={e => setYCap(Number(e.target.value))} className="w-full" />

            <label className="text-xs text-gray-600">Label threshold: {labelThreshold}</label>
            <input type="range" min={0} max={500} step={5} value={labelThreshold} onChange={e => setLabelThreshold(Number(e.target.value))} className="w-full" />

            <div className="text-xs text-gray-700">
              Exclude types:
              <div className="mt-1 flex flex-wrap gap-1">
                {["rRNA","tRNA","hkRNA"].map(ft => {
                  const active = excludeTypes.includes(ft as FeatureType);
                  return (
                    <button key={ft} type="button"
                      className={`px-2 py-1 rounded border ${active ? "bg-gray-200" : "bg-white"}`}
                      onClick={() => setExcludeTypes(prev => prev.includes(ft as FeatureType) ? prev.filter(x => x !== ft) : [...prev, ft as FeatureType])}>
                      {ft}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="text-xs text-gray-700">
              Highlight (yellow fill):<br/>
              <input className="border rounded px-2 py-1 w-full mt-1" placeholder="gene1,gene2,..." value={highlightList} onChange={e => setHighlightList(e.target.value)} />
            </div>
          </section>

          <section className="border rounded-2xl p-4 shadow-sm space-y-2">
            <div className="font-semibold">Data</div>
            <div className="flex gap-2 flex-wrap">
              <button className="border rounded px-3 py-1" onClick={() => setData(simulateData(500))}>Simulate</button>
              <button className="border rounded px-3 py-1" onClick={exportSVG}>Export SVG</button>
            </div>
            <div className="text-xs text-gray-600">Pairs CSV</div>
            <input ref={filePairsRef} type="file" accept=".csv" onChange={onPairsFile} />
            <div className="text-xs text-gray-500">{loadedPairsName || "(using simulated pairs)"}</div>
            <div className="text-xs text-gray-600 pt-2">Annotations CSV</div>
            <input ref={fileAnnoRef} type="file" accept=".csv" onChange={onAnnoFile} />
            <div className="text-xs text-gray-500">{loadedAnnoName || "(using simulated annotations)"}</div>
            <p className="text-[11px] text-gray-500 mt-2">
              Pairs header: ref,target,counts,…,odds_ratio,… | Annotations: gene_name,start,end,feature_type,strand,chromosome
            </p>
          </section>
        </div>

        {/* Scatter + table */}
        <div className="col-span-12 lg:col-span-9 space-y-4">
          <section className="border rounded-2xl p-4 shadow-sm">
            <ScatterPlot
              focal={focal}
              focalAnn={focalAnn}
              partners={partners}
              genomeMax={genomeMax}
              yCap={yCap}
              yTicks={yTicks}
              labelThreshold={labelThreshold}
              highlightSet={highlightSet}
              onClickPartner={(name) => setFocal(name)}
            />
          </section>

          <section className="border rounded-2xl p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <div className="font-semibold">Partners for <span className="text-blue-600">{focal}</span> (counts ≥ {minCounts})</div>
              <div className="text-xs text-gray-600">
                Sort:
                <button className="ml-2 px-2 py-0.5 border rounded" onClick={() => setSortKey("odds")}>odds</button>
                <button className="ml-1 px-2 py-0.5 border rounded" onClick={() => setSortKey("counts")}>counts</button>
                <button className="ml-1 px-2 py-0.5 border rounded" onClick={() => setSortKey("pos")}>position</button>
                <button className="ml-2 px-2 py-0.5 border rounded" onClick={() => setSortDir(d => d==="desc"?"asc":"desc")}>{sortDir}</button>
              </div>
            </div>
            <div className="overflow-auto max-h-[480px]">
              <table className="min-w-full text-sm">
                <thead className="text-left text-gray-600 sticky top-0 bg-white">
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
                  {sortedPartners.map(row => (
                    <tr key={row.partner} className="hover:bg-gray-50 cursor-pointer" onClick={() => setFocal(row.partner)}>
                      <td className="py-1 pr-4 text-blue-700">{row.partner}</td>
                      <td className="py-1 pr-4">
                        <span className="inline-block w-3 h-3 rounded-full mr-1" style={{ background: pickColor(row.type), border: "1px solid #333" }} />
                        {row.type}
                      </td>
                      <td className="py-1 pr-4">{row.x}</td>
                      <td className="py-1 pr-4">{row.counts}</td>
                      <td className="py-1 pr-4">{row.rawY.toFixed(1)}</td>
                      <td className="py-1 pr-4">{row.distance}</td>
                    </tr>
                  ))}
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
  focal, focalAnn, partners, genomeMax, yCap, yTicks, labelThreshold, highlightSet, onClickPartner
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
  const width = 900, height = 520;
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

  const sorted = [...partners].sort((a,b) => b.rawY - a.rawY);
  const placed: {x:number;y:number}[] = [];
  const labels = sorted
    .filter(p => p.rawY >= labelThreshold)
    .filter(p => {
      const px = xScale(p.x), py = yScale(p.y);
      const tooClose = placed.some(q => Math.abs(q.x - px) < 12 && Math.abs(q.y - py) < 12);
      if (!tooClose) placed.push({x:px,y:py});
      return !tooClose;
    })
    .slice(0, 80);

  return (
    <div className="w-full overflow-x-auto">
      <svg id="scatter-svg" width={width} height={height} className="mx-auto block">
        <g transform={`translate(${margin.left},${margin.top})`}>
          <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#222" />
          {Array.from({ length: 6 }).map((_, i) => {
            const x = (i / 5) * genomeMax;
            return (
              <g key={i} transform={`translate(${xScale(x)},${innerH})`}>
                <line y2={6} stroke="#222" />
                <text y={20} textAnchor="middle" className="fill-gray-700 text-[10px]">{Math.round(x / 1e6)} Mb</text>
              </g>
            );
          })}
          <line x1={0} y1={0} x2={0} y2={innerH} stroke="#222" />
          {yTicks.map((t, i) => (
            <g key={i} transform={`translate(0,${yScale(t)})`}>
              <line x2={-6} stroke="#222" />
              <text x={-9} y={3} textAnchor="end" className="fill-gray-700 text-[10px]">{t}</text>
              <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eee" />
            </g>
          ))}
          <text transform={`translate(${-44},${innerH/2}) rotate(-90)`} className="fill-gray-700 text-[11px]">Odds ratio (symlog)</text>

          {focalAnn && (
            <g>
              <line x1={xScale(focalAnn.start)} y1={0} x2={xScale(focalAnn.start)} y2={innerH} stroke="#444" strokeDasharray="3 3" />
              <polygon points={`${xScale(focalAnn.start)-6},${innerH+10} ${xScale(focalAnn.start)+6},${innerH+10} ${xScale(focalAnn.start)},${innerH+2}`} fill="#000" />
              <text x={xScale(focalAnn.start)} y={-2} textAnchor="middle" className="text-[11px] fill-gray-800">{focal}</text>
            </g>
          )}

          {partners.sort((a,b) => b.counts - a.counts).map((p, idx) => (
            <g key={idx} transform={`translate(${xScale(p.x)},${yScale(p.y)})`}>
              <circle
                r={sizeScale(p.counts)}
                fill={highlightSet.has(p.partner) ? "yellow" : "#fff"}
                stroke={pickColor(p.type)}
                strokeWidth={2}
                className="cursor-pointer hover:opacity-80"
                onClick={() => onClickPartner(p.partner)}
              />
              <line x1={0} y1={0} x2={0} y2={Math.max(0, innerH - yScale(p.y))} stroke="#999" strokeDasharray="2 3" opacity={0.1} />
            </g>
          ))}

          {labels.map((p, i) => (
            <g key={i} transform={`translate(${xScale(p.x)},${yScale(p.y)})`}>
              <text x={6} y={-6} className="text-[10px] fill-gray-800 rotate-12">{p.partner}</text>
            </g>
          ))}
        </g>

        {/* Legend (right) */}
        <g transform={`translate(${width-170},${20})`}>
          <text className="text-[11px] fill-gray-800">Feature type</text>
          {Object.entries(FEATURE_COLORS).map(([k, color], i) => (
            <g key={k} transform={`translate(0,${14 + i*14})`}>
              <circle r={5} cx={6} cy={6} fill="#fff" stroke={color} strokeWidth={2} />
              <text x={18} y={10} className="text-[10px] fill-gray-700">{k}</text>
            </g>
          ))}
          <g transform={`translate(0,${14 + (Object.keys(FEATURE_COLORS).length)*14})`}>
            <text className="text-[11px] fill-gray-800">Circle size = counts</text>
          </g>
        </g>
      </svg>
    </div>
  );
}
