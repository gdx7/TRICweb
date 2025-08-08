"use client";

import React, { useMemo, useState, useRef } from "react";
import Papa from "papaparse";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Search, RefreshCw, Info, Download } from "lucide-react";

/**
 * TRIC-seq Interactome Explorer (refined)
 * --------------------------------------------------------------
 * • sRNA and ncRNA share SAME magenta edge color
 * • Legend includes 3'UTR; placed BELOW the plot
 * • Search only (no dropdown). “Highlight genes” box for yellow fills
 * • Uses odds_ratio only
 * • Exported SVG embeds styles so fonts match
 * • Partner table = same filtered set as plot + filters/sorting
 *
 * Pairs CSV header (expected):
 *   ref,target,counts,totals,total_ref,score,adjusted_score,ref_type,target_type,self_interaction_score,expected_count,p_value,odds_ratio,start_ref,end_ref,start_target,end_target,p_value_FDR
 *
 * Annotations CSV header (expected):
 *   gene_name,start,end,feature_type,strand,chromosome
 */

// -------------------------- Types --------------------------

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

type PairRow = {
  ref: string;
  target: string;
  counts?: number;
  odds_ratio?: number;
  adjusted_score?: number;
  ref_type?: FeatureType;
  target_type?: FeatureType;
};

type ScatterRow = {
  partner: string;
  x: number;       // partner start coordinate
  y: number;       // plotted/capped odds_ratio
  rawY: number;    // true odds_ratio
  counts: number;
  type: FeatureType;
  distance: number;
};

// ---------------------- Colors & helpers ----------------------

// sRNA and ncRNA = same magenta
const FEATURE_COLORS: Record<FeatureType, string> = {
  ncRNA: "#A40194",
  sRNA:  "#A40194",
  sponge:"#F12C2C",
  tRNA:  "#82F778",
  hkRNA: "#C4C5C5",
  CDS:   "#F78208",
  "5'UTR": "#76AAD7",
  "3'UTR": "#0C0C0C",
  rRNA:  "#999999",
};

const pickColor = (ft?: FeatureType) => FEATURE_COLORS[ft || "CDS"] || "#F78208";

// simple symlog used for axis mapping
function symlog(y: number, linthresh = 10, base = Math.E) {
  const s = Math.sign(y);
  const a = Math.abs(y);
  return a <= linthresh ? s * (a / linthresh) : s * (1 + Math.log(a / linthresh) / Math.log(base));
}

// ---------------------- Simulated data ----------------------

function simulateData(nGenes = 500) {
  const rng = ((seed: number) => () => (seed = (seed * 1664525 + 1013904223) % 0xffffffff) / 0xffffffff)(42);
  const ann: Annotation[] = [];
  const classes: FeatureType[] = ["CDS", "5'UTR", "3'UTR", "ncRNA", "tRNA", "sRNA"];
  const genomeLen = 4_600_000;

  for (let i = 0; i < nGenes; i++) {
    const ft = classes[Math.floor(rng() * classes.length)];
    const start = Math.floor(rng() * genomeLen);
    const len = Math.max(150, Math.floor(rng() * 1500));
    const end = Math.min(start + len, genomeLen - 1);
    const name = ft === "sRNA" ? `sRNA_${i}` : `gene_${i}`;
    ann.push({ gene_name: name, start, end, feature_type: ft, strand: rng() > 0.5 ? "+" : "-", chromosome: "chr" });
  }
  ann.push({ gene_name: "GcvB", start: 3_500_000, end: 3_500_600, feature_type: "sRNA", strand: "+", chromosome: "chr" });
  ann.push({ gene_name: "CpxQ", start: 1_800_000, end: 1_800_480, feature_type: "sRNA", strand: "+", chromosome: "chr" });

  const pairs: PairRow[] = [];
  const genes = ann.map(a => a.gene_name);

  function addEdge(a: string, b: string, bias = 1) {
    const c  = Math.max(1, Math.floor((rng() ** 2) * 120 * bias));
    const or = 0.5 + Math.pow(rng(), 0.4) * 400 * bias;
    const aAnn = ann.find(x => x.gene_name === a);
    const bAnn = ann.find(x => x.gene_name === b);
    pairs.push({ ref: a, target: b, counts: c, odds_ratio: or, ref_type: aAnn?.feature_type, target_type: bAnn?.feature_type });
  }

  for (let k = 0; k < nGenes * 2; k++) {
    const a = genes[Math.floor(rng() * genes.length)];
    const b = genes[Math.floor(rng() * genes.length)];
    if (a === b) continue;
    addEdge(a, b, 1);
  }
  const pick = (n: number) => Array.from({ length: n }, () => genes[Math.floor(rng() * genes.length)]);
  pick(60).forEach(g => addEdge("GcvB", g, 4));
  pick(40).forEach(g => addEdge("CpxQ", g, 3));

  return { annotations: ann, pairs };
}

