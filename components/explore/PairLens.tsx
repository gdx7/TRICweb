"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Download, Loader2, AlertCircle, RefreshCw, Dna } from "lucide-react";
import { useExplorer } from "@/lib/explore/store";
import { formatGeneName, pickColor, exportPNG } from "@/lib/shared";
import { buildPairMatrix } from "@/lib/explore/compute";
import { oddsColor as heat } from "@/lib/explore/heat";
import { loadGenome, windowSeq } from "@/lib/explore/sequence";
import { predictDuplexes, Duplex } from "@/lib/explore/predict";

type GenStatus = "none" | "loading" | "ready" | "error";

export function PairLens() {
  const { focal, focalAnn, effectiveActivePartner, geneIndex, contacts, contactsStatus, ensureContacts, speciesId, partners, setActivePartner, genomeSeq, fastaUrl } = useExplorer();
  const [flankY, setFlankY] = useState(300);
  const [flankX, setFlankX] = useState(300);
  const [bin, setBin] = useState(10);
  const [vmax, setVmax] = useState(0); // 0 = auto

  useEffect(() => { ensureContacts(); }, [ensureContacts]);

  const partner = effectiveActivePartner?.partner;
  const xAnn = partner ? geneIndex[partner] : undefined;

  const safeBin = useMemo(() => {
    if (!focalAnn || !xAnn) return bin;
    const lenY = (focalAnn.end - focalAnn.start) + flankY * 2;
    const lenX = (xAnn.end - xAnn.start) + flankX * 2;
    return Math.max(bin, Math.ceil(Math.max(lenY, lenX) / 200));
  }, [focalAnn, xAnn, flankY, flankX, bin]);

  const m = useMemo(() => {
    if (!focalAnn || !xAnn || !contacts.length) return null;
    return buildPairMatrix(contacts, focalAnn, xAnn, flankY, flankX, safeBin, partner!);
  }, [focalAnn, xAnn, contacts, flankY, flankX, safeBin, partner]);

  // ---- genome sequence (demo in-memory, species fetched once) ----
  const [genome, setGenome] = useState<string | null>(genomeSeq);
  const [genStatus, setGenStatus] = useState<GenStatus>(genomeSeq ? "ready" : "none");
  useEffect(() => {
    if (genomeSeq) { setGenome(genomeSeq); setGenStatus("ready"); return; }
    setGenome(null);
    if (!fastaUrl) { setGenStatus("none"); return; }
    let cancelled = false;
    setGenStatus("loading");
    loadGenome(fastaUrl)
      .then((g) => { if (!cancelled) { setGenome(g); setGenStatus("ready"); } })
      .catch(() => { if (!cancelled) setGenStatus("error"); });
    return () => { cancelled = true; };
  }, [genomeSeq, fastaUrl]);

  // ---- built-in binding-site prediction (RNAduplex-style) ----
  // Search only the feature ±PRED_FLANK nt (not the whole plotted window), so
  // base-pairing is sought near the transcript and not in distal flank.
  const PRED_FLANK = 30;
  const predictions = useMemo<Duplex[]>(() => {
    if (genStatus !== "ready" || !genome || !focalAnn || !xAnn) return [];
    const s1 = windowSeq(genome, focalAnn, PRED_FLANK);
    const s2 = windowSeq(genome, xAnn, PRED_FLANK);
    if (s1.length < 7 || s2.length < 7) return [];
    return predictDuplexes(s1, s2, 7, 2); // up to 2 separate sites
  }, [genome, genStatus, focalAnn, xAnn]);

  // Map each predicted site (offsets in the ±30 nt window) onto the heatmap's bins
  // via genomic coordinates, since the predictor and heatmap use different windows.
  const overlays = useMemo(() => {
    if (!predictions.length || !m || !focalAnn || !xAnn || !genome) return [];
    const gl = genome.length;
    const offToGenome = (off: number, ann: any) => {
      const ws = Math.max(1, ann.start - PRED_FLANK), we = Math.min(gl, ann.end + PRED_FLANK);
      return (ann.strand || "+") === "-" ? we - off : ws + off;
    };
    const genomeToBin = (g: number, ann: any, flank: number) => {
      const ws = Math.max(1, ann.start - flank), we = ann.end + flank;
      return (ann.strand || "+") === "-" ? Math.floor((we - g) / safeBin) : Math.floor((g - ws) / safeBin);
    };
    const clampY = (v: number) => Math.max(0, Math.min(m.bins_y - 1, v));
    const clampX = (v: number) => Math.max(0, Math.min(m.bins_x - 1, v));
    return predictions.map((pred) => {
      const yA = genomeToBin(offToGenome(pred.s1Start, focalAnn), focalAnn, flankY);
      const yB = genomeToBin(offToGenome(pred.s1End, focalAnn), focalAnn, flankY);
      const xA = genomeToBin(offToGenome(pred.s2Start, xAnn), xAnn, flankX);
      const xB = genomeToBin(offToGenome(pred.s2End, xAnn), xAnn, flankX);
      return {
        y0: clampY(Math.min(yA, yB)), y1: clampY(Math.max(yA, yB)),
        x0: clampX(Math.min(xA, xB)), x1: clampX(Math.max(xA, xB)),
      };
    });
  }, [predictions, m, safeBin, focalAnn, xAnn, genome, flankY, flankX]);

  const accent = pickColor(focalAnn?.feature_type);
  const dispY = formatGeneName(focal, focalAnn?.feature_type);
  const dispX = partner ? formatGeneName(partner, xAnn?.feature_type) : { text: "—", italic: false };

  if (!partner || !xAnn) {
    return (
      <div className="glass grid min-h-[420px] place-items-center rounded-3xl p-8 text-center text-sm text-slate-400">
        Pick a partner from the list (double-click) to see its base-pairing contact map with <span className="mx-1 font-medium text-slate-600" style={{ fontStyle: dispY.italic ? "italic" : "normal" }}>{dispY.text}</span>.
      </div>
    );
  }

  const loading = contactsStatus === "loading" || (speciesId != null && contactsStatus === "idle");
  const error = contactsStatus === "error";

  return (
    <div className="glass rounded-3xl p-4 sm:p-5 lens-in">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-800">
          Pair contact map
          <span className="ml-2 font-normal text-slate-400">
            <span style={{ fontStyle: dispY.italic ? "italic" : "normal" }}>{dispY.text}</span>
            <span className="mx-1">×</span>
            <span style={{ fontStyle: dispX.italic ? "italic" : "normal" }}>{dispX.text}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {partners.length > 1 && (
            <select value={partner} onChange={(e) => setActivePartner(e.target.value)} className="max-w-[150px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
              {partners.map((p) => <option key={p.partner} value={p.partner}>{formatGeneName(p.partner, p.type).text}</option>)}
            </select>
          )}
          <button onClick={() => exportPNG("pair-heatmap", `${focal}_${partner}_pairMAP`)} title="Export PNG" className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800">
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* controls */}
      <div className="mb-3 grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
        <Slider label="Flank Y" value={flankY} min={0} max={1000} step={10} unit="nt" onChange={setFlankY} />
        <Slider label="Flank X" value={flankX} min={0} max={1000} step={10} unit="nt" onChange={setFlankX} />
        <Slider label="Bin" value={bin} min={5} max={50} step={5} unit="nt" onChange={setBin} />
        <Slider label="Vmax" value={vmax} min={0} max={Math.max(5, m?.max || 10)} step={1} unit={vmax === 0 ? "auto" : ""} onChange={setVmax} />
      </div>

      {loading ? (
        <LoadingPanel label="Loading chimera contacts…" />
      ) : error ? (
        <div className="grid min-h-[360px] place-items-center text-center text-sm text-red-500">
          <div><AlertCircle className="mx-auto mb-2 h-6 w-6" /> Could not load contacts. <button onClick={ensureContacts} className="ml-1 inline-flex items-center gap-1 underline"><RefreshCw className="h-3 w-3" /> retry</button></div>
        </div>
      ) : m ? (
        <Heatmap m={m} vmax={vmax || Math.max(1, m.max)} accent={accent} flankX={flankX} flankY={flankY} binUsed={safeBin} dispX={dispX} dispY={dispY} overlays={overlays} />
      ) : (
        <div className="grid min-h-[360px] place-items-center text-sm text-slate-400">No contacts fall within this window.</div>
      )}

      <PredictionPanel
        predictions={predictions}
        genStatus={genStatus}
        flankY={PRED_FLANK}
        flankX={PRED_FLANK}
        dispY={dispY}
        dispX={dispX}
      />
    </div>
  );
}

