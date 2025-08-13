"use client";

import React, { useMemo, useState, useRef } from "react";
import Papa from "papaparse";

type FeatureType =
  | "CDS"
  | "5'UTR"
  | "3'UTR"
  | "ncRNA"
  | "tRNA"
  | "rRNA"
  | "sRNA"
  | "hkRNA"
  | "sponge"
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
  x: number;       // genomic midpoint (absolute)
  start: number;   // genomic start
  end: number;     // genomic end
  y: number;       // capped OR for plotting
  rawY: number;    // true odds_ratio
  counts: number;  // deduped counts (max across orientations)
  type: FeatureType;
  distance: number;
};

const FEATURE_COLORS: Record<FeatureType, string> = {
  ncRNA: "#A40194",
  sRNA: "#A40194",
  sponge: "#F12C2C",
  tRNA: "#82F778",
  hkRNA: "#999999",
  rRNA: "#999999",
  CDS: "#F78208",
  "5'UTR": "#76AAD7",
  "3'UTR": "#0C0C0C",
};
const pickColor = (ft?: FeatureType) => FEATURE_COLORS[ft || "CDS"] || "#F78208";

function simulateData(nGenes = 500) {
  const rng = ((seed: number) => () => (seed = (seed * 1664525 + 1013904223) % 0xffffffff) / 0xffffffff)(42);
  const ann: Annotation[] = [];
  const genomeLen = 4_641_652;

  // Create CDS genes gene1..geneN and optional UTR entries 5'geneX / 3'geneX
  for (let i = 1; i <= nGenes; i++) {
    const start = Math.floor(rng() * (genomeLen - 2000)) + 1;
    const len = Math.max(150, Math.floor(rng() * 1500));
    const end = Math.min(start + len, genomeLen);
    ann.push({ gene_name: `gene${i}`, start, end, feature_type: "CDS", strand: rng() > 0.5 ? "+" : "-", chromosome: "chr" });

    if (rng() > 0.4) {
      const u5s = Math.max(1, start - Math.floor(rng() * 150));
      const u5e = Math.min(start + Math.floor(len * 0.2), genomeLen);
      ann.push({ gene_name: `5'gene${i}`, start: u5s, end: u5e, feature_type: "5'UTR", strand: "+", chromosome: "chr" });
    }
    if (rng() > 0.4) {
      const u3s = Math.max(end - Math.floor(len * 0.2), 1);
      const u3e = Math.min(end + Math.floor(rng() * 150), genomeLen);
      ann.push({ gene_name: `3'gene${i}`, start: u3s, end: u3e, feature_type: "3'UTR", strand: "+", chromosome: "chr" });
    }
  }

  // Add some sRNAs/ncRNAs/sponges with generic names
  for (let i = 1; i <= Math.floor(nGenes * 0.08); i++) {
    const start = Math.floor(rng() * (genomeLen - 400)) + 1;
    const end = Math.min(start + 200 + Math.floor(rng() * 200), genomeLen);
    const t = rng() < 0.5 ? "sRNA" : "ncRNA";
    ann.push({ gene_name: `${t.toLowerCase()}${i}`, start, end, feature_type: t, strand: "+", chromosome: "chr" });
  }
  for (let i = 1; i <= Math.floor(nGenes * 0.02); i++) {
    const start = Math.floor(rng() * (genomeLen - 400)) + 1;
    const end = Math.min(start + 200 + Math.floor(rng() * 200), genomeLen);
    ann.push({ gene_name: `sponge${i}`, start, end, feature_type: "sponge", strand: "+", chromosome: "chr" });
  }

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

  // Random edges
  for (let k = 0; k < nGenes * 2; k++) {
    const a = genes[Math.floor(rng() * genes.length)];
    let b = genes[Math.floor(rng() * genes.length)];
    if (a === b) continue;
    addEdge(a, b, 1);
  }

  // Pick a couple of sRNAs/ncRNAs as hubs in the simulation (generic names)
  const sLike = ann.filter(a => a.feature_type === "sRNA" || a.feature_type === "ncRNA").map(a => a.gene_name);
  const pick = (n: number) => Array.from({ length: n }, () => genes[Math.floor(rng() * genes.length)]);
  if (sLike.length > 0) pick(60).forEach(g => addEdge(sLike[Math.floor(rng() * sLike.length)], g, 4));

  return { annotations: ann, pairs };
}

