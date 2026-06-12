"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Download, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useExplorer } from "@/lib/explore/store";
import { formatGeneName, pickColor, exportPNG } from "@/lib/shared";
import { buildPairMatrix } from "@/lib/explore/compute";
import { heatWarm as heat } from "@/lib/explore/heat";

export function PairLens() {
  const { focal, focalAnn, effectiveActivePartner, geneIndex, contacts, contactsStatus, ensureContacts, speciesId, partners, setActivePartner } = useExplorer();
  const [flankY, setFlankY] = useState(300);
  const [flankX, setFlankX] = useState(300);
  const [bin, setBin] = useState(10);
  const [vmax, setVmax] = useState(0); // 0 = auto

  useEffect(() => { ensureContacts(); }, [ensureContacts]);

  const partner = effectiveActivePartner?.partner;
  const xAnn = partner ? geneIndex[partner] : undefined;

  const m = useMemo(() => {
    if (!focalAnn || !xAnn || !contacts.length) return null;
    // keep cell counts sane regardless of gene size
    const lenY = (focalAnn.end - focalAnn.start) + flankY * 2;
    const lenX = (xAnn.end - xAnn.start) + flankX * 2;
    const safeBin = Math.max(bin, Math.ceil(Math.max(lenY, lenX) / 200));
    return buildPairMatrix(contacts, focalAnn, xAnn, flankY, flankX, safeBin, partner!);
  }, [focalAnn, xAnn, contacts, flankY, flankX, bin, partner]);

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
        <Heatmap m={m} vmax={vmax || Math.max(1, m.max)} accent={accent} flankX={flankX} flankY={flankY} binUsed={Math.max(bin, Math.ceil(Math.max((focalAnn!.end - focalAnn!.start) + flankY * 2, (xAnn.end - xAnn.start) + flankX * 2) / 200))} dispX={dispX} dispY={dispY} />
      ) : (
        <div className="grid min-h-[360px] place-items-center text-sm text-slate-400">No contacts fall within this window.</div>
      )}
    </div>
  );
}

function Heatmap({ m, vmax, accent, flankX, flankY, binUsed, dispX, dispY }: any) {
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
        <rect x={padL} y={padT} width={W - padL - padR} height={H - padT - padB} fill="none" stroke="#cbd5e1" />
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
  const stops = Array.from({ length: 24 }, (_, i) => i / 23);
  return (
    <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-start">
      <div className="text-[10px] font-medium text-slate-400">reads</div>
      <div className="flex sm:flex-col-reverse">
        <div className="flex h-3 w-40 overflow-hidden rounded sm:h-40 sm:w-3 sm:flex-col-reverse">
          {stops.map((t, i) => <div key={i} className="flex-1" style={{ background: heat(t) }} />)}
        </div>
      </div>
      <div className="flex w-40 justify-between text-[10px] text-slate-400 sm:w-auto sm:flex-col-reverse sm:items-start sm:gap-[8.6rem]">
        <span>0</span><span>{Math.round(vmax)}</span>
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
