// app/pairmap/page.tsx
"use client";
import React, { useMemo, useRef, useState } from "react";
import { Annotation, geneIndex, parseAnnoCSV } from "@/lib/shared";

type Contact = { c1: number; c2: number };

function parseBedOrCsv(text: string): Contact[] {
  // Flexible: accept BED-like (chr, c1, c2) or CSV with 2 numeric cols
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out: Contact[] = [];
  lines.forEach(line => {
    const parts = line.split(/[\t, ]+/).filter(Boolean);
    if (parts.length < 2) return;
    // if 3+, assume col1=chr, col2=start, col3=end
    if (parts.length >= 3) {
      const c1 = Number(parts[1]), c2 = Number(parts[2]);
      if (Number.isFinite(c1) && Number.isFinite(c2)) out.push({ c1, c2 });
    } else {
      const c1 = Number(parts[0]), c2 = Number(parts[1]);
      if (Number.isFinite(c1) && Number.isFinite(c2)) out.push({ c1, c2 });
    }
  });
  return out;
}

function toBin(coord: number, ws: number, we: number, strand: string, bin: number) {
  return strand === "+"
    ? Math.floor((coord - ws) / bin)
    : Math.floor((we - coord) / bin);
}

const CMAPS = ["#ef4444","#22c55e","#3b82f6","#f97316","#a855f7","#6b7280"]; // Reds, Greens, Blues, Oranges, Purples, Grays

function lerpColor(from: string, to: string, t: number) {
  const f = (h: string) => parseInt(h, 16);
  const r = Math.round((1-t)*255 + t*f(to.slice(1,3)));
  const g = Math.round((1-t)*255 + t*f(to.slice(3,5)));
  const b = Math.round((1-t)*255 + t*f(to.slice(5,7)));
  return `rgb(${r},${g},${b})`;
}

