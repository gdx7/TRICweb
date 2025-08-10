"use client";

import React, { useMemo, useState } from "react";
import Papa from "papaparse";

/* ---------------- Types ---------------- */
type FeatureType =
  | "CDS" | "5'UTR" | "3'UTR" | "ncRNA" | "tRNA" | "rRNA" | "sRNA" | "hkRNA" | string;

type Annotation = {
  gene_name: string;
  start: number;
  end: number;
  feature_type?: FeatureType;
  strand?: string;
  chromosome?: string;
};

/* -------------- Helpers (only new bit = cf) -------------- */
const cf = (s: string) => String(s || "").trim().toLowerCase(); // <- case-insensitive key

function exportSVG(svgId: string, name: string) {
  const el = document.getElementById(svgId) as SVGSVGElement | null;
  if (!el) return;
  const clone = el.cloneNode(true) as SVGSVGElement;
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent =
    'text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#334155;font-size:10px}';
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

function parseAnnoCSV(csv: string): Annotation[] {
  const { data } = Papa.parse<any>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
  return (data as any[])
    .filter((r) => r.gene_name && (r.start != null) && (r.end != null))
    .map((r) => ({
      gene_name: String(r.gene_name).trim(),
      start: Number(r.start),
      end: Number(r.end),
      feature_type: r.feature_type,
      strand: r.strand,
      chromosome: r.chromosome,
    }));
}

// accepts .bed (chrom, pos1, pos2) or 2-column CSV
async function parseContacts(file: File): Promise<Array<[number, number]>> {
  const txt = await file.text();
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const rows: Array<[number, number]> = [];
  for (const line of lines) {
    const parts = line.split(/\s+|,/).filter(Boolean);
    if (parts.length >= 3 && !isNaN(Number(parts[1])) && !isNaN(Number(parts[2]))) {
      rows.push([Number(parts[1]), Number(parts[2])]);
    } else if (parts.length >= 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
      rows.push([Number(parts[0]), Number(parts[1])]);
    }
  }
  return rows;
}

/* ---------------- Page ---------------- */
export default function PairMapPage() {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [contacts, setContacts] = useState<Array<[number, number]>>([]);

  // Inputs (unchanged UI, now case-insensitive under the hood)
  const [primaryRNA, setPrimaryRNA] = useState("gcvB");
  const [secondaryList, setSecondaryList] = useState("cpxQ, sroC, arrS");

  // Sliders (as before)
  const [flankY, setFlankY] = useState(100); // nt each side on Y axis RNA
  const [flankX, setFlankX] = useState(100); // nt each side on X axis RNAs

  const BIN = 10;   // fixed binning (10 nt)
  const VMAX = 10;  // fixed color scale

  // case-insensitive annotation index
  const annoByName = useMemo(() => {
    const m = new Map<string, Annotation>();
    for (const a of annotations) m.set(cf(a.gene_name), a);
    return m;
  }, [annotations]);

  const primaryKey = cf(primaryRNA);
  const yAnn = annoByName.get(primaryKey);

  const xGenes = useMemo(
    () => secondaryList.split(/[, \s]+/).map(cf).filter(Boolean),
    [secondaryList]
  );
  const xAnns = xGenes
    .map((g) => ({ gene: g, ann: annoByName.get(g) }))
    .filter((d) => d.ann) as { gene: string; ann: Annotation }[];

  async function onAnnoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setAnnotations(parseAnnoCSV(await f.text()));
  }
  async function onContactsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setContacts(await parseContacts(f));
  }

  // Build one heatmap per X-gene
  const mats = useMemo(() => {
    if (!yAnn) return [];
    const wy_s = Math.max(1, yAnn.start - flankY);
    const wy_e = yAnn.end + flankY;
    const len_y = wy_e - wy_s + 1;
    const bins_y = Math.ceil(len_y / BIN);

    function toBin(coord: number, ws: number, we: number, strand?: string) {
      const plus = strand !== "-";
      return plus ? Math.floor((coord - ws) / BIN) : Math.floor((we - coord) / BIN);
    }

    return xAnns.map(({ gene, ann }) => {
      const wx_s = Math.max(1, ann.start - flankX);
      const wx_e = ann.end + flankX;
      const len_x = wx_e - wx_s + 1;
      const bins_x = Math.ceil(len_x / BIN);

      const mat = Array.from({ length: bins_y }, () => Array(bins_x).fill(0));
      for (const [c1, c2] of contacts) {
        let b1y = -1, b1x = -1, b2y = -1, b2x = -1;
        if (c1 >= wy_s && c1 <= wy_e) b1y = toBin(c1, wy_s, wy_e, yAnn.strand);
        if (c1 >= wx_s && c1 <= wx_e) b1x = toBin(c1, wx_s, wx_e, ann.strand);
        if (c2 >= wy_s && c2 <= wy_e) b2y = toBin(c2, wy_s, wy_e, yAnn.strand);
        if (c2 >= wx_s && c2 <= wx_e) b2x = toBin(c2, wx_s, wx_e, ann.strand);
        if (b1y !== -1 && b2x !== -1) mat[b1y][b2x] += 1;
        if (b2y !== -1 && b1x !== -1) mat[b2y][b1x] += 1;
      }

      return {
        gene,
        mat,
        bins_x, bins_y,
        // for ticks
        y_len_bins: Math.floor((yAnn.end - yAnn.start) / BIN),
        x_len_bins: Math.floor((ann.end - ann.start) / BIN),
      };
    });
  }, [contacts, xAnns, yAnn, flankX, flankY]);

  // Layout
  const panelW = 340, panelH = 280, pad = 20;
  const W = Math.max(panelW * Math.max(1, mats.length) + pad * 2, 720);
  const H = panelH + 110;

  return (
    <div className="mx-auto max-w-[1400px] p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">pairMAP</h1>
        <button
          onClick={() => exportSVG("pairmap-svg", "pairMAP")}
          className="text-xs px-2 py-1 border rounded bg-white hover:bg-slate-50"
        >
          Export SVG
        </button>
      </div>

      {/* Inputs */}
      <div className="flex flex-wrap gap-6 items-end mb-4">
        <div>
          <div className="text-sm text-slate-700 mb-1">Primary RNA (Y-axis, case-insensitive)</div>
          <input
            className="border rounded px-3 py-2 w-[260px]"
            value={primaryRNA}
            onChange={(e) => setPrimaryRNA(e.target.value)}
          />
        </div>
        <div>
          <div className="text-sm text-slate-700 mb-1">Secondary RNAs (comma/space, case-insensitive)</div>
          <input
            className="border rounded px-3 py-2 w-[380px]"
            value={secondaryList}
            onChange={(e) => setSecondaryList(e.target.value)}
          />
        </div>

        {/* Sliders preserved */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-700 w-24">Flank Y</label>
          <input type="range" min={0} max={1000} step={10} value={flankY}
                 onChange={(e)=>setFlankY(Number(e.target.value))}/>
          <span className="text-xs text-slate-600 w-12 text-right">{flankY} nt</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-700 w-24">Flank X</label>
          <input type="range" min={0} max={1000} step={10} value={flankX}
                 onChange={(e)=>setFlankX(Number(e.target.value))}/>
          <span className="text-xs text-slate-600 w-12 text-right">{flankX} nt</span>
        </div>

        <div className="flex-1" />
        <div className="flex gap-6">
          <label className="text-sm">
            <div className="text-slate-700 mb-1">Annotations CSV</div>
            <input type="file" accept=".csv" onChange={async (e)=>{
              const f=e.target.files?.[0]; if (!f) return;
              setAnnotations(parseAnnoCSV(await f.text()));
            }}/>
          </label>
          <label className="text-sm">
            <div className="text-slate-700 mb-1">Contacts (.bed or .csv)</div>
            <input type="file" accept=".bed,.csv" onChange={onContactsFile}/>
          </label>
        </div>
      </div>

      {/* Multi-panel heatmaps */}
      <div className="rounded-lg border bg-white overflow-x-auto">
        <svg id="pairmap-svg" width={W} height={H} style={{ display: "block" }}>
          <defs>
            <style>{`text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#334155;font-size:10px}`}</style>
          </defs>

          {mats.map((m, i) => {
            const left = pad + i * panelW;
            const top = 30;

            const cw = panelW - 60;
            const ch = panelH - 60;
            const cellW = cw / m.bins_x;
            const cellH = ch / m.bins_y;

            return (
              <g key={i} transform={`translate(${left},${top})`}>
                {/* frame */}
                <rect x={30} y={10} width={cw} height={ch} fill="#fff" stroke="#222" strokeWidth={1} />

                {/* cells (fixed VMAX) */}
                {m.mat.map((row, yy) =>
                  row.map((v, xx) => {
                    const val = Math.max(0, Math.min(VMAX, v));
                    const t = val / VMAX;
                    const col = `rgba(37,99,235,${t})`; // Blues
                    return (
                      <rect
                        key={`${yy}-${xx}`}
                        x={30 + xx * cellW}
                        y={10 + yy * cellH}
                        width={cellW}
                        height={cellH}
                        fill={col}
                      />
                    );
                  })
                )}

                {/* X ticks: -flankX, start, end, +flankX */}
                {(() => {
                  const gx_len = m.x_len_bins;
                  const gx_s = flankX / BIN;
                  const gx_e = gx_s + gx_len - 1;
                  const xticks = [0, gx_s, gx_e, m.bins_x - 1];
                  const xlbls = [`-${flankX}`, "start", "end", `+${flankX}`];
                  return xticks.map((b, j) => (
                    <g key={j} transform={`translate(${30 + (b / m.bins_x) * cw},${10 + ch})`}>
                      <line x1={0} y1={0} x2={0} y2={6} stroke="#222" />
                      <text x={0} y={18} textAnchor="middle">{xlbls[j]}</text>
                    </g>
                  ));
                })()}

                {/* Y ticks: -flankY, start, end, +flankY */}
                {(() => {
                  const gy_len = m.y_len_bins;
                  const gy_s = flankY / BIN;
                  const gy_e = gy_s + gy_len - 1;
                  const yticks = [0, gy_s, gy_e, m.bins_y - 1];
                  const ylbls = [`-${flankY}`, "start", "end", `+${flankY}`];
                  return yticks.map((b, j) => (
                    <g key={j} transform={`translate(${30},${10 + (b / m.bins_y) * ch})`}>
                      <line x1={-6} y1={0} x2={0} y2={0} stroke="#222" />
                      <text x={-9} y={3} textAnchor="end">{ylbls[j]}</text>
                    </g>
                  ));
                })()}

                {/* axis labels */}
                <text x={30 + cw / 2} y={ch + 36} textAnchor="middle">{m.gene} (5′→3′)</text>
                <text transform={`translate(10,${10 + ch / 2}) rotate(-90)`} textAnchor="middle">
                  {cf(primaryRNA)} (5′→3′)
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {!yAnn && (
        <div className="mt-2 text-xs text-amber-700">
          Upload annotations and ensure the primary RNA exists (names are case-insensitive).
        </div>
      )}
    </div>
  );
}
