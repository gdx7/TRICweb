// app/csmap/page.tsx
"use client";
import React, { useMemo, useRef, useState } from "react";
import { Annotation, Pair, FEATURE_COLORS, pickColor, parseAnnoCSV, parsePairsCSV, geneIndex, distanceBetween } from "@/lib/shared";

type PeakRow = {
  gene: string;        // input gene (column)
  partner: string;     // target partner
  odds: number;        // odds_ratio (capped)
  rawOdds: number;     // original odds_ratio
  counts: number;      // counts
  xCol: number;        // gene column index (0..N-1)
  color: string;       // stroke color by target feature
};

function mixColor(hex: string, t: number) {
  const to = (s: string) => parseInt(s, 16);
  const r = (to(hex.slice(1,3)) * t + 255 * (1-t))|0;
  const g = (to(hex.slice(3,5)) * t + 255 * (1-t))|0;
  const b = (to(hex.slice(5,7)) * t + 255 * (1-t))|0;
  return `rgb(${r},${g},${b})`;
}

export default function CsMapPage() {
  const [pairs, setPairs] = useState<Pair[] | null>(null);
  const [anno, setAnno] = useState<Annotation[] | null>(null);
  const [geneList, setGeneList] = useState<string>("");
  const [minCounts, setMinCounts] = useState(5);
  const [minDistance, setMinDistance] = useState(5000);
  const [yCap, setYCap] = useState(5000);
  const [spacing, setSpacing] = useState(1000); // minimal spacing between local peaks
  const [barUsesTotals, setBarUsesTotals] = useState(true);

  const filePairsRef = useRef<HTMLInputElement>(null);
  const fileAnnoRef = useRef<HTMLInputElement>(null);
  const genomeLen = useMemo(() => Math.max(...(anno || []).map(a => a.end), 1), [anno]);

  const idx = useMemo(() => (anno ? geneIndex(anno) : {}), [anno]);

  async function onPairsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setPairs(parsePairsCSV(await f.text()));
  }
  async function onAnnoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setAnno(parseAnnoCSV(await f.text()));
  }

  const genes = useMemo(() =>
    geneList.split(",").map(s => s.trim()).filter(Boolean), [geneList]);

  const peaks: PeakRow[] = useMemo(() => {
    if (!pairs || !anno || genes.length === 0) return [];
    const out: PeakRow[] = [];
    const gi = geneIndex(anno);

    genes.forEach((gname, col) => {
      const focal = gi[gname]; if (!focal) return;

      // edges where ref==gene (to match your Colab logic)
      const edges = pairs.filter(p => p.ref === gname);
      // filter counts/odds/distance
      const items = edges.map(e => {
        const targ = gi[e.target!]; if (!targ) return null;
        const dist = distanceBetween(focal, targ);
        const counts = Number(e.counts || 0);
        const odds = Number(e.odds_ratio || 0);
        return { e, targ, counts, odds, x: targ.start };
      }).filter(r => r && r.counts >= minCounts && r.odds > 0 && r.dist >= minDistance) as any[];

      // sort by genome position
      items.sort((a,b) => a.x - b.x);

      // greedy keep local maxima separated by spacing
      let current = items[0] || null;
      const keep: any[] = [];
      for (let i=1; i<items.length; i++) {
        const it = items[i];
        if (!current) { current = it; continue; }
        if (it.x > current.x + spacing) {
          keep.push(current);
          current = it;
        } else if (it.odds > current.odds) {
          current = it;
        }
      }
      if (current) keep.push(current);

      keep.forEach(k => {
        out.push({
          gene: gname,
          partner: k.e.target,
          odds: Math.min(k.odds, yCap),
          rawOdds: k.odds,
          counts: k.counts,
          xCol: col,
          color: pickColor(k.e.target_type),
        });
      });
    });

    // draw larger circles under small ones
    out.sort((a,b) => b.counts - a.counts);
    return out;
  }, [pairs, anno, genes, minCounts, minDistance, yCap, spacing]);

  // totals bar: reference logic (prefer totals/total_ref)
  const totals = useMemo(() => {
    if (!pairs || genes.length === 0) return new Map<string, number>();
    const m = new Map<string, number>();
    genes.forEach(g => {
      const refRow = pairs.find(p => p.ref === g && p.total_ref != null);
      const tarRow = pairs.find(p => p.target === g && p.totals != null);
      let val = barUsesTotals
        ? (refRow?.total_ref ?? tarRow?.totals)
        : undefined;
      if (val == null) {
        // fallback: sum of counts involving that gene
        val = pairs.reduce((acc, p) => acc + ((p.ref===g || p.target===g) ? Number(p.counts||0) : 0), 0);
      }
      m.set(g, Number(val) || 0);
    });
    return m;
  }, [pairs, genes, barUsesTotals]);

  // rendering
  const width = Math.max(400, genes.length * 140 + 120);
  const height = 460;
  const margin = { top: 30, right: 150, bottom: 60, left: 50 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const yTicks = [0,5,10,25,50,100,250,500,1000,2500,5000].filter(v => v<=yCap);

  function exportSVG(id: string, fname: string) {
    const node = document.getElementById(id) as SVGSVGElement | null;
    if (!node) return;
    const svg = node.cloneNode(true) as SVGSVGElement;
    const style = document.createElementNS("http://www.w3.org/2000/svg","style");
    style.textContent = `text, tspan { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size: 12px; }`;
    svg.insertBefore(style, svg.firstChild);
    const s = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([s], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: fname });
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/90 border-b">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-xl font-semibold">csMAP</div>
          <a href="/" className="text-sm text-blue-600 hover:underline">Home</a>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 space-y-4">
        <section className="border rounded-2xl p-4 shadow-sm">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="font-semibold mb-1">Gene list</div>
              <input className="border rounded px-2 py-1 w-full" placeholder="gcvB,sroC,..." value={geneList} onChange={e => setGeneList(e.target.value)} />
              <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                <div>
                  <label className="text-xs text-gray-600">Min counts: {minCounts}</label>
                  <input type="range" min={0} max={50} value={minCounts} onChange={e => setMinCounts(+e.target.value)} className="w-full" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Min distance (bp): {minDistance}</label>
                  <input type="range" min={0} max={20000} step={500} value={minDistance} onChange={e => setMinDistance(+e.target.value)} className="w-full" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Y cap (odds): {yCap}</label>
                  <input type="range" min={100} max={5000} step={100} value={yCap} onChange={e => setYCap(+e.target.value)} className="w-full" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Peak spacing (nt): {spacing}</label>
                  <input type="range" min={200} max={3000} step={100} value={spacing} onChange={e => setSpacing(+e.target.value)} className="w-full" />
                </div>
              </div>
              <div className="mt-3 text-xs">
                Totals bar uses:
                <label className="ml-2"><input type="radio" checked={barUsesTotals} onChange={() => setBarUsesTotals(true)} /> dataset totals</label>
                <label className="ml-2"><input type="radio" checked={!barUsesTotals} onChange={() => setBarUsesTotals(false)} /> sum of counts</label>
              </div>
            </div>

            <div>
              <div className="font-semibold">Data</div>
              <div className="text-xs text-gray-600 mt-2">Pairs CSV</div>
              <input ref={filePairsRef} type="file" accept=".csv" onChange={onPairsFile} />
              <div className="text-xs text-gray-600 mt-2">Annotations CSV</div>
              <input ref={fileAnnoRef} type="file" accept=".csv" onChange={onAnnoFile} />
              <p className="text-[11px] text-gray-500 mt-2">Pairs: ref,target,counts,odds_ratio,... | Annotations: gene_name,start,end,feature_type,strand,chromosome</p>
              <div className="mt-3 flex gap-2">
                <button className="border rounded px-3 py-1" onClick={() => exportSVG("csmap-svg", "csmap.svg")}>Export csMAP SVG</button>
                <button className="border rounded px-3 py-1" onClick={() => exportSVG("bar-svg", "csmap_totals.svg")}>Export totals SVG</button>
              </div>
            </div>
          </div>
        </section>

        {/* csMAP scatter */}
        <section className="border rounded-2xl p-4 shadow-sm overflow-x-auto">
          <svg id="csmap-svg" width={width} height={height}>
            <g transform={`translate(50,20)`}>
              {/* axes */}
              <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#222" />
              {/* x ticks: gene columns */}
              {genes.map((g, i) => (
                <g key={g} transform={`translate(${(i+0.5)* (innerW/Math.max(1,genes.length))},${innerH})`}>
                  <line y2={6} stroke="#222" />
                  <text y={26} textAnchor="middle" fontSize={12}>{g}</text>
                </g>
              ))}
              {/* y axis */}
              <line x1={0} y1={0} x2={0} y2={innerH} stroke="#222" />
              {yTicks.map((t, i) => {
                const tMax = Math.log(yCap/10)/Math.log(10) + 1; // approx symlog screen; use display mapping below
                const y = innerH - (symlog(t,10,10) / symlog(yCap,10,10)) * innerH;
                return (
                  <g key={i} transform={`translate(0,${y})`}>
                    <line x2={-6} stroke="#222" />
                    <text x={-9} y={4} textAnchor="end" fontSize={11}>{t}</text>
                    <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eee" />
                  </g>
                );
              })}
              <text transform={`translate(${-42},${innerH/2}) rotate(-90)`} fontSize={12} fill="#333">Odds ratio (symlog)</text>

              {/* points */}
              {peaks.map((p, i) => {
                const colW = innerW/Math.max(1, genes.length);
                const x = p.xCol * colW + colW/2 + (Math.random()-0.5)*colW*0.08;
                const y = innerH - (symlog(p.odds,10,10) / symlog(yCap,10,10)) * innerH;
                const r = Math.sqrt(p.counts) * 2 + 4;
                return (
                  <g key={i} transform={`translate(${x},${y})`}>
                    <circle r={r} fill="#fff" stroke={p.color} strokeWidth={2} />
                  </g>
                );
              })}
            </g>

            {/* legend on right */}
            <g transform={`translate(${width-140},20)`}>
              <text fontSize={12}>Feature type</text>
              {Object.entries(FEATURE_COLORS).map(([k, color], i) => (
                <g key={k} transform={`translate(0,${14 + i*14})`}>
                  <circle r={5} cx={6} cy={6} fill="#fff" stroke={color} strokeWidth={2} />
                  <text x={18} y={10} fontSize={11}>{k}</text>
                </g>
              ))}
              <g transform={`translate(0,${14 + (Object.keys(FEATURE_COLORS).length)*14})`}>
                <text fontSize={12}>Circle size = counts</text>
              </g>
            </g>
          </svg>
        </section>

        {/* Totals bar */}
        <section className="border rounded-2xl p-4 shadow-sm overflow-x-auto">
          <svg id="bar-svg" width={width} height={360}>
            <g transform={`translate(60,20)`}>
              {(() => {
                const vals = genes.map(g => totals.get(g) || 0);
                const maxV = Math.max(1, ...vals);
                const h = 280, w = innerW;
                const barW = w/Math.max(1,genes.length) * 0.7;
                return (
                  <>
                    {/* y log ticks at powers of 10 */}
                    <line x1={0} y1={h} x2={w} y2={h} stroke="#222"/>
                    {[1,10,100,1000,10000,100000,1000000].filter(v=>v<=Math.max(maxV,10)).map((v,i)=> {
                      const y = h - (Math.log10(v)/Math.log10(maxV)) * h;
                      return (
                        <g key={v} transform={`translate(0,${y})`}>
                          <line x2={-6} stroke="#222"/>
                          <text x={-9} y={4} textAnchor="end" fontSize={11}>{v}</text>
                          <line x1={0} x2={w} y1={0} y2={0} stroke="#eee"/>
                        </g>
                      );
                    })}
                    {genes.map((g,i)=>{
                      const v = Math.max(1, totals.get(g) || 0);
                      const y = h - (Math.log10(v)/Math.log10(maxV))*h;
                      const x = (i+0.5)*(w/Math.max(1,genes.length)) - barW/2;
                      return (
                        <g key={g}>
                          <rect x={x} y={y} width={barW} height={h-y} fill={mixColor("#3b82f6",0.25)} stroke="#1f2937"/>
                          <text x={x+barW/2} y={h+18} textAnchor="middle" fontSize={12} transform={`rotate(0,${x+barW/2},${h+18})`}>{g}</text>
                        </g>
                      );
                    })}
                    <text transform={`translate(${-46},${h/2}) rotate(-90)`} fontSize={12}>Total interactions (log)</text>
                  </>
                );
              })()}
            </g>
          </svg>
        </section>
      </main>
    </div>
  );
}