export default function PairMapPage() {
  const [anno, setAnno] = useState<Annotation[] | null>(null);
  const [contacts, setContacts] = useState<Contact[] | null>(null);

  const [primary, setPrimary] = useState<string>("");
  const [secondaries, setSecondaries] = useState<string>("");
  const [flankY, setFlankY] = useState(100);
  const [flankX, setFlankX] = useState(100);
  const [bin, setBin] = useState(10);
  const [vmax, setVmax] = useState(10);

  const fileAnnoRef = useRef<HTMLInputElement>(null);
  const fileBedRef = useRef<HTMLInputElement>(null);

  const gi = useMemo(() => (anno ? geneIndex(anno) : {}), [anno]);

  async function onAnnoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setAnno(parseAnnoCSV(await f.text()));
  }
  async function onBedFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setContacts(parseBedOrCsv(await f.text()));
  }

  const xs = useMemo(() => secondaries.split(",").map(s => s.trim()).filter(Boolean), [secondaries]);

  // build panels
  const panels = useMemo(() => {
    if (!anno || !contacts || !primary || xs.length === 0) return [];

    const py = gi[primary];
    if (!py) return [];

    const wy_s = Math.max(1, py.start - flankY);
    const wy_e = py.end + flankY;
    const sy = String(py.strand || "+");
    const lenY = wy_e - wy_s + 1;
    const binsY = Math.ceil(lenY / bin);

    const gy_len_bins = Math.floor((py.end - py.start) / bin);
    const gy_s_bin = Math.floor(flankY / bin);
    const gy_e_bin = gy_s_bin + Math.max(0, gy_len_bins - 1);
    const yTicks = [0, gy_s_bin, gy_e_bin, binsY - 1];
    const yLabels = [`-${flankY}`, "start", "end", `+${flankY}`];

    return xs.map((xname, idx2) => {
      const px = gi[xname];
      if (!px) return { xname, mat: null, binsX: 0, yTicks, yLabels, wy_s, wy_e, sy, pxStart: 0, pxEnd: 0, sx: "+", binsY };

      const wx_s = Math.max(1, px.start - flankX);
      const wx_e = px.end + flankX;
      const sx = String(px.strand || "+");
      const lenX = wx_e - wx_s + 1;
      const binsX = Math.ceil(lenX / bin);

      const mat = new Array(binsY).fill(0).map(() => new Array(binsX).fill(0));

      contacts.forEach(({c1, c2}) => {
        const inY1 = (c1 >= wy_s && c1 <= wy_e), inX1 = (c1 >= wx_s && c1 <= wx_e);
        const inY2 = (c2 >= wy_s && c2 <= wy_e), inX2 = (c2 >= wx_s && c2 <= wx_e);
        if (inY1 && inX2) {
          const by = toBin(c1, wy_s, wy_e, sy, bin);
          const bx = toBin(c2, wx_s, wx_e, sx, bin);
          if (by>=0 && by<binsY && bx>=0 && bx<binsX) mat[by][bx] += 1;
        }
        if (inY2 && inX1) {
          const by = toBin(c2, wy_s, wy_e, sy, bin);
          const bx = toBin(c1, wx_s, wx_e, sx, bin);
          if (by>=0 && by<binsY && bx>=0 && bx<binsX) mat[by][bx] += 1;
        }
      });

      const gx_len_bins = Math.floor((px.end - px.start) / bin);
      const gx_s_bin = Math.floor(flankX / bin);
      const gx_e_bin = gx_s_bin + Math.max(0, gx_len_bins - 1);
      const xTicks = [0, gx_s_bin, gx_e_bin, binsX - 1];
      const xLabels = [`-${flankX}`, "start", "end", `+${flankX}`];

      return {
        xname, mat, binsX, binsY, wy_s, wy_e, sy, sx, xTicks, xLabels, yTicks, yLabels
      };
    });
  }, [anno, contacts, primary, xs, flankY, flankX, bin, gi]);

  const panelW = 320, panelH = 320, pad = 60;

  function exportSVG() {
    const el = document.getElementById("pairmap-svg") as SVGSVGElement | null;
    if (!el) return;
    const svg = el.cloneNode(true) as SVGSVGElement;
    const style = document.createElementNS("http://www.w3.org/2000/svg","style");
    style.textContent = `text, tspan { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; font-size: 11px; }`;
    svg.insertBefore(style, svg.firstChild);
    const s = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([s], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `${primary}_pairmap.svg` });
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/90 border-b">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-xl font-semibold">Inter-RNA Heatmap</div>
          <a href="/" className="text-sm text-blue-600 hover:underline">Home</a>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 space-y-4">
        <section className="border rounded-2xl p-4 shadow-sm">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="font-semibold mb-1">Primary (Y-axis) gene</div>
              <input className="border rounded px-2 py-1 w-full" value={primary} onChange={e=>setPrimary(e.target.value)} placeholder="e.g., GcvB" />
              <div className="font-semibold mt-3 mb-1">Secondary (X-axis) genes (comma-separated)</div>
              <input className="border rounded px-2 py-1 w-full" value={secondaries} onChange={e=>setSecondaries(e.target.value)} placeholder="gene1,gene2,..." />
              <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                <div>
                  <label className="text-xs text-gray-600">Flank Y (nt): {flankY}</label>
                  <input type="range" min={0} max={1000} step={10} value={flankY} onChange={e=>setFlankY(+e.target.value)} className="w-full"/>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Flank X (nt): {flankX}</label>
                  <input type="range" min={0} max={1000} step={10} value={flankX} onChange={e=>setFlankX(+e.target.value)} className="w-full"/>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Bin size (nt): {bin}</label>
                  <input type="range" min={5} max={50} step={1} value={bin} onChange={e=>setBin(+e.target.value)} className="w-full"/>
                </div>
                <div>
                  <label className="text-xs text-gray-600">VMAX (color scale): {vmax}</label>
                  <input type="range" min={1} max={50} step={1} value={vmax} onChange={e=>setVmax(+e.target.value)} className="w-full"/>
                </div>
              </div>
            </div>

            <div>
              <div className="font-semibold">Data</div>
              <div className="text-xs text-gray-600 mt-2">Annotations CSV</div>
              <input ref={fileAnnoRef} type="file" accept=".csv" onChange={onAnnoFile} />
              <div className="text-xs text-gray-600 mt-2">Chimeras (.bed or .csv)</div>
              <input ref={fileBedRef} type="file" accept=".bed,.csv,.txt" onChange={onBedFile} />
              <p className="text-[11px] text-gray-500 mt-2">BED: chrom, start, end per line. CSV with two numeric columns also accepted.</p>
              <button className="mt-3 border rounded px-3 py-1" onClick={exportSVG}>Export SVG</button>
            </div>
          </div>
        </section>

        <section className="border rounded-2xl p-4 shadow-sm overflow-x-auto">
          {panels.length === 0 ? (
            <div className="text-sm text-gray-500">Load annotations + chimeras, enter primary and secondary genes, then scroll to see panels.</div>
          ) : (
            <svg id="pairmap-svg" width={panels.length * (panelW + 40) + 40} height={panelH + 120}>
              {panels.map((p, i) => {
                const x0 = 20 + i * (panelW + 40);
                const y0 = 20;
                const cmap = CMAPS[i % CMAPS.length];

                return (
                  <g key={i} transform={`translate(${x0},${y0})`}>
                    {/* title */}
                    <text x={panelW/2} y={-6} textAnchor="middle" fontSize={12}>
                      {primary} vs {p.xname}
                    </text>

                    {/* frame */}
                    <rect x={0} y={0} width={panelW} height={panelH} fill="none" stroke="#ddd" />

                    {/* heat pixels */}
                    {p.mat && (() => {
                      const cellW = panelW / p.binsX;
                      const cellH = panelH / p.binsY;
                      const elems: JSX.Element[] = [];
                      for (let yy=0; yy<p.binsY; yy++) {
                        for (let xx=0; xx<p.binsX; xx++) {
                          const v = p.mat[yy][xx];
                          if (v <= 0) continue;
                          const t = Math.min(1, v / vmax);
                          const fill = lerpColor("#ffffff", cmap, Math.sqrt(t));
                          // invert y
                          const yRect = panelH - (yy+1)*cellH;
                          elems.push(<rect key={`${yy}-${xx}`} x={xx*cellW} y={yRect} width={cellW} height={cellH} fill={fill} />);
                        }
                      }
                      return elems;
                    })()}

                    {/* X ticks */}
                    {p.xTicks?.map((t, k) => (
                      <g key={k} transform={`translate(${(t+0.5) * (panelW / p.binsX)},${panelH})`}>
                        <line y2={6} stroke="#222" />
                        <text y={20} textAnchor="middle" fontSize={11}>{p.xLabels?.[k]}</text>
                      </g>
                    ))}

                    {/* Y ticks (on every panel) */}
                    {p.yTicks?.map((t, k) => (
                      <g key={k} transform={`translate(0,${panelH - (t+0.5) * (panelH / p.binsY)})`}>
                        <line x2={-6} stroke="#222" />
                        <text x={-9} y={4} textAnchor="end" fontSize={11}>{p.yLabels?.[k]}</text>
                      </g>
                    ))}

                    {/* axes lines */}
                    <line x1={0} y1={panelH} x2={panelW} y2={panelH} stroke="#222"/>
                    <line x1={0} y1={0} x2={0} y2={panelH} stroke="#222"/>
                  </g>
                );
              })}
            </svg>
          )}
        </section>
      </main>
    </div>
  );
}
