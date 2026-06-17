"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Orbit, BarChartHorizontal, Download, Shuffle, BarChart3, Target } from "lucide-react";
import { useExplorer } from "@/lib/explore/store";
import { formatGeneName, pickColor, combinedLabel, symlog, exportPNG, baseGene, keyForPair } from "@/lib/shared";
import { oddsColor } from "@/lib/explore/heat";
import { loadRilPairs } from "@/lib/explore/rilseq";
import type { PartnerRow } from "@/lib/explore/compute";

const RIL_FILL = "#2DD4BF";
const RIL_STROKE = "#0d9488";

type View = "genome" | "linear";

export function InteractomeLens() {
  const {
    focal, focalAnn, focalTotal, partners, genomeStart, genomeLen,
    yCap, labelThreshold, sizeScale, highlight,
    setFocal, setActivePartner, activePartner, pickRandom,
  } = useExplorer();
  const [view, setView] = useState<View>("genome");
  const [hover, setHover] = useState<PartnerRow | null>(null);
  const [ril, setRil] = useState(false);
  const [rilSet, setRilSet] = useState<Set<string> | null>(null);
  const [density, setDensity] = useState(false);

  useEffect(() => {
    if (ril && !rilSet) loadRilPairs().then(setRilSet).catch(() => {});
  }, [ril, rilSet]);

  const accent = pickColor(focalAnn?.feature_type);
  // Only an explicitly chosen partner is emphasised — never the auto-default top one.
  const activeName = activePartner ?? undefined;

  // partners of the focal that are known RIL-seq pairs (E. coli)
  const rilHits = useMemo(() => {
    if (!ril || !rilSet) return null;
    const fl = baseGene(focal).toLowerCase();
    const s = new Set<string>();
    for (const p of partners) if (rilSet.has(keyForPair(fl, baseGene(p.partner).toLowerCase()))) s.add(p.partner);
    return s;
  }, [ril, rilSet, focal, partners]);

  return (
    <div className="glass rounded-3xl p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-slate-800">Interactome</div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{partners.length} partners</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg bg-slate-100 p-0.5">
            <button
              onClick={() => setView("genome")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${view === "genome" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <Orbit className="h-3.5 w-3.5" /> Genome
            </button>
            <button
              onClick={() => setView("linear")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${view === "linear" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <BarChartHorizontal className="h-3.5 w-3.5" /> Linear
            </button>
          </div>
          <button
            onClick={() => setRil((v) => !v)}
            title="Highlight known E. coli RIL-seq targets (Melamed et al. 2016)"
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition ${ril ? "border-teal-300 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-500 hover:text-slate-800"}`}
          >
            <Target className="h-3.5 w-3.5" /> RIL-seq{ril && rilHits ? ` (${rilHits.size})` : ""}
          </button>
          {view === "genome" && (
            <button
              onClick={() => setDensity((v) => !v)}
              title="Overlay a circular density histogram of partners per genomic region"
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition ${density ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-500 hover:text-slate-800"}`}
            >
              <BarChart3 className="h-3.5 w-3.5" /> Density
            </button>
          )}
          <button onClick={pickRandom} title="Jump to a well-connected RNA" className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800">
            <Shuffle className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => exportPNG(view === "genome" ? "interactome-genome" : "interactome-linear", `${focal}_interactome`)} title="Export PNG" className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800">
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div key={`${focal}-${view}`} className="lens-in">
        {view === "genome" ? (
          <GenomeChords
            focal={focal} accent={accent} focalAnn={focalAnn} focalTotal={focalTotal}
            partners={partners} genomeStart={genomeStart} genomeLen={genomeLen}
            yCap={yCap} labelThreshold={labelThreshold} sizeScale={sizeScale}
            highlight={highlight} activeName={activeName} hover={hover} setHover={setHover}
            onClick={setFocal} onActivate={(g) => setActivePartner(g)}
            density={density} rilHits={rilHits}
          />
        ) : (
          <LinearScatter
            focal={focal} accent={accent} focalAnn={focalAnn} focalTotal={focalTotal}
            partners={partners} genomeStart={genomeStart} genomeLen={genomeLen}
            yCap={yCap} labelThreshold={labelThreshold} sizeScale={sizeScale}
            highlight={highlight} activeName={activeName} hover={hover} setHover={setHover}
            onClick={setFocal} onActivate={(g) => setActivePartner(g)}
            rilHits={rilHits}
          />
        )}
      </div>

      <Legend showRil={!!rilHits} />
    </div>
  );
}