function symlog(y: number, linthresh = 10, base = 10) {
  const s = Math.sign(y);
  const a = Math.abs(y);
  return a <= linthresh ? s * (a / linthresh) : s * (1 + Math.log(a / linthresh) / Math.log(base));
}

// ---- display helpers ----
const cap1 = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function formatGeneName(name: string, type?: FeatureType): { text: string; italic: boolean } {
  const t = type || "CDS";
  if (t === "sRNA" || t === "ncRNA" || t === "sponge") {
    // Non-italic, TitleCase first letter (e.g., sroC -> SroC)
    return { text: cap1(name), italic: false };
  }
  if (t === "5'UTR" || t === "3'UTR") {
    const m = name.match(/^(5'|3')(.+)$/i);
    if (m) return { text: `${m[1]}${cap1(m[2])}`, italic: true };
    return { text: cap1(name), italic: true };
  }
  // CDS/tRNA/rRNA/hkRNA -> italic, first letter capitalized (argT -> ArgT)
  return { text: cap1(name), italic: true };
}

const combinedLabel = (ft: FeatureType): { label: string; italic: boolean } => {
  if (ft === "sRNA" || ft === "ncRNA") return { label: "sRNA/ncRNA", italic: false };
  if (ft === "sponge") return { label: "Sponge", italic: false };
  if (ft === "rRNA" || ft === "hkRNA") return { label: "rRNA/hkRNA", italic: false };
  // keep canonical case for others in legend
  return { label: ft, italic: false };
};