const SITE_COLORS = ["#111827", "#9ca3af"]; // black = site 1, grey = site 2

function CrossIcon({ color }: { color: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11">
      <line x1="1.5" y1="1.5" x2="9.5" y2="9.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="1.5" y1="9.5" x2="9.5" y2="1.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PredictionPanel({ predictions, genStatus, flankY, flankX, dispY, dispX }: {
  predictions: Duplex[]; genStatus: GenStatus; flankY: number; flankX: number; dispY: any; dispX: any;
}) {
  const span = (lo: number, hi: number, flank: number) => `${lo - flank + 1}–${hi - flank + 1}`;

  return (
    <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/60 p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <Dna className="h-4 w-4 text-slate-700" />
        <span className="text-sm font-semibold text-slate-800">Predicted base-pairing</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">built-in · RNAduplex-style</span>
      </div>

      {genStatus === "loading" ? (
        <div className="flex items-center gap-2 py-3 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading genome sequence…</div>
      ) : genStatus === "error" ? (
        <div className="py-3 text-sm text-red-500">Couldn't load the genome FASTA for this species.</div>
      ) : genStatus === "none" ? (
        <div className="py-2 text-sm text-slate-400">Sequence-based prediction is available for the bundled species and the demo (it needs a genome to read the RNA sequences).</div>
      ) : predictions.length === 0 ? (
        <div className="py-2 text-sm text-slate-400">No stable duplex (≤ −5 kcal/mol) predicted within ±30 nt of these features.</div>
      ) : (
        <div className="space-y-3">
          {predictions.length > 1 && (
            <div className="text-[11px] text-slate-500">Two candidate sites — pick the one whose cross aligns best with the TRIC-seq contact hotspot.</div>
          )}
          {predictions.map((pred, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700"><CrossIcon color={SITE_COLORS[i] || "#9ca3af"} /> Site {i + 1}</span>
                <Metric label="ΔG (est.)" value={`${pred.dG.toFixed(1)} kcal/mol`} strong />
                <Metric label="bp" value={`${pred.pairs}${pred.gu ? ` (${pred.gu} G·U)` : ""}`} />
                <Metric label={dispY.text} value={`nt ${span(pred.s1Start, pred.s1End, flankY)}`} italic={dispY.italic} />
                <Metric label={dispX.text} value={`nt ${span(pred.s2Start, pred.s2End, flankX)}`} italic={dispX.italic} />
              </div>
              <div className="overflow-x-auto rounded-lg bg-slate-50 px-3 py-2">
                <pre className="text-[12px] leading-[1.5] text-slate-700" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
{`${pad(dispY.text)} 5′-${pred.top}-3′
${pad("")}    ${pred.mid}
${pad(dispX.text)} 3′-${pred.bot}-5′`}
                </pre>
              </div>
            </div>
          ))}
          <div className="text-[11px] leading-relaxed text-slate-400">
            Crosses on the map mark the predicted site(s): black = site 1, grey = site 2. Searched within ±30 nt of each feature. Built-in estimate (Watson–Crick + G·U, nearest-neighbour energies); approximates IntaRNA's seed but omits the accessibility term — treat ΔG as an estimate. Positions are relative to each RNA's 5′ end (≤ 0 = upstream flank).
          </div>
        </div>
      )}
    </div>
  );
}

const pad = (s: string) => (s.length >= 8 ? s.slice(0, 8) : s + " ".repeat(8 - s.length));

function Metric({ label, value, strong, italic }: { label: string; value: string; strong?: boolean; italic?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-slate-400" style={{ fontStyle: italic ? "italic" : "normal" }}>{label}</span>
      <span className={strong ? "font-bold text-slate-900" : "font-medium text-slate-700"}>{value}</span>
    </span>
  );
}

function Heatmap({ m, vmax, accent, flankX, flankY, binUsed, dispX, dispY, overlays }: any) {
  const W = 560, H = 520;
  const padL = 64, padB = 64, padT = 16, padR = 40;
  const cw = (W - padL - padR) / m.bins_x;
  const ch = (H - padT - padB) / m.bins_y;
  const yPix = (bin: number) => padT + (m.bins_y - 1 - bin) * ch;

  const cells: React.ReactNode[] = [];
  for (let yy = 0; yy < m.bins_y; yy++) {
    for (let xx = 0; xx < m.bins_x; xx++) {
      const v = m.mat[yy][xx];
      if (v <= 0) continue;
      cells.push(<rect key={`${yy}-${xx}`} x={padL + xx * cw} y={yPix(yy)} width={Math.ceil(cw) + 0.5} height={Math.ceil(ch) + 0.5} fill={heat(v / vmax)} />);
    }
  }

  const gxs = Math.floor(flankX / binUsed), gxe = gxs + m.x_len_bins - 1;
  const gys = Math.floor(flankY / binUsed), gye = gys + m.y_len_bins - 1;
  const xTicks = [[0, `-${flankX}`], [gxs, "start"], [gxe, "end"], [m.bins_x - 1, `+${flankX}`]] as const;
  const yTicks = [[0, `-${flankY}`], [gys, "start"], [gye, "end"], [m.bins_y - 1, `+${flankY}`]] as const;

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      <svg id="pair-heatmap" width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 560 }} className="block">
        <defs><style>{`text{font-family:ui-sans-serif,system-ui;font-size:10px;fill:#64748b}`}</style></defs>
        <rect x={padL} y={padT} width={W - padL - padR} height={H - padT - padB} fill="#fff" stroke="#e2e8f0" />
        {cells}
        {(overlays as any[]).map((ov, i) => {
          const xC = padL + ((ov.x0 + ov.x1 + 1) / 2) * cw;
          const yC = yPix(ov.y1) + ((ov.y1 - ov.y0 + 1) * ch) / 2;
          const a = 7, col = SITE_COLORS[i] || "#9ca3af";
          return (
            <g key={i} pointerEvents="none">
              <line x1={xC - a} y1={yC - a} x2={xC + a} y2={yC + a} stroke="#fff" strokeWidth={4.5} strokeLinecap="round" />
              <line x1={xC - a} y1={yC + a} x2={xC + a} y2={yC - a} stroke="#fff" strokeWidth={4.5} strokeLinecap="round" />
              <line x1={xC - a} y1={yC - a} x2={xC + a} y2={yC + a} stroke={col} strokeWidth={2.2} strokeLinecap="round" />
              <line x1={xC - a} y1={yC + a} x2={xC + a} y2={yC - a} stroke={col} strokeWidth={2.2} strokeLinecap="round" />
            </g>
          );
        })}
        <rect x={padL} y={padT} width={W - padL - padR} height={H - padT - padB} fill="none" stroke="#cbd5e1" />
        {(overlays as any[]).map((_, i) => (
          <g key={`lg${i}`} transform={`translate(${padL + 5},${padT + 6 + i * 13})`}>
            <line x1={0} y1={0} x2={9} y2={9} stroke={SITE_COLORS[i] || "#9ca3af"} strokeWidth={2} strokeLinecap="round" />
            <line x1={0} y1={9} x2={9} y2={0} stroke={SITE_COLORS[i] || "#9ca3af"} strokeWidth={2} strokeLinecap="round" />
            <text x={15} y={8.5} fontSize={9.5} fill="#64748b">site {i + 1}</text>
          </g>
        ))}
        {xTicks.map(([b, l], i) => (
          <g key={i} transform={`translate(${padL + (Number(b) / m.bins_x) * (W - padL - padR)},${H - padB})`}>
            <line y2={5} stroke="#94a3b8" /><text y={17} textAnchor="middle">{l}</text>
          </g>
        ))}
        {yTicks.map(([b, l], i) => (
          <g key={i} transform={`translate(${padL},${yPix(Number(b)) + ch / 2})`}>
            <line x2={-5} stroke="#94a3b8" /><text x={-9} y={3} textAnchor="end">{l}</text>
          </g>
        ))}
        <text x={padL + (W - padL - padR) / 2} y={H - 8} textAnchor="middle" fontSize={11} style={{ fontStyle: dispX.italic ? "italic" : "normal" }} fill="#475569">{dispX.text} (5′→3′)</text>
        <text transform={`translate(16,${padT + (H - padT - padB) / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} style={{ fontStyle: dispY.italic ? "italic" : "normal" }} fill="#475569">{dispY.text} (5′→3′)</text>
      </svg>
      <ColorBar vmax={vmax} />
    </div>
  );
}

function ColorBar({ vmax }: { vmax: number }) {
  const BAR_H = 200;
  const grad = `linear-gradient(to top, ${[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => heat(t)).join(", ")})`;
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5 pt-1">
      <div className="text-[10px] font-medium text-slate-400">reads</div>
      <div className="flex items-stretch gap-1.5" style={{ height: BAR_H }}>
        <div className="w-3 rounded-sm border border-slate-200" style={{ background: grad }} />
        <div className="flex flex-col justify-between text-[10px] text-slate-400">
          <span>{Math.round(vmax)}</span>
          <span>0</span>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (n: number) => void }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
        <span>{label}</span>
        <span className="font-medium text-slate-600">{value === 0 && unit === "auto" ? "auto" : `${value}${unit && unit !== "auto" ? " " + unit : ""}`}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-slate-700" />
    </label>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="grid min-h-[360px] place-items-center">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <Loader2 className="h-7 w-7 animate-spin" />
        <div className="text-sm">{label}</div>
        <div className="h-2 w-48 overflow-hidden rounded-full shimmer" />
      </div>
    </div>
  );
}
