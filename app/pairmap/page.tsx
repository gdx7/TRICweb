"use client";

import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { PRESETS } from "@/lib/presets";

type FeatureType =
  | "CDS" | "5'UTR" | "3'UTR" | "ncRNA" | "tRNA" | "rRNA" | "sRNA" | "hkRNA" | "sponge" | string;

type Annotation = {
  gene_name: string;
  start: number;
  end: number;
  feature_type?: FeatureType;
  strand?: string;
  chromosome?: string;
};

const cf = (s: string) => String(s || "").trim().toLowerCase();
const cap1 = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
function formatGeneName(name: string, type?: FeatureType): { text: string; italic: boolean } {
  const t = (type || "CDS") as FeatureType;
  return (t === "sRNA" || t === "ncRNA" || t === "sponge") ? { text: cap1(name), italic: false } : { text: name, italic: true };
}

function exportSVG(svgId: string, name: string) {
  const el = document.getElementById(svgId) as SVGSVGElement | null;
  if (!el) return;
  const clone = el.cloneNode(true) as SVGSVGElement;
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = 'text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#334155;font-size:10px}';
  defs.appendChild(style);
  clone.insertBefore(defs, clone.firstChild);
  const ser = new XMLSerializer(); const str = ser.serializeToString(clone);
  const blob = new Blob([str], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name.endsWith(".svg") ? name : `${name}.svg`; a.click(); URL.revokeObjectURL(url);
}

// --------- parsing ----------
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
function parseContactsText(txt: string): Array<[number, number]> {
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const rows: Array<[number, number]> = [];
  const body = lines.filter(l => !/^track|^browser/i.test(l));
  for (const line of body) {
    const parts = line.split(/\s+|,/).filter(Boolean);
    if (parts.length >= 3 && !isNaN(Number(parts[1])) && !isNaN(Number(parts[2]))) {
      rows.push([Number(parts[1]), Number(parts[2])]);
    } else if (parts.length >= 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
      rows.push([Number(parts[0]), Number(parts[1])]);
    }
  }
  return rows;
}

// ---------- simulated data ----------
function simulateAnnotations(nGenes = 160): Annotation[] {
  const rng = ((s: number) => () => (s = (s * 1664525 + 1013904223) % 0xffffffff) / 0xffffffff)(7);
  const genomeLen = 4_600_000;
  const out: Annotation[] = [];
  for (let i = 1; i <= nGenes; i++) {
    const start = Math.floor(rng() * (genomeLen - 2000)) + 1;
    const len = Math.max(150, Math.floor(rng() * 1500));
    const end = Math.min(start + len, genomeLen);
    out.push({ gene_name: `gene${i}`, start, end, feature_type: "CDS", strand: rng() > 0.5 ? "+" : "-", chromosome: "chr" });
    if (rng() > 0.5) out.push({ gene_name: `5'gene${i}`, start: Math.max(1, start - 200), end: start + 120, feature_type: "5'UTR", strand: "+", chromosome: "chr" });
    if (rng() > 0.5) out.push({ gene_name: `3'gene${i}`, start: end - 120, end: Math.min(end + 180, genomeLen), feature_type: "3'UTR", strand: "+", chromosome: "chr" });
  }
  for (let i = 1; i <= Math.floor(nGenes * 0.10); i++) {
    const start = Math.floor(rng() * (genomeLen - 400)) + 1;
    const end = Math.min(start + 200 + Math.floor(rng() * 250), genomeLen);
    const t = rng() < 0.6 ? "sRNA" : "ncRNA";
    out.push({ gene_name: `${t.toLowerCase()}${i}`, start, end, feature_type: t, strand: "+", chromosome: "chr" });
  }
  // ensure a few known demo names exist
  out.push({ gene_name: "gene1", start: 200000, end: 200800, feature_type: "CDS", strand: "+", chromosome: "chr" });
  out.push({ gene_name: "gene2", start: 500000, end: 500700, feature_type: "CDS", strand: "-", chromosome: "chr" });
  out.push({ gene_name: "5'gene3", start: 800000, end: 800120, feature_type: "5'UTR", strand: "+", chromosome: "chr" });
  return out;
}
function simulateContacts(ann: Annotation[], n = 12000): Array<[number, number]> {
  const rng = ((s: number) => () => (s = (s * 1103515245 + 12345) % 0x7fffffff) / 0x7fffffff)(11);
  const genomeLen = 4_600_000;
  const rows: Array<[number, number]> = [];

  const pick = (name: string) => ann.find(a => a.gene_name.toLowerCase() === name.toLowerCase());
  const g1 = pick("gene1"), g2 = pick("gene2"), g3 = pick("5'gene3");

  // background noise
  for (let i = 0; i < n; i++) {
    const a = Math.floor(rng() * genomeLen);
    const b = Math.floor(rng() * genomeLen);
    rows.push([a, b]);
  }

  // concentrated interactions near demo pairs (to show hotspots)
  function sprinkle(a: Annotation | undefined, b: Annotation | undefined, m = 4000) {
    if (!a || !b) return;
    for (let i = 0; i < m; i++) {
      const ca = Math.floor((a.start + a.end) / 2 + (rng() - 0.5) * 200);
      const cb = Math.floor((b.start + b.end) / 2 + (rng() - 0.5) * 200);
      rows.push([ca, cb]);
    }
  }
  sprinkle(g1, g2, 3500);
  sprinkle(g1, g3, 2200);

  return rows;
}

export default function PairMapPage() {
  // Simulated data default
  const simAnno = useMemo(() => simulateAnnotations(160), []);
  const [annotations, setAnnotations] = useState<Annotation[]>(simAnno);
  const [contacts, setContacts] = useState<Array<[number, number]>>(simulateContacts(simAnno));

  const [loadedAnnoName, setLoadedAnnoName] = useState<string | null>(null);
  const [loadedContactsName, setLoadedContactsName] = useState<string | null>(null);

  const [primaryRNA, setPrimaryRNA] = useState("gene1");
  const [secondaryList, setSecondaryList] = useState("gene2, 5'gene3, gene4");

  const [flankY, setFlankY] = useState(300);
  const [flankX, setFlankX] = useState(300);
  const [binSize, setBinSize] = useState(10);
  const [vmax, setVmax] = useState(10);

  // read y/x from query string (no useSearchParams)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const y = sp.get("y"); const x = sp.get("x");
    if (y) setPrimaryRNA(y);
    if (x) setSecondaryList(x);
  }, []);

  const annoByName = useMemo(() => {
    const m = new Map<string, Annotation>();
    for (const a of annotations) m.set(cf(a.gene_name), a);
    return m;
  }, [annotations]);

  const primaryKey = cf(primaryRNA);
  const yAnn = annoByName.get(primaryKey);

  const xInputsRaw = useMemo(() => secondaryList.split(/[, \s]+/).map(s => s.trim()).filter(Boolean), [secondaryList]);
  const xAnns = xInputsRaw
    .map((label) => ({ label, key: cf(label), ann: annoByName.get(cf(label)) }))
    .filter((d) => d.ann) as { label: string; key: string; ann: Annotation }[];

  async function onAnnoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const txt = await f.text();
    setAnnotations(parseAnnoCSV(txt));
    setLoadedAnnoName(f.name);
  }
  async function onContactsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const txt = await f.text();
    setContacts(parseContactsText(txt));
    setLoadedContactsName(f.name);
  }
  async function loadPresetAnno(path: string, label?: string) {
    const res = await fetch(path);
    const text = await res.text();
    setAnnotations(parseAnnoCSV(text));
    if (label) setLoadedAnnoName(label);
  }
  async function loadContactsFromURL(url: string) {
    const res = await fetch(url);
    const text = await res.text();
    setContacts(parseContactsText(text));
    setLoadedContactsName(new URL(url).pathname.split("/").pop() || "contacts.bed");
  }

  const mats = useMemo(() => {
    if (!yAnn) return [];
    const wy_s = Math.max(1, yAnn.start - flankY);
    const wy_e = yAnn.end + flankY;
    const len_y = wy_e - wy_s + 1;
    const bins_y = Math.ceil(len_y / binSize);

    function toBin(coord: number, ws: number, we: number, strand?: string) {
      const plus = strand !== "-";
      return plus ? Math.floor((coord - ws) / binSize) : Math.floor((we - coord) / binSize);
    }

    return xAnns.map(({ label, ann }, i) => {
      const wx_s = Math.max(1, ann.start - flankX);
      const wx_e = ann.end + flankX;
      const len_x = wx_e - wx_s + 1;
      const bins_x = Math.ceil(len_x / binSize);

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
        label,
        typeX: ann.feature_type as FeatureType | undefined,
        mat,
        bins_x, bins_y,
        y_len_bins: Math.floor((yAnn.end - yAnn.start) / binSize),
        x_len_bins: Math.floor((ann.end - ann.start) / binSize),
        paletteIndex: i % 6,
      };
    });
  }, [contacts, xAnns, yAnn, flankX, flankY, binSize]);

  const panelW = 360, panelH = 300;
  const W = Math.max(panelW * Math.max(1, mats.length) + 20 * 2, 760);
  const H = panelH + 120;

  function colorFrom(val: number, vmaxVal: number, paletteIndex: number) {
    const t = Math.max(0, Math.min(1, val / Math.max(1, vmaxVal)));
    const hues = [0, 120, 220, 30, 280, 0];
    const hue = hues[paletteIndex]!;
    if (paletteIndex === 5) { const g = Math.round(230 - t * 200); return `rgb(${g},${g},${g})`; }
    return `hsla(${hue}, 75%, 50%, ${Math.pow(t, 0.85)})`;
  }

  const dispY = formatGeneName(primaryRNA, yAnn?.feature_type);

  return (
    <div className="mx-auto max-w-[1500px] p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">pairMAP</h1>
        <button onClick={() => exportSVG("pairmap-svg", "pairMAP")} className="text-xs px-2 py-1 border rounded bg-white hover:bg-slate-50">
          Export SVG
        </button>
      </div>

      {/* Inputs */}
      <div className="flex flex-wrap gap-6 items-end mb-4">
        <div>
          <div className="text-sm text-slate-700 mb-1">Primary RNA (Y-axis, case-insensitive)</div>
          <input className="border rounded px-3 py-2 w-[260px]" value={primaryRNA} onChange={(e) => setPrimaryRNA(e.target.value)} />
        </div>
        <div>
          <div className="text-sm text-slate-700 mb-1">Secondary RNAs (comma/space, case-insensitive)</div>
          <input className="border rounded px-3 py-2 w-[420px]" value={secondaryList} onChange={(e) => setSecondaryList(e.target.value)} />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-700 w-20">Flank Y</label>
          <input type="range" min={0} max={1000} step={10} value={flankY} onChange={(e)=>setFlankY(Number(e.target.value))}/>
          <span className="text-xs text-slate-600 w-14 text-right">{flankY} nt</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-700 w-20">Flank X</label>
          <input type="range" min={0} max={1000} step={10} value={flankX} onChange={(e)=>setFlankX(Number(e.target.value))}/>
          <span className="text-xs text-slate-600 w-14 text-right">{flankX} nt</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-700 w-20">Bin size</label>
          <input type="range" min={5} max={50} step={5} value={binSize} onChange={(e)=>setBinSize(Number(e.target.value))}/>
          <span className="text-xs text-slate-600 w-20 text-right">{binSize} nt/bin</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-700 w-20">Vmax</label>
          <input type="range" min={1} max={50} step={1} value={vmax} onChange={(e)=>setVmax(Number(e.target.value))}/>
          <span className="text-xs text-slate-600 w-10 text-right">{vmax}</span>
        </div>

        <div className="flex-1" />
        <div className="flex gap-6 items-center">
          <label className="text-sm">
            <div className="text-slate-700 mb-1">Annotations CSV</div>
            <div className="flex items-center gap-2">
              <select
                className="border rounded px-2 py-1 text-xs"
                defaultValue=""
                onChange={(e) => {
                  const map: Record<string, string> = {
                    "preset-ec": "/Anno_EC.csv",
                    "preset-ss": "/Anno_SS.csv",
                    "preset-mx": "/Anno_MX.csv",
                    "preset-sa": "/Anno_SA.csv",
                    "preset-bs": "/Anno_BS.csv",
                  };
                  const v = e.target.value;
                  if (map[v]) loadPresetAnno(map[v], map[v].slice(1));
                }}
              >
                <option value="" disabled>Select preset…</option>
                <option value="preset-ec">Anno_EC.csv</option>
                <option value="preset-ss">Anno_SS.csv</option>
                <option value="preset-mx">Anno_MX.csv</option>
                <option value="preset-sa">Anno_SA.csv</option>
                <option value="preset-bs">Anno_BS.csv</option>
              </select>
              <input type="file" accept=".csv" onChange={onAnnoFile}/>
            </div>
            <div className="text-xs text-slate-500 mt-1">{loadedAnnoName || "(using simulated annotations)"}</div>
          </label>

          <label className="text-sm">
            <div className="text-slate-700 mb-1">Chimeras (.bed or .csv)</div>
            <div className="flex items-center gap-2">
              <select className="border rounded px-2 py-1 text-xs" defaultValue="" onChange={(e) => { const u = e.target.value; if (u) loadContactsFromURL(u); }}>
                <option value="" disabled>Select preset…</option>
                {PRESETS.chimeras.map(p => (<option key={p.url} value={p.url}>{p.label}</option>))}
              </select>
              <input type="file" accept=".bed,.csv" onChange={onContactsFile}/>
            </div>
            <div className="text-xs text-slate-500 mt-1">{loadedContactsName || "(using simulated chimeras)"}</div>
          </label>
        </div>
      </div>

      {/* Multi-panel heatmaps */}
      <div className="rounded-lg border bg-white overflow-x-auto">
        <svg id="pairmap-svg" width={W} height={H} style={{ display: "block" }}>
          <defs><style>{`text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#334155;font-size:10px}`}</style></defs>

          {mats.map((m, i) => {
            const left = 10 + i * 360;
            const top = 28;
            const cw = 360 - (54 + 30);
            const ch = 300 - (10 + 56);
            const cellW = cw / m.bins_x;
            const cellH = ch / m.bins_y;
            const yPix = (bin: number) => 10 + (m.bins_y - 1 - bin) * cellH;
            const dispX = formatGeneName(m.label, m.typeX);

            return (
              <g key={i} transform={`translate(${left},${top})`}>
                <rect x={54} y={10} width={cw} height={ch} fill="#fff" stroke="#222" strokeWidth={1} />
                {m.mat.map((row, yy) => row.map((v, xx) => (
                  <rect key={`${yy}-${xx}`} x={54 + xx * cellW} y={yPix(yy)} width={cellW} height={cellH} fill={colorFrom(v, vmax, m.paletteIndex)} />
                )))}
                {(() => {
                  const gx_len = m.x_len_bins;
                  const gx_s = Math.floor(flankX / binSize);
                  const gx_e = gx_s + gx_len - 1;
                  const xticks = [0, gx_s, gx_e, m.bins_x - 1];
                  const xlbls = [`-${flankX}`, "start", "end", `+${flankX}`];
                  return xticks.map((b, j) => (
                    <g key={j} transform={`translate(${54 + (b / m.bins_x) * cw},${10 + ch})`}>
                      <line y2={6} stroke="#222" />
                      <text y={18} textAnchor="middle">{xlbls[j]}</text>
                    </g>
                  ));
                })()}
                {(() => {
                  const gy_len = m.y_len_bins;
                  const gy_s = Math.floor(flankY / binSize);
                  const gy_e = gy_s + gy_len - 1;
                  const yticks = [0, gy_s, gy_e, m.bins_y - 1];
                  const ylbls = [`-${flankY}`, "start", "end", `+${flankY}`];
                  return yticks.map((b, j) => (
                    <g key={j} transform={`translate(${54},${yPix(b)})`}>
                      <line x1={-6} x2={0} y1={0} y2={0} stroke="#222" />
                      <text x={-10} y={3} textAnchor="end">{ylbls[j]}</text>
                    </g>
                  ));
                })()}
                <text x={54 + cw / 2} y={ch + 38} textAnchor="middle" style={{ fontStyle: dispX.italic ? "italic" : "normal" }}>{dispX.text} (5′→3′)</text>
                <text transform={`translate(${54 - 34},${10 + ch / 2}) rotate(-90)`} textAnchor="middle" style={{ fontStyle: dispY.italic ? "italic" : "normal" }}>{dispY.text} (5′→3′)</text>
              </g>
            );
          })}
        </svg>
      </div>

      {!yAnn && (<div className="mt-2 text-xs text-amber-700">Upload annotations and ensure the primary RNA exists (names are case-insensitive).</div>)}

      <section className="mx-auto max-w-7xl p-4">
        <div className="border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold">pairMAP quick guide</div>
            <a href="/PairHelp.png" download className="text-xs text-blue-600 hover:underline">Download PNG</a>
          </div>
          <img src="/PairHelp.png" alt="Annotated pairMAP screenshot with example plots and TRIC-seq workflow." loading="lazy" className="mt-2 w-full h-auto rounded-lg border" />
        </div>
      </section>
    </div>
  );
}