export default function Page() {
  const [data, setData] = useState(() => simulateData(500));
  const [focal, setFocal] = useState<string>("srna1"); // generic simulated sRNA by default
  const [minCounts, setMinCounts] = useState(5);
  const [minDistance, setMinDistance] = useState(5000);
  const [yCap, setYCap] = useState(5000);
  const [labelThreshold, setLabelThreshold] = useState(50);
  const [excludeTypes, setExcludeTypes] = useState<FeatureType[]>(["rRNA", "tRNA"]);
  const [query, setQuery] = useState("");
  const [highlightQuery, setHighlightQuery] = useState("");

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
    const toks = highlightQuery
      .split(/[, \n\t\r]+/).map(t => t.trim()).filter(Boolean);
    return new Set(toks);
  }, [highlightQuery]);

  // aggregate edges for focal (dedupe symmetric rows):
  // - counts: take MAX across orientations (avoid doubling)
  // - odds_ratio: take MAX
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

      const partMid = Math.floor((partAnn.start + partAnn.end) / 2);
      const focalMid = Math.floor((focalAnn.start + focalAnn.end) / 2);
      const dist = Math.abs(partMid - focalMid);

      const or = Number(e.odds_ratio) || 0;
      if (!(or > 0)) continue;

      const counts = Number(e.counts) || 0;
      const type = (ref === focal ? e.target_type : e.ref_type) || partAnn.feature_type || "CDS";

      const prev = acc.get(partner);
      if (prev) {
        prev.counts = Math.max(prev.counts, counts);
        prev.rawY = Math.max(prev.rawY, or);
        prev.y = Math.min(prev.rawY, yCap);
        prev.type = (prev.type || type) as FeatureType;
        prev.distance = Math.min(prev.distance, dist);
      } else {
        acc.set(partner, {
          partner,
          x: partMid,
          start: partAnn.start,
          end: partAnn.end,
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

  // total chimeras for focal (deduped across orientations), independent of filters
  const focalChimeraTotal = useMemo(() => {
    const edges = pairs.filter(p => (String(p.ref).trim() === focal || String(p.target).trim() === focal));
    const seen = new Map<string, number>(); // partner -> max count
    for (const e of edges) {
      const ref = String(e.ref || "").trim();
      const tgt = String(e.target || "").trim();
      const partner = ref === focal ? tgt : ref;
      if (!partner || partner === focal) continue;
      const c = Number(e.counts) || 0;
      seen.set(partner, Math.max(seen.get(partner) || 0, c));
    }
    let sum = 0;
    seen.forEach(v => { sum += v; }); // avoid MapIterator downlevel issue
    return sum;
  }, [pairs, focal]);

  // genome domain (use min start and max end to avoid X-shift)
  const genomeStart = useMemo(() => Math.min(...annotations.map(a => a.start)), [annotations]);
  const genomeEnd = useMemo(() => Math.max(...annotations.map(a => a.end)), [annotations]);
  const genomeLen = Math.max(1, genomeEnd - genomeStart);

  const focalAnn = geneIndex[focal];

  const yTicks = useMemo(() => [0, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000].filter(v => v <= yCap), [yCap]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query) return;
    const q = query.toLowerCase();
    const match =
      allGenes.find(g => g.toLowerCase() === q) ||
      allGenes.find(g => g.toLowerCase().includes(q));
    if (match) setFocal(match);
  }

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

  // Load preset Anno_EC.csv from /public via dropdown
  async function loadPresetAnno(path: string, label: string) {
    const res = await fetch(path);
    const text = await res.text();
    const parsed = parseAnnoCSV(text);
    setData(prev => ({ ...prev, annotations: parsed }));
    setLoadedAnnoName(label);
    if (parsed.length > 0) setFocal(parsed[0].gene_name);
  }

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
          <div className="text-xl font-semibold">Global interaction map</div>
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

            <div className="text-xs text-gray-600 pt-2 flex items-center gap-2">
              <span>Annotations CSV</span>
              <select
                className="border rounded px-2 py-1 text-xs"
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "preset-ec") loadPresetAnno("/Anno_EC.csv", "Anno_EC.csv");
                }}
                defaultValue=""
              >
                <option value="" disabled>Select preset…</option>
                <option value="preset-ec">Anno_EC.csv</option>
              </select>
            </div>
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
              focalChimeraTotal={focalChimeraTotal}
              partners={partners}
              genomeStart={genomeStart}
              genomeLen={genomeLen}
              yCap={yCap}
              yTicks={yTicks}
              labelThreshold={labelThreshold}
              highlightSet={highlightSet}
              onClickPartner={(name) => setFocal(name)}
            />

            <div className="mt-3 flex flex-wrap gap-4 items-center">
              <span className="text-sm font-medium">Feature types</span>
              {[
                { key: "CDS", color: pickColor("CDS"), label: "CDS" },
                { key: "5'UTR", color: pickColor("5'UTR"), label: "5'UTR" },
                { key: "3'UTR", color: pickColor("3'UTR"), label: "3'UTR" },
                { key: "sRNA/ncRNA", color: pickColor("sRNA"), label: "sRNA/ncRNA" },
                { key: "tRNA", color: pickColor("tRNA"), label: "tRNA" },
                { key: "rRNA/hkRNA", color: pickColor("rRNA"), label: "rRNA/hkRNA" },
                { key: "sponge", color: pickColor("sponge"), label: "Sponge" },
              ].map(item => (
                <span key={item.key} className="inline-flex items-center gap-2 text-xs">
                  <span
                    className="inline-block w-3 h-3 rounded-full border"
                    style={{ background: "#fff", borderColor: item.color, boxShadow: `inset 0 0 0 2px ${item.color}` }}
                  />
                  {item.label}
                </span>
              ))}
              <span className="ml-6 text-xs text-gray-500">Circle size ∝ √counts</span>
            </div>
          </section>

          <section className="border rounded-2xl p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <div className="font-semibold">
                Partners for{" "}
                <span className="text-blue-600">
                  {formatGeneName(focal, geneIndex[focal]?.feature_type).text}
                </span>{" "}
                {focalAnn && (
                  <span className="text-xs text-gray-500">
                    ({focalAnn.start}–{focalAnn.end})
                  </span>
                )}{" "}
                <span className="text-xs text-gray-400">({partners.length} shown)</span>
              </div>
              <div className="text-xs text-gray-500">sorted by odds ratio</div>
            </div>
            <div className="overflow-auto max-h-[500px]">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-white text-left text-gray-600">
                  <tr>
                    <th className="py-1 pr-4">Partner</th>
                    <th className="py-1 pr-4">Feature</th>
                    <th className="py-1 pr-4">Start</th>
                    <th className="py-1 pr-4">
                      <span><em>i</em><sub>o</sub></span> (chimeras)
                    </th>
                    <th className="py-1 pr-4">
                      odds ratio (<em>O</em><sup>f</sup>)
                    </th>
                    <th className="py-1 pr-4">Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map(row => {
                    const dispName = formatGeneName(row.partner, row.type);
                    const typeDisp = combinedLabel(row.type);
                    return (
                      <tr
                        key={row.partner}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setFocal(row.partner)}
                      >
                        <td className="py-1 pr-4 text-blue-700" style={{ fontStyle: dispName.italic ? "italic" : "normal" }}>
                          {dispName.text}
                        </td>
                        <td className="py-1 pr-4">
                          <span
                            className="inline-block w-3 h-3 rounded-full mr-1"
                            style={{ background: pickColor(row.type), border: "1px solid #333" }}
                          />
                          {typeDisp.label}
                        </td>
                        <td className="py-1 pr-4">{row.start}</td>
                        <td className="py-1 pr-4">{row.counts}</td>
                        <td className="py-1 pr-4">{row.rawY.toFixed(1)}</td>
                        <td className="py-1 pr-4">{row.distance}</td>
                      </tr>
                    );
                  })}
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
  focalChimeraTotal,
  partners,
  genomeStart,
  genomeLen,
  yCap,
  yTicks,
  labelThreshold,
  highlightSet,
  onClickPartner,
}: {
  focal: string;
  focalAnn?: Annotation;
  focalChimeraTotal: number;
  partners: ScatterRow[];
  genomeStart: number;
  genomeLen: number;
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

  // ✅ scale by [genomeStart, genomeEnd] so positions align exactly
  const xScale = (x: number) => ((x - genomeStart) / genomeLen) * innerW;
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
            const xAbs = genomeStart + (i / 5) * genomeLen;
            const labelMb = ((xAbs - genomeStart) / 1e6).toFixed(1);
            return (
              <g key={i} transform={`translate(${xScale(xAbs)},${innerH})`}>
                <line y2={6} stroke="#222" />
                <text y={20} textAnchor="middle">{labelMb} Mb</text>
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

          {/* focal marker at midpoint and with total chimeras */}
          {focalAnn && (
            <g>
              {(() => {
                const midAbs = Math.floor((focalAnn.start + focalAnn.end) / 2);
                const disp = formatGeneName(focal, focalAnn.feature_type);
                return (
                  <>
                    <line x1={xScale(midAbs)} y1={0} x2={xScale(midAbs)} y2={innerH} stroke="#444" strokeDasharray="3 3" />
                    <polygon points={`${xScale(midAbs)-6},${innerH+10} ${xScale(midAbs)+6},${innerH+10} ${xScale(midAbs)},${innerH+2}`} fill="#000" />
                    <text x={xScale(midAbs)} y={-2} textAnchor="middle" style={{ fontStyle: disp.italic ? "italic" : "normal" }}>
                      {disp.text} ({focalChimeraTotal})
                    </text>
                  </>
                );
              })()}
            </g>
          )}

          {/* points */}
          {partners.sort((a,b) => b.counts - a.counts).map((p, idx) => {
            const highlighted = highlightSet.has(p.partner);
            const face = highlighted ? "#FFEB3B" : "#FFFFFF";
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

          {/* labels (gene names) */}
          {labels.map((p, i) => {
            const disp = formatGeneName(p.partner, partners.find(q => q.partner === p.partner)?.type);
            return (
              <g key={i} transform={`translate(${xScale(p.x)},${yScale(p.y)})`}>
                <text x={6} y={-6} style={{ fontStyle: disp.italic ? "italic" : "normal" }}>
                  {disp.text}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