type ViewProps = {
  focal: string; accent: string; focalAnn?: any; focalTotal: number;
  partners: PartnerRow[]; genomeStart: number; genomeLen: number;
  yCap: number; labelThreshold: number; sizeScale: number;
  highlight: Set<string>; activeName?: string;
  hover: PartnerRow | null; setHover: (p: PartnerRow | null) => void;
  onClick: (g: string) => void; onActivate: (g: string) => void;
  density?: boolean; rilHits?: Set<string> | null;
};

function HoverCard({ p, x, y, w }: { p: PartnerRow; x: number; y: number; w: number }) {
  const disp = formatGeneName(p.partner, p.type);
  const lbl = combinedLabel(p.type as any);
  const lines = [
    `${lbl.label}`,
    `Oᶠ ${p.rawY.toFixed(1)}  ·  iₒ ${p.counts}`,
    p.fdr != null ? `FDR ${p.fdr.toExponential(1)}` : "",
  ].filter(Boolean);
  const boxW = 150;
  const tx = Math.max(6, Math.min(x - boxW / 2, w - boxW - 6));
  const ty = Math.max(6, y - 60);
  return (
    <g transform={`translate(${tx},${ty})`} pointerEvents="none">
      <rect width={boxW} height={lines.length * 14 + 22} rx={8} fill="#0f172a" opacity={0.94} />
      <text x={10} y={18} fill="#fff" fontSize={12} fontWeight={700} fontStyle={disp.italic ? "italic" : "normal"}>{disp.text}</text>
      {lines.map((l, i) => (
        <text key={i} x={10} y={34 + i * 14} fill="#cbd5e1" fontSize={10.5}>{l}</text>
      ))}
    </g>
  );
}

