"use client";

import React, { useMemo } from "react";
import { Download, Pin } from "lucide-react";
import { useExplorer } from "@/lib/explore/store";
import { formatGeneName, pickColor, exportPNG } from "@/lib/shared";
import { buildCsColumns } from "@/lib/explore/compute";

export function CompareLens() {
  const { focal, pinned, annoByCF, pairs, sizeScale } = useExplorer();

  const geneList = useMemo(() => {
    const seen = new Set<string>();
    return [focal, ...pinned].filter((g) => (seen.has(g) ? false : (seen.add(g), true)));
  }, [focal, pinned]);

  const cols = useMemo(() => buildCsColumns(geneList, pairs, annoByCF, sizeScale), [geneList, pairs, annoByCF, sizeScale]);

  if (geneList.length < 2) {
    return (
      <div className="glass grid min-h-[420px] place-items-center rounded-3xl p-8 text-center">
        <div className="max-w-sm text-sm text-slate-500">
          <Pin className="mx-auto mb-3 h-7 w-7 text-slate-300" />
          <p className="font-medium text-slate-700">Compare interaction spectra side by side.</p>
          <p className="mt-1 text-slate-400">Pin partners from the list (the <Pin className="inline h-3 w-3" /> icon) and they'll line up next to <span className="font-medium text-slate-600">{formatGeneName(focal).text}</span> here.</p>
        </div>
      </div>
    );
  }

  // scatter layout
  const colW = 168;
  const W = Math.max(520, colW * geneList.length + 90);
  const SC_H = 480, m = { top: 24, right: 30, bottom: 70, left: 60 };
  const iw = W - m.left - m.right, ih = SC_H - m.top - m.bottom;
  const yMaxT = 1 + Math.log10(5000 / 10);
  const yPix = (t: number) => ih - (t / yMaxT) * ih;
  const yTickVals = [0, 1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

  // totals bar layout
  const BAR_H = 240, bm = { top: 16, right: 30, bottom: 60, left: 60 };
  const biw = W - bm.left - bm.right, bih = BAR_H - bm.top - bm.bottom;
  const tMax = Math.max(1, ...cols.map((c) => c.total));
  const log10 = (v: number) => (v <= 0 ? 0 : Math.log10(v));
  const barY = (v: number) => bih - (log10(v) / (log10(tMax) || 1)) * bih;
  const barW = Math.min(26, Math.max(14, biw / (geneList.length * 2.4)));
  const maxPow = Math.ceil(log10(tMax) || 1);
  const barTicks = Array.from({ length: maxPow + 1 }, (_, k) => Math.pow(10, k));

  return (
    <div className="glass rounded-3xl p-4 sm:p-5 lens-in">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-800">Compare · target spectra <span className="font-normal text-slate-400">({geneList.length} RNAs)</span></div>
        <button onClick={() => exportPNG("compare-scatter", `compare_${geneList.join("_")}`)} title="Export PNG" className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800">
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <svg id="compare-scatter" width={W} height={SC_H} className="block">
          <defs><style>{`text{font-family:ui-sans-serif,system-ui;font-size:11px;fill:#64748b}`}</style></defs>
          <g transform={`translate(${m.left},${m.top})`}>
            {yTickVals.map((v, i) => {
              const t = v <= 10 ? v / 10 : 1 + Math.log10(v / 10);
              return (
                <g key={i} transform={`translate(0,${yPix(t)})`}>
                  <line x1={0} x2={iw} stroke="#eef2f7" />
                  <text x={-9} y={3} textAnchor="end" fill="#94a3b8">{v}</text>
                </g>
              );
            })}
            <text transform={`translate(-46,${ih / 2}) rotate(-90)`} textAnchor="middle" fill="#64748b">Odds ratio (symlog)</text>
            {cols.map((c, ci) => {
              const cx = ((ci + 0.5) / geneList.length) * iw;
              const disp = formatGeneName(c.gene, c.type);
              const isFocal = ci === 0;
              return (
                <g key={c.gene}>
                  <line x1={cx} y1={0} x2={cx} y2={ih} stroke={isFocal ? "#cbd5e1" : "#eef2f7"} strokeDasharray="3 4" />
                  {c.dots.map((d, di) => {
                    const jx = cx + ((((di * 53) % 13) - 6) / 6) * 7;
                    return <circle key={di} cx={jx} cy={yPix(d.yT)} r={d.r} fill="#fff" stroke={pickColor(d.type)} strokeWidth={2} />;
                  })}
                  <text x={cx} y={ih + 22} textAnchor="middle" fontWeight={isFocal ? 700 : 400} fill={isFocal ? "#0f172a" : "#475569"} style={{ fontStyle: disp.italic ? "italic" : "normal" }}>{disp.text}</text>
                  {isFocal && <text x={cx} y={ih + 38} textAnchor="middle" fontSize={9} fill="#94a3b8">focal</text>}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="mt-2 overflow-x-auto border-t border-slate-100 pt-3">
        <div className="mb-1 text-xs font-medium text-slate-500">Total interactions (log scale)</div>
        <svg id="compare-bars" width={W} height={BAR_H} className="block">
          <defs><style>{`text{font-family:ui-sans-serif,system-ui;font-size:11px;fill:#64748b}`}</style></defs>
          <g transform={`translate(${bm.left},${bm.top})`}>
            {barTicks.map((v, i) => (
              <g key={i} transform={`translate(0,${barY(v)})`}>
                <line x1={0} x2={biw} stroke="#eef2f7" />
                <text x={-9} y={3} textAnchor="end" fill="#94a3b8">{v >= 1000 ? `${v / 1000}k` : v}</text>
              </g>
            ))}
            {cols.map((c, i) => {
              const x = (i + 0.5) * (biw / geneList.length) - barW / 2;
              const y = barY(Math.max(1, c.total));
              const disp = formatGeneName(c.gene, c.type);
              return (
                <g key={c.gene}>
                  <rect x={x} y={y} width={barW} height={bih - y} rx={3} fill={i === 0 ? pickColor(c.type) : "#cbd5e1"} opacity={i === 0 ? 0.85 : 1} />
                  <text x={x + barW / 2} y={bih + 18} textAnchor="middle" style={{ fontStyle: disp.italic ? "italic" : "normal" }}>{disp.text}</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
