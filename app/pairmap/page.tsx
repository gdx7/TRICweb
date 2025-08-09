"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  Annotation,
  parseAnnoCSV,
  geneIndex as buildIndex,
} from "@/lib/shared";

/**
 * PairMAP (inter-RNA heatmap)
 * Inputs:
 *  - Annotations CSV (gene_name,start,end,feature_type,strand,chromosome)
 *  - BED/TSV/CSV of chimeras with at least 2 numeric columns = coordinates (C1, C2)
 *  - Primary RNA (Y-axis), comma-separated list of X RNAs
 * Controls:
 *  - FLANK_Y, FLANK_X, BIN (nt), VMAX color scale
 * Rendering:
 *  - One panel per X; counts binned into (Ybins × Xbins)
 *  - Reverse-strand flipping to 5′→3′ for both axes
 *  - Y inverted (0 at bottom) by drawing from bottom upward
 */

type Chimera = { c1: number; c2: number };

function parseChimeras(text: string): Chimera[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out: Chimera[] = [];
  for (const line of lines) {
    // accept TSV/BED/CSV-ish; seek two numeric columns anywhere
    const parts = line.split(/[,\t\s]+/).filter(Boolean);
    if (parts.length < 2) continue;
    // try last two numeric columns
    const nums = parts.map(p => Number(p)).filter(n => Number.isFinite(n));
    if (nums.length >= 2) {
      const c1 = nums[0];
      const c2 = nums[1];
      out.push({ c1, c2 });
    }
  }
  return out;
}

// strand-aware bin index
function toBin(coord: number, ws: number, we: number, strand: string, bin: number) {
  return strand === "+" ? Math.floor((coord - ws) / bin) : Math.floor((we - coord) / bin);
}