// ---------------- Circos-style genome chords ----------------
function GenomeChords(props: ViewProps) {
  const { focal, accent, focalAnn, focalTotal, partners, genomeStart, genomeLen, labelThreshold, sizeScale, highlight, activeName, hover, setHover, onClick, onActivate, density, rilHits } = props;
  const W = 760, H = 660;
  const cx = W / 2, cy = H / 2 + 4;
  const R = 244;
  const DENS_LEN = 92;

  const ang = (p: number) => ((p - genomeStart) / genomeLen) * Math.PI * 2 - Math.PI / 2;
  const ptOf = (p: number, r = R) => {
    const a = ang(p);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  };

  const focalMid = focalAnn ? Math.floor((focalAnn.start + focalAnn.end) / 2) : genomeStart;
  const [fx, fy] = ptOf(focalMid);

  // Odds ratio → colour, anchored at 0 (low) and max(10, observed max) (high) so
  // unspecific interactions (OR < 10) stay light and never get highlighted. Reads
  // → arc width on a log scale across the data range.
  const { orT, widthT, orHigh } = useMemo(() => {
    const cts = partners.map((p) => Math.log10(Math.max(1, p.counts)));
    const cLo = cts.length ? Math.min(...cts) : 0;
    const cHi = cts.length ? Math.max(...cts) : 1;
    const maxOR = partners.reduce((mx, p) => Math.max(mx, p.rawY), 0);
    const orHigh = Math.max(10, maxOR);
    const lh = Math.log1p(orHigh) || 1;
    return {
      orHigh,
      orT: (or: number) => Math.max(0, Math.min(1, Math.log1p(Math.max(0, or)) / lh)),
      widthT: (c: number) => (cHi > cLo ? (Math.log10(Math.max(1, c)) - cLo) / (cHi - cLo) : 0.5),
    };
  }, [partners]);

  const mbTicks = useMemo(() => {
    const step = 0.5e6, n = Math.floor(genomeLen / step);
    return Array.from({ length: n }, (_, i) => genomeStart + (i + 1) * step);
  }, [genomeStart, genomeLen]);

  // dedupe labels by angular proximity (radial labels pack tighter, so allow more)
  const labels = useMemo(() => {
    const placed: number[] = [];
    return [...partners]
      .sort((a, b) => b.rawY - a.rawY)
      .filter((p) => p.rawY >= labelThreshold)
      .filter((p) => {
        const a = ang(Math.floor((p.start + p.end) / 2));
        if (placed.some((q) => Math.abs(q - a) < 0.045)) return false;
        placed.push(a);
        return true;
      })
      .slice(0, 64);
  }, [partners, labelThreshold, genomeStart, genomeLen]);

  const sorted = useMemo(() => [...partners].sort((a, b) => a.rawY - b.rawY), [partners]);

  // density: partners per 20-kb window, smoothed with a circular rolling average,
  // on a linear scale (taller bar = more partners in that region)
  const { densBars, densMax } = useMemo(() => {
    const BIN_BP = 20000;
    const nBins = Math.max(8, Math.ceil(genomeLen / BIN_BP));
    const raw = new Array(nBins).fill(0);
    for (const p of partners) {
      const mid = (p.start + p.end) / 2;
      const bi = Math.min(nBins - 1, Math.max(0, Math.floor((mid - genomeStart) / BIN_BP)));
      raw[bi]++;
    }
    const win = 2; // ±2 bins ≈ 100-kb rolling window
    const smooth = raw.map((_, i) => {
      let s = 0;
      for (let j = -win; j <= win; j++) s += raw[(i + j + nBins) % nBins];
      return s / (2 * win + 1);
    });
    return { densBars: smooth as number[], densMax: Math.max(1e-6, ...smooth) };
  }, [partners, genomeStart, genomeLen]);

  const focalDisp = formatGeneName(focal, focalAnn?.feature_type);

  return (
    <div className="relative w-full overflow-x-auto">
      <svg id="interactome-genome" width="100%" viewBox={`0 0 ${W} ${H}`} className="mx-auto block" style={{ maxHeight: 620 }}>
        <defs>
          <radialGradient id="ring-glow" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor={accent} stopOpacity={0} />
            <stop offset="100%" stopColor={accent} stopOpacity={0.12} />
          </radialGradient>
          <radialGradient id="focal-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accent} stopOpacity={0.5} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </radialGradient>
          <style>{`text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}`}</style>
        </defs>

        <circle cx={cx} cy={cy} r={R + 26} fill="url(#ring-glow)" />

        {/* genome ring + ticks */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#cbd5e1" strokeWidth={10} />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#475569" strokeWidth={1.25} />
        {mbTicks.map((p, i) => {
          const [x1, y1] = ptOf(p, R - 6);
          const [x2, y2] = ptOf(p, R + 6);
          const [lx, ly] = ptOf(p, R + 20);
          const mb = ((p - genomeStart) / 1e6).toFixed(1);
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth={1} />
              <text x={lx} y={ly} fontSize={9} fill="#94a3b8" textAnchor="middle" dominantBaseline="middle">{mb}</text>
            </g>
          );
        })}

        {/* chords focal -> partners */}
        <g>
          {sorted.map((p, i) => {
            const mid = Math.floor((p.start + p.end) / 2);
            const [px, py] = ptOf(mid);
            const isActive = p.partner === activeName;
            const isHover = hover?.partner === p.partner;
            const isRil = !!rilHits?.has(p.partner);
            const t = orT(p.rawY);        // odds ratio → colour
            const wT = widthT(p.counts);  // log(reads) → width
            const emph = isHover || isActive;
            // low OR recedes; density mode fades non-RIL chords so the histogram reads
            const op = emph ? 0.98 : isRil ? (density ? 0.65 : 0.9) : density ? 0.06 : 0.12 + t * 0.72;
            return (
              <path
                key={p.partner}
                d={`M ${fx} ${fy} Q ${cx} ${cy} ${px} ${py}`}
                fill="none"
                stroke={isRil ? RIL_STROKE : oddsColor(t)}
                strokeWidth={(0.6 + wT * 3.6) * (emph ? 1.5 : isRil ? 1.3 : 1)}
                strokeOpacity={op}
                strokeLinecap="round"
                pathLength={1}
                style={{ strokeDasharray: 1, strokeDashoffset: 0, animation: `chord-draw 0.7s ease forwards`, animationDelay: `${Math.min(i * 6, 360)}ms` }}
              />
            );
          })}
        </g>

        {/* circular density histogram (inward radial bars) */}
        {density && (
          <g pointerEvents="none">
            {densBars.map((c, i) => {
              if (c <= 0) return null;
              const a = ((i + 0.5) / densBars.length) * Math.PI * 2 - Math.PI / 2;
              const len = (c / densMax) * DENS_LEN; // linear
              return (
                <line key={i}
                  x1={cx + Math.cos(a) * (R - 1)} y1={cy + Math.sin(a) * (R - 1)}
                  x2={cx + Math.cos(a) * (R - 1 - len)} y2={cy + Math.sin(a) * (R - 1 - len)}
                  stroke={accent} strokeWidth={2.2} strokeLinecap="round" opacity={0.5}
                />
              );
            })}
          </g>
        )}

        {/* partner dots */}
        <g>
          {sorted.map((p) => {
            const mid = Math.floor((p.start + p.end) / 2);
            const [px, py] = ptOf(mid);
            const r = Math.min(16, Math.sqrt(p.counts) * 1.5 * sizeScale + 2.5);
            const col = pickColor(p.type);
            const isHi = highlight.has(p.partner);
            const isActive = p.partner === activeName;
            const isRil = !!rilHits?.has(p.partner);
            return (
              <g key={p.partner}>
                {isActive && <circle cx={px} cy={py} r={r + 3.5} fill="none" stroke="#0f172a" strokeWidth={1.5} />}
                <circle
                  cx={px} cy={py} r={r}
                  fill={isRil ? RIL_FILL : isHi ? "#FDE047" : "#fff"}
                  stroke={isRil ? RIL_STROKE : col}
                  strokeWidth={2}
                  className="cursor-pointer"
                  style={{ transition: "r 120ms" }}
                  onMouseEnter={() => setHover(p)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onClick(p.partner)}
                  onDoubleClick={() => onActivate(p.partner)}
                />
              </g>
            );
          })}
        </g>

        {/* partner labels — radial, so more names fit around the ring */}
        {labels.map((p) => {
          const mid = Math.floor((p.start + p.end) / 2);
          const a = ang(mid);
          const [lx, ly] = ptOf(mid, R + 7);
          const flip = Math.cos(a) < 0; // left half → rotate 180° so text isn't upside down
          const rot = (a * 180) / Math.PI + (flip ? 180 : 0);
          const disp = formatGeneName(p.partner, p.type);
          return (
            <text key={p.partner} transform={`translate(${lx},${ly}) rotate(${rot})`} fontSize={10} fill="#475569" textAnchor={flip ? "end" : "start"} dominantBaseline="middle"
              style={{ fontStyle: disp.italic ? "italic" : "normal", cursor: "pointer" }} onClick={() => onClick(p.partner)}>
              {disp.text}
            </text>
          );
        })}

        {/* focal core */}
        <circle cx={cx} cy={cy} r={86} fill="url(#focal-glow)" className="focal-pulse" />
        <line x1={fx} y1={fy} x2={cx} y2={cy} stroke={accent} strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
        <circle cx={fx} cy={fy} r={7} fill={accent} stroke="#fff" strokeWidth={2} />
        <g textAnchor="middle">
          <text x={cx} y={cy - 6} fontSize={20} fontWeight={800} fill="#0f172a" style={{ fontStyle: focalDisp.italic ? "italic" : "normal" }}>{focalDisp.text}</text>
          <text x={cx} y={cy + 14} fontSize={11} fill="#64748b">{combinedLabel((focalAnn?.feature_type as any) || "CDS").label}</text>
          <text x={cx} y={cy + 30} fontSize={10.5} fill="#94a3b8">{focalTotal.toLocaleString()} interactions</text>
        </g>

        {hover && <HoverCard p={hover} x={ptOf(Math.floor((hover.start + hover.end) / 2))[0]} y={ptOf(Math.floor((hover.start + hover.end) / 2))[1]} w={W} />}
      </svg>
      {density && (
        <div className="pointer-events-none absolute top-1 left-2 flex items-center gap-1.5 text-[10px] text-slate-500">
          <BarChart3 className="h-3 w-3" />
          <span>partners per 20 kb · rolling average</span>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-1 left-2 flex items-center gap-1.5 text-[10px] text-slate-400">
        <span>odds ratio</span>
        <span className="tabular-nums">0</span>
        <span className="inline-block h-2 w-20 rounded" style={{ background: `linear-gradient(to right, ${oddsColor(0)}, ${oddsColor(0.5)}, ${oddsColor(1)})` }} />
        <span className="tabular-nums">{orHigh >= 1000 ? `${(orHigh / 1000).toFixed(1)}k` : Math.round(orHigh)}</span>
      </div>
      <div className="pointer-events-none absolute bottom-1 right-2 text-[10px] text-slate-400">click = refocus · double-click = pair view</div>
    </div>
  );
}

// ---------------- Linear scatter ----------------
function LinearScatter(props: ViewProps) {
  const { focal, accent, focalAnn, focalTotal, partners, genomeStart, genomeLen, yCap, labelThreshold, sizeScale, highlight, activeName, hover, setHover, onClick, onActivate, rilHits } = props;
  const W = 900, H = 520;
  const m = { top: 16, right: 120, bottom: 44, left: 60 };
  const iw = W - m.left - m.right, ih = H - m.top - m.bottom;

  const xS = (x: number) => ((x - genomeStart) / genomeLen) * iw;
  const yS = (v: number) => ih - (symlog(v, 10, 10) / symlog(yCap, 10, 10)) * ih;
  const size = (c: number) => Math.sqrt(c) * 2 * sizeScale + 4;
  const yTicks = [0, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000].filter((v) => v <= yCap);

  const mbTicks = useMemo(() => {
    const step = 0.5e6, n = Math.floor(genomeLen / step);
    return Array.from({ length: n }, (_, i) => (i + 1) * 0.5);
  }, [genomeLen]);

  const labels = useMemo(() => {
    const placed: { x: number; y: number }[] = [];
    return [...partners].sort((a, b) => b.rawY - a.rawY).filter((p) => p.rawY >= labelThreshold).filter((p) => {
      const px = xS(p.x), py = yS(p.y);
      if (placed.some((q) => Math.abs(q.x - px) < 12 && Math.abs(q.y - py) < 12)) return false;
      placed.push({ x: px, y: py });
      return true;
    }).slice(0, 60);
  }, [partners, labelThreshold, yCap, genomeStart, genomeLen]);

  const focalMid = focalAnn ? Math.floor((focalAnn.start + focalAnn.end) / 2) : genomeStart;
  const focalDisp = formatGeneName(focal, focalAnn?.feature_type);

  return (
    <div className="relative w-full overflow-x-auto">
      <svg id="interactome-linear" width="100%" viewBox={`0 0 ${W} ${H}`} className="mx-auto block" style={{ maxHeight: 540 }}>
        <defs><style>{`text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:10px}`}</style></defs>
        <g transform={`translate(${m.left},${m.top})`}>
          {yTicks.map((t, i) => (
            <g key={i} transform={`translate(0,${yS(t)})`}>
              <line x1={0} x2={iw} stroke="#eef2f7" />
              <text x={-9} y={3} textAnchor="end" fill="#94a3b8">{t}</text>
            </g>
          ))}
          <line x1={0} y1={ih} x2={iw} y2={ih} stroke="#cbd5e1" />
          {mbTicks.map((mb, i) => {
            const xa = genomeStart + mb * 1e6;
            return (
              <g key={i} transform={`translate(${xS(xa)},${ih})`}>
                <line y2={5} stroke="#cbd5e1" />
                <text y={18} textAnchor="middle" fill="#94a3b8">{Number.isInteger(mb) ? `${mb} Mb` : `${mb}`}</text>
              </g>
            );
          })}
          <text transform={`translate(-44,${ih / 2}) rotate(-90)`} textAnchor="middle" fill="#64748b" fontSize={11}>Odds ratio (symlog)</text>

          {/* focal guide */}
          <line x1={xS(focalMid)} y1={0} x2={xS(focalMid)} y2={ih} stroke={accent} strokeDasharray="3 3" opacity={0.6} />
          <polygon points={`${xS(focalMid) - 6},${ih + 9} ${xS(focalMid) + 6},${ih + 9} ${xS(focalMid)},${ih + 1}`} fill={accent} />
          <text x={xS(focalMid)} y={-3} textAnchor="middle" fill="#0f172a" fontWeight={700} style={{ fontStyle: focalDisp.italic ? "italic" : "normal" }}>{focalDisp.text} ({focalTotal})</text>

          {[...partners].sort((a, b) => b.counts - a.counts).map((p) => {
            const isHi = highlight.has(p.partner);
            const isActive = p.partner === activeName;
            const isRil = !!rilHits?.has(p.partner);
            const col = pickColor(p.type);
            return (
              <g key={p.partner} transform={`translate(${xS(p.x)},${yS(p.y)})`}>
                {isActive && <circle r={size(p.counts) + 3.5} fill="none" stroke="#0f172a" strokeWidth={1.5} />}
                <circle r={size(p.counts)} fill={isRil ? RIL_FILL : isHi ? "#FDE047" : "#fff"} stroke={isRil ? RIL_STROKE : col} strokeWidth={2}
                  className="cursor-pointer" onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)}
                  onClick={() => onClick(p.partner)} onDoubleClick={() => onActivate(p.partner)} />
              </g>
            );
          })}

          {labels.map((p, i) => {
            const disp = formatGeneName(p.partner, p.type);
            return <text key={i} x={xS(p.x) + 7} y={yS(p.y) - 6} fill="#475569" style={{ fontStyle: disp.italic ? "italic" : "normal" }}>{disp.text}</text>;
          })}

          {hover && <HoverCard p={hover} x={xS(hover.x)} y={yS(hover.y)} w={iw} />}
        </g>
      </svg>
    </div>
  );
}

function Legend({ showRil }: { showRil?: boolean }) {
  const items = [
    { c: pickColor("CDS"), l: "CDS" },
    { c: pickColor("5'UTR"), l: "5'UTR" },
    { c: pickColor("3'UTR"), l: "3'UTR" },
    { c: pickColor("sRNA"), l: "sRNA/ncRNA" },
    { c: pickColor("tRNA"), l: "tRNA" },
    { c: pickColor("rRNA"), l: "rRNA/hkRNA" },
    { c: pickColor("sponge"), l: "Sponge" },
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3">
      {items.map((it) => (
        <span key={it.l} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#fff", boxShadow: `inset 0 0 0 2.5px ${it.c}` }} />
          {it.l}
        </span>
      ))}
      {showRil && (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-700">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: RIL_FILL, boxShadow: `inset 0 0 0 2px ${RIL_STROKE}` }} />
          RIL-seq target
        </span>
      )}
      <span className="ml-auto text-[11px] text-slate-400">circle area ∝ reads · odds ratio ∝ arc colour (genome) / height (linear)</span>
    </div>
  );
}