// ------------------------ Main component ------------------------

export default function Page() {
  const [data, setData] = useState(() => simulateData(500));
  const [focal, setFocal] = useState<string>("GcvB");

  // plot controls
  const [minCounts, setMinCounts] = useState<number>(5);
  const [minDistance, setMinDistance] = useState<number>(5000);
  const [yCap, setYCap] = useState<number>(5000);
  const [labelThreshold, setLabelThreshold] = useState<number>(50);
  const [excludeTypes, setExcludeTypes] = useState<FeatureType[]>(["rRNA", "tRNA"]);

  // search & highlight
  const [query, setQuery] = useState<string>("");
  const [highlightInput, setHighlightInput] = useState<string>("");
  const highlightSet = useMemo(
    () => new Set(
      highlightInput
        .split(/[,\s\n]+/)
        .map(s => s.trim())
        .filter(Boolean)
    ),
    [highlightInput]
  );

  // file inputs
  const filePairsRef = useRef<HTMLInputElement>(null);
  const fileAnnoRef  = useRef<HTMLInputElement>(null);
  const [loadedPairsName, setLoadedPairsName] = useState<string | null>(null);
  const [loadedAnnoName, setLoadedAnnoName]  = useState<string | null>(null);

  const annotations = data.annotations;
  const pairs       = data.pairs;

  const geneIndex = useMemo(() => {
    const idx: Record<string, Annotation> = {};
    annotations.forEach(a => (idx[a.gene_name] = a));
    return idx;
  }, [annotations]);

  const genomeMax = useMemo(() => Math.max(...annotations.map(a => a.end)), [annotations]);
  const focalAnn  = geneIndex[focal];

  // Build partners from pairs (strictly odds_ratio)
  const partners: ScatterRow[] = useMemo(() => {
    const edges = (pairs as PairRow[]).filter(p => p.ref === focal || p.target === focal);
    const rows = edges.map(e => {
      const partner = e.ref === focal ? e.target : e.ref;
      const partAnn = geneIndex[partner];
      const fAnn    = geneIndex[focal];
      if (!partAnn || !fAnn) return null;

      const dist = Math.min(
        Math.abs(partAnn.start - fAnn.end),
        Math.abs(partAnn.end   - fAnn.start),
        Math.abs(partAnn.start - fAnn.start),
        Math.abs(partAnn.end   - fAnn.end)
      );
      const counts = e.counts ?? 0;
      const or     = Number(e.odds_ratio) || 0;
      const type   = (e.ref === focal ? e.target_type : e.ref_type) || partAnn.feature_type || "CDS";

      return {
        partner,
        x: partAnn.start,
        y: Math.min(or, yCap),
        rawY: or,
        counts,
        type: type as FeatureType,
        distance: dist,
      } as ScatterRow;
    }).filter(Boolean) as ScatterRow[];

    return rows
      .filter(r => r.counts   >= minCounts)
      .filter(r => r.distance >= minDistance)
      .filter(r => !excludeTypes.includes(r.type));
  }, [pairs, focal, geneIndex, minCounts, minDistance, excludeTypes, yCap]);

  // axis ticks for y (symlog-like)
  const yTicks = useMemo(() => [0, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000].filter(v => v <= yCap), [yCap]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query) return;
    const match =
      annotations.find(a => a.gene_name.toLowerCase() === query.toLowerCase()) ??
      annotations.find(a => a.gene_name.toLowerCase().includes(query.toLowerCase()));
    if (match) setFocal(match.gene_name);
  }

  // ---------- Export SVG with embedded font styles ----------
  function downloadSVG() {
    const node = document.getElementById("scatter-svg") as SVGSVGElement | null;
    if (!node) return;

    const cloned = node.cloneNode(true) as SVGSVGElement;
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent =
      'text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#1f2937;font-size:10px}.axis-label{font-size:11px}';
    cloned.insertBefore(style, cloned.firstChild);

    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(cloned);
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `${focal}_interactome.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- CSV loading ----------
  function parsePairsCSV(csv: string): PairRow[] {
    const { data } = Papa.parse<PairRow>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
    return (data as any[]).filter(r => r.ref && r.target) as PairRow[];
  }
  function parseAnnoCSV(csv: string): Annotation[] {
    const { data } = Papa.parse<any>(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
    const rows: Annotation[] = (data as any[])
      .filter(r => r.gene_name && r.start != null && r.end != null)
      .map(r => ({
        gene_name: String(r.gene_name),
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
    setData(prev => ({ ...prev, pairs: parsePairsCSV(text) }));
    setLoadedPairsName(file.name);
  }
  async function onAnnoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text  = await file.text();
    const parsed = parseAnnoCSV(text);
    setData(prev => ({ ...prev, annotations: parsed }));
    setLoadedAnnoName(file.name);
    if (parsed.length > 0) setFocal(parsed[0].gene_name);
  }

  // ---------- Table (derived exactly from partners) ----------
  const [minOR, setMinOR]     = useState<number>(0);
  const [minCnt, setMinCnt]   = useState<number>(0);
  const [coordMin, setCoordMin] = useState<number>(0);
  const [coordMax, setCoordMax] = useState<number | null>(null);
  const [sortBy, setSortBy]   = useState<"or" | "counts" | "pos">("or");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const tableRows: ScatterRow[] = useMemo(() => {
    let rows = partners.filter(r =>
      r.rawY >= minOR &&
      r.counts >= minCnt &&
      r.x >= (coordMin || 0) &&
      r.x <= (coordMax ?? genomeMax)
    );
    const cmp =
      sortBy === "or"     ? (a: ScatterRow, b: ScatterRow) => a.rawY - b.rawY :
      sortBy === "counts" ? (a: ScatterRow, b: ScatterRow) => a.counts - b.counts :
                            (a: ScatterRow, b: ScatterRow) => a.x - b.x;
    rows = rows.sort(cmp);
    if (sortDir === "desc") rows.reverse();
    return rows.slice(0, 200);
  }, [partners, minOR, minCnt, coordMin, coordMax, genomeMax, sortBy, sortDir]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/90 border-b">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
          <div className="text-xl font-semibold">TRIC-seq Interactome Explorer</div>
          <div className="text-sm text-gray-500">(demo with simulated data; upload real CSVs under “Data”)</div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 grid grid-cols-12 gap-4">
        {/* Controls */}
        <Card className="col-span-12 lg:col-span-3">
          <CardContent className="p-4 space-y-4">
            <div className="font-semibold">Search</div>
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <Input placeholder="Enter RNA (e.g., GcvB)" value={query} onChange={(e) => setQuery(e.target.value)} />
              <Button type="submit" variant="secondary">
                <Search className="w-4 h-4" />
              </Button>
            </form>

            <div className="font-semibold pt-2">Highlight genes</div>
            <textarea
              className="border rounded w-full p-2 text-sm"
              rows={3}
              placeholder="e.g., oppA, argT, dppA"
              value={highlightInput}
              onChange={(e) => setHighlightInput(e.target.value)}
            />

            <div className="font-semibold pt-2">Filters</div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-600 mb-1">Min counts: {minCounts}</div>
                <Slider value={[minCounts]} onValueChange={(v) => setMinCounts(v[0])} min={0} max={50} step={1} />
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Min distance (bp): {minDistance}</div>
                <Slider value={[minDistance]} onValueChange={(v) => setMinDistance(v[0])} min={0} max={20000} step={500} />
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Y cap (odds ratio): {yCap}</div>
                <Slider value={[yCap]} onValueChange={(v) => setYCap(v[0])} min={100} max={5000} step={100} />
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Label threshold (OR): {labelThreshold}</div>
                <Slider value={[labelThreshold]} onValueChange={(v) => setLabelThreshold(v[0])} min={0} max={500} step={5} />
              </div>
              <div className="text-xs text-gray-700">
                Exclude types:
                <div className="mt-1 flex flex-wrap gap-1">
                  {["rRNA", "tRNA", "hkRNA"].map(ft => {
                    const active = excludeTypes.includes(ft as FeatureType);
                    return (
                      <Button
                        key={ft}
                        variant={active ? "secondary" : "outline"}
                        size="sm"
                        onClick={() =>
                          setExcludeTypes(prev =>
                            prev.includes(ft as FeatureType)
                              ? prev.filter(x => x !== (ft as FeatureType))
                              : [...prev, ft as FeatureType]
                          )
                        }
                      >
                        {ft}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="font-semibold pt-2">Data</div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setData(simulateData(500))}>
                <RefreshCw className="w-4 h-4 mr-1" /> Simulate
              </Button>
              <Button variant="outline" onClick={downloadSVG}>
                <Download className="w-4 h-4 mr-1" /> Export SVG
              </Button>
            </div>
            <div className="space-y-2 pt-2">
              <div className="text-xs text-gray-600">Pairs table CSV</div>
              <input ref={filePairsRef} type="file" accept=".csv" onChange={onPairsFile} />
              <div className="text-xs text-gray-500">{loadedPairsName || "(using simulated pairs)"}</div>

              <div className="text-xs text-gray-600 pt-2">Annotations CSV</div>
              <input ref={fileAnnoRef} type="file" accept=".csv" onChange={onAnnoFile} />
              <div className="text-xs text-gray-500">{loadedAnnoName || "(using simulated annotations)"}</div>
            </div>

            <div className="text-xs text-gray-500 pt-3 flex gap-1 items-start">
              <Info className="w-4 h-4 mt-0.5" />
              <div>
                Click a dot to re-center on that RNA. Stroke color encodes feature type. X = partner start coordinate; Y = odds ratio (symlog-like), capped.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scatter + legend + table */}
        <div className="col-span-12 lg:col-span-9 space-y-4">
          <Card>
            <CardContent className="p-4">
              <ScatterPlot
                focal={focal}
                focalAnn={focalAnn}
                partners={partners}
                genomeMax={genomeMax}
                yCap={yCap}
                yTicks={yTicks}
                labelThreshold={labelThreshold}
                onClickPartner={(name) => setFocal(name)}
                highlightSet={highlightSet}
              />

              {/* Legend BELOW the SVG */}
              <div className="mt-3 flex flex-wrap gap-4 items-center">
                <span className="text-sm font-medium">Feature types</span>
                {["CDS", "5'UTR", "3'UTR", "ncRNA", "sRNA", "tRNA", "rRNA", "sponge", "hkRNA"].map(k => (
                  <span key={k} className="inline-flex items-center gap-2 text-xs">
                    <span
                      className="inline-block w-3 h-3 rounded-full border"
                      style={{ background: "#fff", borderColor: pickColor(k), boxShadow: `inset 0 0 0 2px ${pickColor(k)}` }}
                    />
                    {k}
                  </span>
                ))}
                <span className="ml-6 text-xs text-gray-500">Fill = highlighted genes; Size = counts</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <div className="text-xs text-gray-600">Min odds ratio</div>
                  <Input type="number" step="1" value={minOR} onChange={(e) => setMinOR(Number(e.target.value))} className="w-28" />
                </div>
                <div>
                  <div className="text-xs text-gray-600">Min counts</div>
                  <Input type="number" step="1" value={minCnt} onChange={(e) => setMinCnt(Number(e.target.value))} className="w-28" />
                </div>
                <div>
                  <div className="text-xs text-gray-600">Start coord ≥</div>
                  <Input type="number" step="1000" value={coordMin} onChange={(e) => setCoordMin(Number(e.target.value))} className="w-36" />
                </div>
                <div>
                  <div className="text-xs text-gray-600">Start coord ≤</div>
                  <Input
                    type="number"
                    step="1000"
                    value={coordMax ?? genomeMax}
                    onChange={(e) => setCoordMax(Number(e.target.value) || genomeMax)}
                    className="w-36"
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-600">Sort by</div>
                  <select
                    className="border rounded px-2 py-1"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "or" | "counts" | "pos")}
                  >
                    <option value="or">odds_ratio</option>
                    <option value="counts">counts</option>
                    <option value="pos">position</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Order</div>
                  <select className="border rounded px-2 py-1" value={sortDir} onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}>
                    <option value="desc">desc</option>
                    <option value="asc">asc</option>
                  </select>
                </div>
              </div>

              <div className="overflow-auto mt-3">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-gray-600">
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
                    {tableRows.map(row => (
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
                    {tableRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-2 text-gray-500">No rows match filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

// ------------------------ Scatter Plot ------------------------

function ScatterPlot({
  focal,
  focalAnn,
  partners,
  genomeMax,
  yCap,
  yTicks,
  labelThreshold,
  onClickPartner,
  highlightSet,
}: {
  focal: string;
  focalAnn?: Annotation;
  partners: ScatterRow[];
  genomeMax: number;
  yCap: number;
  yTicks: number[];
  labelThreshold: number;
  onClickPartner: (gene: string) => void;
  highlightSet: Set<string>;
}) {
  const width  = 900;
  const height = 520;
  const margin = { top: 12, right: 20, bottom: 42, left: 60 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top  - margin.bottom;

  const xScale = (x: number) => (x / (genomeMax * 1.05)) * innerW;
  const yScale = (v: number) => {
    const t = symlog(v, 10, 10);
    const tMax = symlog(yCap, 10, 10);
    return innerH - (t / tMax) * innerH;
  };
  const sizeScale = (c: number) => Math.sqrt(c) * 2 + 4;

  // label placement from high to low
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
          {/* X axis */}
          <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#222" />
          {Array.from({ length: 6 }).map((_, i) => {
            const x = (i / 5) * genomeMax;
            return (
              <g key={i} transform={`translate(${xScale(x)},${innerH})`}>
                <line y2={6} stroke="#222" />
                <text y={20} textAnchor="middle">{Math.round(x / 1e6)} Mb</text>
              </g>
            );
          })}

          {/* Y axis */}
          <line x1={0} y1={0} x2={0} y2={innerH} stroke="#222" />
          {yTicks.map((t, i) => (
            <g key={i} transform={`translate(0,${yScale(t)})`}>
              <line x2={-6} stroke="#222" />
              <text x={-9} y={3} textAnchor="end">{t}</text>
              <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eee" />
            </g>
          ))}
          <text transform={`translate(${-44},${innerH/2}) rotate(-90)`} className="axis-label">
            Interaction strength (odds ratio)
          </text>

          {/* Focal marker */}
          {focalAnn && (
            <g>
              <line x1={xScale(focalAnn.start)} y1={0} x2={xScale(focalAnn.start)} y2={innerH} stroke="#444" strokeDasharray="3 3" />
              <polygon
                points={`${xScale(focalAnn.start)-6},${innerH+10} ${xScale(focalAnn.start)+6},${innerH+10} ${xScale(focalAnn.start)},${innerH+2}`}
                fill="#000"
              />
              <text x={xScale(focalAnn.start)} y={-2} textAnchor="middle">{focal}</text>
            </g>
          )}

          {/* Points */}
          {partners
            .sort((a, b) => b.counts - a.counts)
            .map((p, idx) => (
              <g key={idx} transform={`translate(${xScale(p.x)},${yScale(p.y)})`}>
                <circle
                  r={sizeScale(p.counts)}
                  fill={highlightSet.has(p.partner) ? "#FFD54F" : "#fff"}
                  stroke={pickColor(p.type)}
                  strokeWidth={2}
                  style={{ cursor: "pointer" }}
                  onClick={() => onClickPartner(p.partner)}
                />
                {/* stem */}
                <line x1={0} y1={0} x2={0} y2={Math.max(0, innerH - yScale(p.y))} stroke="#999" strokeDasharray="2 3" opacity={0.1} />
              </g>
            ))}

          {/* Labels */}
          {labels.map((p, i) => (
            <g key={i} transform={`translate(${xScale(p.x)},${yScale(p.y)})`}>
              <text x={6} y={-6}>{p.partner}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