export default function PairMapPage() {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [chimeras, setChimeras] = useState<Chimera[]>([]);
  const [primary, setPrimary] = useState("GcvB"); // y-axis
  const [xListText, setXListText] = useState("CpxQ,MicF");
  const [FLANK_Y, setFLANK_Y] = useState(100);
  const [FLANK_X, setFLANK_X] = useState(100);
  const [BIN, setBIN] = useState(10);
  const [VMAX, setVMAX] = useState(10);

  const fileAnnoRef = useRef<HTMLInputElement>(null);
  const fileBedRef = useRef<HTMLInputElement>(null);

  const idx = useMemo(() => buildIndex(annotations), [annotations]);
  const xGenes = useMemo(() => xListText.split(",").map(s => s.trim()).filter(Boolean), [xListText]);

  async function onAnnoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const txt = await f.text();
    setAnnotations(parseAnnoCSV(txt));
  }
  async function onBedFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const txt = await f.text();
    setChimeras(parseChimeras(txt));
  }

  // precompute Y window / bins
  const yMeta = useMemo(() => {
    const ya = idx[primary];
    if (!ya) return null;
    const ws = Math.max(1, ya.start - FLANK_Y);
    const we = ya.end + FLANK_Y;
    const bins = Math.ceil((we - ws + 1) / BIN);
    const yLenBins = Math.floor((ya.end - ya.start) / BIN);
    const yStartBin = Math.floor(FLANK_Y / BIN);
    const yEndBin = yStartBin + Math.max(0, yLenBins - 1);
    return { ws, we, strand: ya.strand || "+", bins, yStartBin, yEndBin };
  }, [idx, primary, FLANK_Y, BIN]);

  // build one matrix per X RNA
  const panels = useMemo(() => {
    if (!yMeta) return [];
    const out: {
      gene: string;
      binsX: number;
      mat: number[][]; // [Y][X]
      xStartBin: number;
      xEndBin: number;
    }[] = [];

    for (const xg of xGenes) {
      const xa = idx[xg];
      if (!xa) continue;

      const wxs = Math.max(1, xa.start - FLANK_X);
      const wxe = xa.end + FLANK_X;
      const binsX = Math.ceil((wxe - wxs + 1) / BIN);
      const xLenBins = Math.floor((xa.end - xa.start) / BIN);
      const xStartBin = Math.floor(FLANK_X / BIN);
      const xEndBin = xStartBin + Math.max(0, xLenBins - 1);

      // filter chimeras that touch both windows
      const sub = chimeras.filter(({ c1, c2 }) =>
        ((c1 >= yMeta.ws && c1 <= yMeta.we) || (c2 >= yMeta.ws && c2 <= yMeta.we)) &&
        ((c1 >= wxs && c1 <= wxe) || (c2 >= wxs && c2 <= wxe))
      );
      // fill matrix
      const mat = Array.from({ length: yMeta.bins }, () => Array.from({ length: binsX }, () => 0));
      for (const { c1, c2 } of sub) {
        let yb = -1, xb = -1;
        if (c1 >= yMeta.ws && c1 <= yMeta.we) yb = toBin(c1, yMeta.ws, yMeta.we, yMeta.strand || "+", BIN);
        if (c2 >= yMeta.ws && c2 <= yMeta.we) yb = yb >= 0 ? yb : toBin(c2, yMeta.ws, yMeta.we, yMeta.strand || "+", BIN);
        if (c1 >= wxs && c1 <= wxe) xb = toBin(c1, wxs, wxe, xa.strand || "+", BIN);
        if (c2 >= wxs && c2 <= wxe) xb = xb >= 0 ? xb : toBin(c2, wxs, wxe, xa.strand || "+", BIN);
        if (yb >= 0 && yb < yMeta.bins && xb >= 0 && xb < binsX) {
          mat[yb][xb] += 1;
        }
      }
      out.push({ gene: xg, binsX, mat, xStartBin, xEndBin });
    }
    return out;
  }, [xGenes, idx, chimeras, yMeta, FLANK_X, BIN]);

  function colorFor(colormap: number, v: number) {
    // simple family: 0=Reds,1=Greens,2=Blues,3=Oranges,4=Purples,5=Greys
    const t = Math.max(0, Math.min(1, v / Math.max(1, VMAX)));
    const l = 95 - t * 70; // lighten to darker
    switch (colormap % 6) {
      case 0: return `hsl(0 80% ${l}%)`;
      case 1: return `hsl(140 60% ${l}%)`;
      case 2: return `hsl(220 70% ${l}%)`;
      case 3: return `hsl(30 90% ${l}%)`;
      case 4: return `hsl(280 70% ${l}%)`;
      default:return `hsl(0 0% ${l}%)`;
    }
  }

  function downloadSVG() {
    const node = document.getElementById("pairmap-svg") as SVGSVGElement | null;
    if (!node) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(node);
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${primary}_pairmap.svg`; a.click();
    URL.revokeObjectURL(url);
  }

  // layout
  const panelW = 260;      // per X panel width
  const panelH = 360;      // per panel height
  const pad = 30;          // gap between panels
  const leftAxis = 70;
  const topAxis = 20;
  const totalW = leftAxis + (panels.length * (panelW + pad)) + 10;
  const totalH = topAxis + panelH + 80;

  return (
    <div className="mx-auto max-w-[1200px] p-4 space-y-4">
      <header className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">pairMAP — inter-RNA heatmap</h1>
          <p className="text-xs text-gray-600">
            Upload Annotations CSV and a BED/TSV/CSV of chimera coordinates (two numeric columns). Enter one primary RNA (Y) and a comma list of partners (X). 5′→3′ on both axes, Y inverted.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="border rounded px-3 py-1" onClick={downloadSVG}>Export SVG</button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* Controls */}
        <section className="col-span-12 lg:col-span-3 border rounded-2xl p-4 space-y-3">
          <div>
            <div className="text-sm font-medium mb-1">Annotations CSV</div>
            <input ref={fileAnnoRef} type="file" accept=".csv" onChange={onAnnoFile} />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Chimeras file (.bed / .tsv / .csv)</div>
            <input ref={fileBedRef} type="file" accept=".bed,.tsv,.csv,.txt" onChange={onBedFile} />
          </div>

          <div className="pt-1">
            <div className="text-sm font-medium mb-1">Primary RNA (Y-axis)</div>
            <input className="border rounded px-2 py-1 w-full" value={primary} onChange={e => setPrimary(e.target.value)} />
          </div>

          <div>
            <div className="text-sm font-medium mb-1">Partners (X; comma-separated)</div>
            <textarea className="w-full border rounded p-2 text-sm" rows={2} value={xListText} onChange={e => setXListText(e.target.value)} placeholder="geneA,geneB,geneC"/>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-xs text-gray-600">FLANK_Y (nt)</label>
              <input type="number" className="border rounded px-2 py-1 w-full" value={FLANK_Y} onChange={e => setFLANK_Y(Math.max(0, +e.target.value))}/>
            </div>
            <div>
              <label className="text-xs text-gray-600">FLANK_X (nt)</label>
              <input type="number" className="border rounded px-2 py-1 w-full" value={FLANK_X} onChange={e => setFLANK_X(Math.max(0, +e.target.value))}/>
            </div>
            <div>
              <label className="text-xs text-gray-600">BIN (nt)</label>
              <input type="number" className="border rounded px-2 py-1 w-full" value={BIN} onChange={e => setBIN(Math.max(1, +e.target.value))}/>
            </div>
            <div>
              <label className="text-xs text-gray-600">VMAX (color max)</label>
              <input type="number" className="border rounded px-2 py-1 w-full" value={VMAX} onChange={e => setVMAX(Math.max(1, +e.target.value))}/>
            </div>
          </div>
        </section>

        {/* Plot */}
        <section className="col-span-12 lg:col-span-9 border rounded-2xl p-4">
          {!yMeta && <div className="text-sm text-gray-500">Primary RNA not found in annotations.</div>}
          {!!yMeta && panels.length === 0 && <div className="text-sm text-gray-500">No partner panels to display (check partners or files).</div>}
          {!!yMeta && panels.length > 0 && (
            <div className="w-full overflow-x-auto">
              <svg id="pairmap-svg" width={totalW} height={totalH} className="mx-auto block">
                {/* Title */}
                <text x={leftAxis} y={16} className="fill-gray-800 text-[12px]">
                  {primary} vs {panels.map(p => p.gene).join(", ")} (bin {BIN} nt, vmax {VMAX})
                </text>

                {/* Y axis (shared) ticks on the left of the first panel */}
                <g transform={`translate(${leftAxis - 10},${topAxis})`}>
                  {/* ticks for -flank, start, end, +flank */}
                  {yMeta && (() => {
                    const rows = yMeta.bins;
                    const cellH = panelH / rows;
                    const ty = (bin: number) => {
                      // invert: row 0 should be at bottom => y = top + (rows - (bin+1)) * cellH
                      return (rows - (bin + 1)) * cellH;
                    };
                    return (
                      <>
                        <line x1={10} y1={0} x2={10} y2={panelH} stroke="#222" />
                        {[0, yMeta.yStartBin, yMeta.yEndBin, yMeta.bins - 1].map((b, i) => (
                          <g key={i} transform={`translate(10,${ty(b)})`}>
                            <line x2={-6} stroke="#222" />
                            <text x={-9} y={3} textAnchor="end" className="fill-gray-700 text-[10px]">
                              {i === 0 ? `-${FLANK_Y}` : i === 1 ? "start" : i === 2 ? "end" : `+${FLANK_Y}`}
                            </text>
                          </g>
                        ))}
                        <text transform={`translate(-38,${panelH/2}) rotate(-90)`} className="fill-gray-700 text-[11px]">
                          {primary} (5′→3′)
                        </text>
                      </>
                    );
                  })()}
                </g>

                {/* Panels */}
                {panels.map((p, i) => {
                  const left = leftAxis + i * (panelW + pad);
                  const top = topAxis;
                  const rows = yMeta!.bins;
                  const cols = p.binsX;
                  const cellW = panelW / cols;
                  const cellH = panelH / rows;

                  return (
                    <g key={p.gene} transform={`translate(${left},${top})`}>
                      {/* matrix cells (draw inverted Y) */}
                      {p.mat.map((row, r) => {
                        return row.map((v, c) => {
                          const yInv = rows - (r + 1);
                          const x = c * cellW;
                          const y = yInv * cellH;
                          return (
                            <rect key={`${r}:${c}`} x={x} y={y} width={cellW} height={cellH} fill={colorFor(i, v)} />
                          );
                        });
                      })}
                      {/* frame */}
                      <rect x={0} y={0} width={panelW} height={panelH} fill="none" stroke="#333" strokeWidth={1} />

                      {/* X ticks: -flank, start, end, +flank */}
                      <g transform={`translate(0,${panelH})`}>
                        <line x1={0} y1={0} x2={panelW} y2={0} stroke="#222" />
                        {[0, p.xStartBin, p.xEndBin, p.binsX - 1].map((b, j) => {
                          const x = (b + 0.5) * cellW;
                          return (
                            <g key={j} transform={`translate(${x},0)`}>
                              <line y2={6} stroke="#222" />
                              <text y={20} textAnchor="middle" className="fill-gray-700 text-[10px]">
                                {j === 0 ? `-${FLANK_X}` : j === 1 ? "start" : j === 2 ? "end" : `+${FLANK_X}`}
                              </text>
                            </g>
                          );
                        })}
                        <text x={panelW/2} y={36} textAnchor="middle" className="fill-gray-700 text-[11px]">
                          {p.gene} (5′→3′)
                        </text>
                      </g>

                      {/* colorbar label per panel */}
                      <text x={panelW - 2} y={-6} textAnchor="end" className="fill-gray-700 text-[10px]">
                        Count (vmax {VMAX})
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
