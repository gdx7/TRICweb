"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import Papa from "papaparse";
import { PRESETS } from "@/lib/presets";

/* ---------------- Types ---------------- */
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

/* ---------------- Helpers ---------------- */
const cf = (s: string) => String(s || "").trim().toLowerCase();
const cap1 = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
function formatGeneName(name: string, type?: FeatureType): { text: string; italic: boolean } {
  const t = (type || "CDS") as FeatureType;
  if (t === "sRNA" || t === "ncRNA" || t === "sponge") return { text: cap1(name), italic: false };
  return { text: name, italic: true };
}
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

// Parse contacts from raw text (supports .bed, 2-col CSV/TSV)
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

/* ---------------- Demo simulation ---------------- */
function simulateAnnotations(nGenes = 80): Annotation[] {
  const rng = ((s: number) => () => (s = (s * 1103515245 + 12345) % 0xffffffff) / 0xffffffff)(17);
  const genome = 4_000_000;
  const out: Annotation[] = [];
  for (let i = 1; i <= nGenes; i++) {
    const start = Math.floor(rng() * (genome - 1200)) + 1;
    const len = 300 + Math.floor(rng() * 900);
    const end = Math.min(start + len, genome);
    out.push({ gene_name: `gene${i}`, start, end, feature_type: "CDS", strand: rng() > 0.5 ? "+" : "-" });
    if (rng() > 0.5) out.push({ gene_name: `5'gene${i}`, start: Math.max(1, start - 120), end: start + 60, feature_type: "5'UTR", strand: "+" });
    if (rng() > 0.5) out.push({ gene_name: `3'gene${i}`, start: end - 60, end: Math.min(end + 120, genome), feature_type: "3'UTR", strand: "+" });
  }
  for (let i = 1; i <= Math.floor(nGenes * 0.1); i++) {
    const start = Math.floor(rng() * (genome - 350)) + 1;
    const end = start + 200 + Math.floor(rng() * 120);
    out.push({ gene_name: `srna${i}`, start, end, feature_type: "sRNA", strand: "+", chromosome: "chr" });
  }
  return out;
}

function simulateContacts(ann: Annotation[], pairs: Array<[string, string]>): Array<[number, number]> {
  // Build dense clusters between selected gene pairs
  const rng = ((s: number) => () => (s = (s * 48271) % 0x7fffffff) / 0x7fffffff)(99);
  const contacts: Array<[number, number]> = [];
  function jitter(a: number, b: number) { return Math.floor(a + (b - a) * rng()); }

  for (const [A, B] of pairs) {
    const a = ann.find(x => x.gene_name === A);
    const b = ann.find(x => x.gene_name === B);
    if (!a || !b) continue;
    const aS = Math.max(1, a.start - 300), aE = a.end + 300;
    const bS = Math.max(1, b.start - 300), bE = b.end + 300;

    // Dense diagonal-ish hotspot + spread
    for (let k = 0; k < 1400; k++) {
      const ax = jitter(aS, aE);
      const bx = Math.min(bE, Math.max(bS, ax + Math.floor((rng() - 0.5) * 80)));
      contacts.push([ax, bx]);
      contacts.push([bx, ax]); // make it bidirectional-rich
    }
    // Background
    for (let k = 0; k < 400; k++) {
      contacts.push([jitter(aS, aE), jitter(bS, bE)]);
    }
  }
  return contacts;
}

