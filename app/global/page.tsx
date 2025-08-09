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

/** simple symlog display transform */
function symlog(y: number, linthresh = 10, base = Math.E) {
  const s = Math.sign(y);
  const a = Math.abs(y);
  return a <= linthresh ? s * (a / linthresh) : s * (1 + Math.log(a / linthresh) / Math.log(base));
}

type ScatterRow = {
  partner: string;
  x: number;          // partner start coord
  y: number;          // capped/transformed
  rawY: number;       // odds ratio (uncapped)
  counts: number;
  type?: string;
  distance: number;
  highlight: boolean; // face fill yellow when true
};

export default function GlobalMapPage() {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [focal, setFocal] = useState("GcvB");
  const [query, setQuery] = useState("");
  const [minCounts, setMinCounts] = useState(5);
  const [minDistance, setMinDistance] = useState(5000);
  const [yCap, setYCap] = useState(5000);
  const [labelThreshold, setLabelThreshold] = useState(50);
  const [excludeTypes, setExcludeTypes] = useState<string[]>(["rRNA", "tRNA", "hkRNA"]);
  const [highlightList, setHighlightList] = useState("gene1,gene2,gene3");

  // table sorting
  const [sortKey, setSortKey] = useState<"partner"|"feature"|"start"|"counts"|"odds"|"distance">("odds");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");

  const filePairsRef = useRef<HTMLInputElement>(null);
  const fileAnnoRef = useRef<HTMLInputElement>(null);

  const idx = useMemo(() => buildIndex(annotations), [annotations]);
  const allGenes = useMemo(() => annotations.map(a => a.gene_name).sort(), [annotations]);
  const genomeMax = useMemo(
    () => (annotations.length ? Math.max(...annotations.map(a => a.end)) : 4_700_000),
    [annotations]
  );

  // csv loaders
  async function onPairsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const txt = await f.text();
    setPairs(parsePairsCSV(txt));
  }
  async function onAnnoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const txt = await f.text();
    const ann = parseAnnoCSV(txt);
    setAnnotations(ann);
    if (ann.length && !idx[focal]) setFocal(ann[0].gene_name);
  }

  // search
  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query) return;
    const lower = query.toLowerCase();
    const exact = allGenes.find(g => g.toLowerCase() === lower);
    const part  = allGenes.find(g => g.toLowerCase().includes(lower));
    if (exact) setFocal(exact);
    else if (part) setFocal(part);
  }

  const highlights = useMemo(
    () => new Set(highlightList.split(",").map(s => s.trim()).filter(Boolean)),
    [highlightList]
  );

  // partners for focal
  const partners = useMemo<ScatterRow[]>(() => {
    const fAnn = idx[focal];
    if (!fAnn) return [];
    const edges = pairs.filter(p => p.ref === focal || p.target === focal);
    const rows = edges.map(e => {
      const partner = e.ref === focal ? e.target : e.ref;
      const pAnn = idx[partner];
      if (!pAnn) return null;
      const counts = e.counts ?? 0;
      const odds = Number(e.odds_ratio ?? e.adjusted_score ?? 0);
      const type = e.ref === focal ? e.target_type : e.ref_type;
      const dist = distanceBetween(fAnn, pAnn);
      return {
        partner,
        x: pAnn.start,
        y: Math.min(odds, yCap),
        rawY: odds,
        counts,
        type: type ?? pAnn.feature_type ?? "CDS",
        distance: dist,
        highlight: highlights.has(partner),
      } as ScatterRow;
    }).filter(Boolean) as ScatterRow[];

    return rows
      .filter(r => r.counts >= minCounts)
      .filter(r => r.distance >= minDistance)
      .filter(r => !excludeTypes.includes(String(r.type)));
  }, [pairs, focal, idx, yCap, minCounts, minDistance, excludeTypes, highlights]);

  // table sorted rows (show ALL above threshold, not just top-10)
  const tableRows = useMemo(() => {
    const copy = [...partners];
    copy.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "partner":  return dir * a.partner.localeCompare(b.partner);
        case "feature":  return dir * String(a.type).localeCompare(String(b.type));
        case "start":    return dir * (a.x - b.x);
        case "counts":   return dir * (a.counts - b.counts);
        case "distance": return dir * (a.distance - b.distance);
        case "odds":
        default:         return dir * (a.rawY - b.rawY);
      }
    });
    return copy;
  }, [partners, sortKey, sortDir]);

  function toggleSort(key: typeof sortKey) {
    if (key === sortKey) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "partner" ? "asc" : "desc"); }
  }

  function downloadSVG() {
    const node = document.getElementById("global-svg") as SVGSVGElement | null;
    if (!node) return;
    // embed a minimal font spec for consistency
    const style = document.createElementNS("http://www.w3.org/2000/svg","style");
    style.innerHTML = `text{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;font-size:10px;}`;
    node.insertBefore(style, node.firstChild);

    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(node);
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${focal}_interactome.svg`; a.click();
    URL.revokeObjectURL(url);
    style.remove();
  }

  // plot scales
  const width = 900;
  const height = 520;
  const margin = { top: 12, right: 170, bottom: 42, left: 60 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const xScale = (x: number) => (x / (genomeMax * 1.05)) * innerW;
  const yScale = (v: number) => {
    const t = symlog(v, 10, 10);
    const tMax = symlog(yCap, 10, 10);
    return innerH - (t / tMax) * innerH;
  };
  const yTicks = [0, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000].filter(v => v <= yCap);
  const sizeScale = (c: number) => Math.sqrt(Math.max(1, c)) * 2 + 4;

  // label placement: keep distance
  const labels = useMemo(() => {
    const sorted = [...partners].sort((a, b) => b.rawY - a.rawY);
    const placed: { x: number; y: number }[] = [];
    return sorted
      .filter(p => p.rawY >= labelThreshold)
      .filter(p => {
        const px = xScale(p.x);
        const py = yScale(p.y);
        const ok = !placed.some(q => Math.abs(q.x - px) < 12 && Math.abs(q.y - py) < 12);
        if (ok) placed.push({ x: px, y: py });
        return ok;
      })
      .slice(0, 80);
  }, [partners, labelThreshold]);

  const focalAnn = idx[focal];

  return (
    <div className="mx-auto max-w-7xl p-4 space-y-4">
      <header className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Global interaction map</h1>
          <p className="text-xs text-gray-600">
            Upload Pairs + Annotations. Enter focal RNA to see its genome-wide partners.
            Stroke color = feature type; circle size = counts; Y = odds ratio (symlog-like, capped).
          </p>
        </div>
        <div className="flex gap-2">
          <button className="border rounded px-3 py-1" onClick={downloadSVG}>Export SVG</button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* Controls */}
        <section className="col-span-12 lg:col-span-3 border rounded-2xl p-4 space-y-3">
          <div className="font-medium">Search</div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              className="border rounded px-2 py-1 w-full"
              placeholder="Enter RNA (e.g., GcvB)"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <button className="border rounded px-3 py-1">Go</button>
          </form>

          <div className="font-medium pt-2">Filters</div>
          <label className="text-xs text-gray-600">Min counts: {minCounts}</label>
          <input type="range" min={0} max={50} step={1} value={minCounts} onChange={e => setMinCounts(+e.target.value)} className="w-full" />

          <label className="text-xs text-gray-600">Min distance (bp): {minDistance}</label>
          <input type="range" min={0} max={20000} step={500} value={minDistance} onChange={e => setMinDistance(+e.target.value)} className="w-full" />

          <label className="text-xs text-gray-600">Y cap (odds ratio): {yCap}</label>
          <input type="range" min={100} max={5000} step={100} value={yCap} onChange={e => setYCap(+e.target.value)} className="w-full" />

          <label className="text-xs text-gray-600">Label threshold: {labelThreshold}</label>
          <input type="range" min={0} max={500} step={5} value={labelThreshold} onChange={e => setLabelThreshold(+e.target.value)} className="w-full" />

          <div className="text-xs text-gray-700">Exclude types:</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {["rRNA", "tRNA", "hkRNA"].map(ft => {
              const active = excludeTypes.includes(ft);
              return (
                <button
                  key={ft}
                  type="button"
                  className={`px-2 py-1 rounded border ${active ? "bg-gray-200" : "bg-white"}`}
                  onClick={() =>
                    setExcludeTypes(prev => prev.includes(ft) ? prev.filter(x => x !== ft) : [...prev, ft])
                  }
                >
                  {ft}
                </button>
              );
            })}
          </div>

          <div className="pt-2">
            <div className="text-xs text-gray-700 mb-1">Highlight genes (yellow fill)</div>
            <textarea
              className="w-full border rounded p-2 text-sm"
              rows={2}
              value={highlightList}
              onChange={e => setHighlightList(e.target.value)}
              placeholder="gene1,gene2, gene3"
            />
          </div>

          <div className="font-medium pt-2">Data</div>
          <div className="text-xs text-gray-600">Pairs CSV</div>
          <input ref={filePairsRef} type="file" accept=".csv" onChange={onPairsFile} />
          <div className="text-xs text-gray-600 pt-2">Annotations CSV</div>
          <input ref={fileAnnoRef} type="file" accept=".csv" onChange={onAnnoFile} />
        </section>

        {/* Plot + table */}
        <section className="col-span-12 lg:col-span-9 space-y-4">
          <div className="border rounded-2xl p-4">
            <div className="w-full overflow-x-auto">
              <svg id="global-svg" width={width} height={height} className="mx-auto block">
                <g transform={`translate(${margin.left},${margin.top})`}>
                  {/* axes */}
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

                  {/* focal marker */}
                  {focalAnn && (
                    <g>
                      <line x1={xScale(focalAnn.start)} y1={0} x2={xScale(focalAnn.start)} y2={innerH} stroke="#444" strokeDasharray="3 3" />
                      <polygon points={`${xScale(focalAnn.start)-6},${innerH+10} ${xScale(focalAnn.start)+6},${innerH+10} ${xScale(focalAnn.start)},${innerH+2}`} fill="#000" />
                      <text x={xScale(focalAnn.start)} y={-2} textAnchor="middle" className="text-[11px] fill-gray-800">{focal}</text>
                    </g>
                  )}

                  {/* dots + stems */}
                  {[...partners].sort((a,b)=>b.counts-a.counts).map((p, i) => {
                    const stroke = pickColor(p.type as any);
                    const fill = p.highlight ? "#FDE047" /* yellow-300 */ : "#fff";
                    return (
                      <g key={`${p.partner}:${i}`} transform={`translate(${xScale(p.x)},${yScale(p.y)})`} className="cursor-pointer" onClick={() => setFocal(p.partner)}>
                        <circle r={sizeScale(p.counts)} fill={fill} stroke={stroke} strokeWidth={2} />
                        <line x1={0} y1={0} x2={0} y2={Math.max(0, innerH - yScale(p.y))} stroke="#999" strokeDasharray="2 3" opacity={0.12} />
                      </g>
                    );
                  })}

                  {/* labels */}
                  {labels.map((p, i) => (
                    <g key={i} transform={`translate(${xScale(p.x)},${yScale(p.y)})`}>
                      <text x={6} y={-6} className="text-[10px] fill-gray-800 rotate-12">{p.partner}</text>
                    </g>
                  ))}
                </g>

                {/* legend on the right, off the plot area */}
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
          </div>

          {/* partner table */}
          <div className="border rounded-2xl p-4">
            <div className="flex justify-between items-center mb-2">
              <div className="font-semibold">Partners for <span className="text-blue-600">{focal}</span></div>
              <div className="text-xs text-gray-500">showing all with counts ≥ {minCounts} and distance ≥ {minDistance}</div>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-gray-600">
                  <tr>
                    {[
                      ["partner","Partner"],
                      ["feature","Feature"],
                      ["start","Start"],
                      ["counts","Counts"],
                      ["odds","Odds ratio"],
                      ["distance","Distance (bp)"],
                    ].map(([key,label]) => (
                      <th key={key} className="py-1 pr-4 cursor-pointer select-none" onClick={() => toggleSort(key as any)}>
                        {label}{sortKey===key ? (sortDir==="asc" ? " ▲" : " ▼") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r) => (
                    <tr key={r.partner} className="hover:bg-gray-50 cursor-pointer" onClick={() => setFocal(r.partner)}>
                      <td className="py-1 pr-4 text-blue-700">{r.partner}</td>
                      <td className="py-1 pr-4">
                        <span className="inline-block w-3 h-3 rounded-full mr-1" style={{ background: pickColor(r.type as any), border: "1px solid #333" }} />
                        {String(r.type)}
                      </td>
                      <td className="py-1 pr-4">{r.x}</td>
                      <td className="py-1 pr-4">{r.counts}</td>
                      <td className="py-1 pr-4">{r.rawY.toFixed(2)}</td>
                      <td className="py-1 pr-4">{r.distance}</td>
                    </tr>
                  ))}
                  {tableRows.length === 0 && (
                    <tr><td colSpan={6} className="py-4 text-center text-xs text-gray-500">No partners passing filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </section>
      </div>
    </div>
  );
}