/* ---------------- Page ---------------- */
export default function PairMapPage() {
  // Demo defaults (synthetic)
  const demoAnno = useMemo(() => simulateAnnotations(90), []);
  const demoContacts = useMemo(
    () => simulateContacts(demoAnno, [["gene10", "gene16"], ["gene10", "gene32"], ["srna3", "5'gene28"]]),
    [demoAnno]
  );

  const [annotations, setAnnotations] = useState<Annotation[]>(demoAnno);
  const [contacts, setContacts] = useState<Array<[number, number]>>(demoContacts);

  const [loadedAnnoName, setLoadedAnnoName] = useState<string | null>(null);
  const [loadedContactsName, setLoadedContactsName] = useState<string | null>(null);

  // Inputs (synthetic by default)
  const [primaryRNA, setPrimaryRNA] = useState("gene10");
  const [secondaryList, setSecondaryList] = useState("gene16, gene32");

  // Sliders
  const [flankY, setFlankY] = useState(300);
  const [flankX, setFlankX] = useState(300);
  const [binSize, setBinSize] = useState(10);
  const [vmax, setVmax] = useState(10);

  // remember presets; also read from query/localStorage
  function remember(k: string, v: string) { try { localStorage.setItem(k, v); } catch {} }
  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    const a = qs.get("anno");
    const c = qs.get("chim");
    const y = qs.get("primary");
    const xs = qs.get("genes");
    if (a) loadPresetAnno(a, a.split("/").pop());
    if (c) loadContactsFromURL(c);
    if (y) setPrimaryRNA(y);
    if (xs) setSecondaryList(xs);
    if (!a && !c) {
      const la = localStorage.getItem("TRIC_annoURL");
      const lc = localStorage.getItem("TRIC_chimURL");
      const laLabel = localStorage.getItem("TRIC_annoLabel") || undefined;
      if (la) loadPresetAnno(la, laLabel);
      if (lc) loadContactsFromURL(lc);
    }
  }, []);

  // case-insensitive annotation index
  const annoByName = useMemo(() => {
    const m = new Map<string, Annotation>();
    for (const a of annotations) m.set(cf(a.gene_name), a);
    return m;
  }, [annotations]);

  const primaryKey = cf(primaryRNA);
  const yAnn = annoByName.get(primaryKey);

  const xInputsRaw = useMemo(
    () => secondaryList.split(/[, \s]+/).map(s => s.trim()).filter(Boolean),
    [secondaryList]
  );
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

  async function loadPresetAnno(path: string | URL, label?: string) {
    const res = await fetch(path.toString());
    const text = await res.text();
    setAnnotations(parseAnnoCSV(text));
    setLoadedAnnoName(label || path.toString().split("/").pop() || "annotations.csv");
    remember("TRIC_annoURL", path.toString());
    remember("TRIC_annoLabel", label || "");
  }

  async function loadContactsFromURL(url: string) {
    const res = await fetch(url);
    const text = await res.text();
    setContacts(parseContactsText(text));
    setLoadedContactsName(new URL(url).pathname.split("/").pop() || "contacts.bed");
    remember("TRIC_chimURL", url);
  }

  // Build one heatmap per X-gene
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

  // Layout
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
          <div className="text-sm text-slate-700 mb-1">Primary RNA (Y-axis)</div>
          <input
            className="border rounded px-3 py-2 w-[260px]"
            value={primaryRNA}
            onChange={(e) => setPrimaryRNA(e.target.value)}
            placeholder="e.g., gene10"
          />
        </div>
        <div>
          <div className="text-sm text-slate-700 mb-1">Secondary RNAs (comma/space)</div>
          <input
            className="border rounded px-3 py-2 w-[420px]"
            value={secondaryList}
            onChange={(e) => setSecondaryList(e.target.value)}
            placeholder="e.g., gene16, gene32"
          />
        </div>

        {/* Flank sliders */}
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

        {/* Bin size + Vmax */}
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
          {/* Annotations */}
          <label className="text-sm">
            <div className="text-slate-700 mb-1">Annotations CSV</div>
            <div className="flex items-center gap-2">
              <select
                className="border rounded px-2 py-1 text-xs"
                defaultValue=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) loadPresetAnno(v, v.split("/").pop() || "annotations.csv");
                }}
              >
                <option value="" disabled>Select preset…</option>
                <option value="/Anno_EC.csv">Anno_EC.csv</option>
                <option value="/Anno_SS.csv">Anno_SS.csv</option>
                <option value="/Anno_MX.csv">Anno_MX.csv</option>
                <option value="/Anno_SA.csv">Anno_SA.csv</option>
                <option value="/Anno_BS.csv">Anno_BS.csv</option>
              </select>
              <input type="file" accept=".csv" onChange={onAnnoFile}/>
            </div>
            <div className="text-xs text-slate-500 mt-1">{loadedAnnoName || "(using simulated annotations)"}</div>
          </label>

          {/* Chimeras */}
          <label className="text-sm">
            <div className="text-slate-700 mb-1">Chimeras (.bed or .csv)</div>
            <div className="flex items-center gap-2">
              <select
                className="border rounded px-2 py-1 text-xs"
                defaultValue=""
                onChange={(e) => { const u = e.target.value; if (u) loadContactsFromURL(u); }}
              >
                <option value="" disabled>Select preset…</option>
                {PRESETS.chimeras.map(p => (
                  <option key={p.url} value={p.url}>{p.label}</option>
                ))}
              </select>
              <input type="file" accept=".bed,.csv" onChange={onContactsFile}/>
            </div>
            <div className="text-xs text-slate-500 mt-1">{loadedContactsName || "(using simulated contacts)"}</div>
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
            const left = 10 + i * panelW;
            const top = 28;

            const cw = panelW - (54 + 30);
            const ch = panelH - (10 + 56);
            const cellW = cw / m.bins_x;
            const cellH = ch / m.bins_y;

            const yPix = (bin: number) => 10 + (m.bins_y - 1 - bin) * cellH;

            const dispX = formatGeneName(m.label, m.typeX);

            return (
              <g key={i} transform={`translate(${left},${top})`}>
                {/* frame */}
                <rect x={54} y={10} width={cw} height={ch} fill="#fff" stroke="#222" strokeWidth={1} />

                {/* cells with per-panel palette + vmax (Y inverted) */}
                {m.mat.map((row, yy) =>
                  row.map((v, xx) => (
                    <rect
                      key={`${yy}-${xx}`}
                      x={54 + xx * cellW}
                      y={yPix(yy)}
                      width={cellW}
                      height={cellH}
                      fill={colorFrom(v, vmax, m.paletteIndex)}
                    />
                  ))
                )}

                {/* X ticks */}
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

                {/* Y ticks */}
                {(() => {
                  const gy_len = m.y_len_bins;
                  const gy_s = Math.floor(flankY / binSize);
                  const gy_e = gy_s + gy_len - 1;
                  const yticks = [0, gy_s, gy_e, m.bins_y - 1];
                  const ylbls = [`-${flankY}`, "start", "end", `+${flankY}`];
                  return yticks.map((b, j) => (
                    <g key={j} transform={`translate(${54},${yPix(b)})`}>
                      <line x1={-6} y1={0} x2={0} y2={0} stroke="#222" />
                      <text x={-10} y={3} textAnchor="end">{ylbls[j]}</text>
                    </g>
                  ));
                })()}

                {/* axis labels */}
                <text x={54 + cw / 2} y={ch + 38} textAnchor="middle" style={{ fontStyle: dispX.italic ? "italic" : "normal" }}>
                  {dispX.text} (5′→3′)
                </text>
                <text transform={`translate(${54 - 34},${10 + ch / 2}) rotate(-90)`} textAnchor="middle" style={{ fontStyle: dispY.italic ? "italic" : "normal" }}>
                  {dispY.text} (5′→3′)
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {!yAnn && (
        <div className="mt-2 text-xs text-amber-700">
          Upload annotations (via dropdown or file) and ensure the primary RNA exists (names are case-insensitive).
        </div>
      )}
      {/* Quick guide image retained */}
      <section className="mx-auto max-w-7xl p-4">
        <div className="border rounded-2xl p-4 shadow-sm">
          <div className="font-semibold">pairMAP quick guide</div>
          <img
            src="/PairHelp.png"
            alt="Annotated pairMAP screenshot with example plots and TRIC-seq workflow."
            loading="lazy"
            className="mt-2 w-full h-auto rounded-lg border"
          />
        </div>
      </section>
    </div>
  );
}
