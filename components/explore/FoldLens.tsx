"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Download, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useExplorer } from "@/lib/explore/store";
import { formatGeneName, pickColor, exportPNG } from "@/lib/shared";
import { buildSelfMatrix, iceNormalize, buildLongProfile } from "@/lib/explore/compute";
import { heatRed as heat } from "@/lib/explore/heat";

export function FoldLens() {
  const { focal, focalAnn, contacts, contactsStatus, ensureContacts, speciesId } = useExplorer();
  const [bin, setBin] = useState(20);
  const [flank, setFlank] = useState(200);
  const [norm, setNorm] = useState<"raw" | "ice">("raw");
  const [vmax, setVmax] = useState(0);

  useEffect(() => { ensureContacts(); }, [ensureContacts]);

  const matRaw = useMemo(() => {
    if (!focalAnn || !contacts.length) return null;
    return buildSelfMatrix(contacts, focalAnn.start, focalAnn.end, focalAnn.strand, Math.min(500, flank), Math.max(1, bin));
  }, [focalAnn, contacts, flank, bin]);

  const matDisp = useMemo(() => {
    if (!matRaw) return null;
    return norm === "ice" ? iceNormalize(matRaw.raw, 40) : matRaw.raw;
  }, [matRaw, norm]);

  const dispMax = useMemo(() => {
    if (!matDisp) return 1;
    let mx = 0;
    for (const row of matDisp) for (const v of row) if (v > mx) mx = v;
    return mx || 1;
  }, [matDisp]);

  const profile = useMemo(() => {
    if (!focalAnn || !contacts.length) return null;
    return buildLongProfile(contacts, focalAnn, Math.min(500, flank), 3, 3, 0.25);
  }, [focalAnn, contacts, flank]);

  const accent = pickColor(focalAnn?.feature_type);
  const disp = formatGeneName(focal, focalAnn?.feature_type);
  const loading = contactsStatus === "loading" || (speciesId != null && contactsStatus === "idle");
  const error = contactsStatus === "error";

  return (
    <div className="glass rounded-3xl p-4 sm:p-5 lens-in">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-800">
          Structure · intramolecular contacts
          <span className="ml-2 font-normal text-slate-400" style={{ fontStyle: disp.italic ? "italic" : "normal" }}>{disp.text}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg bg-slate-100 p-0.5">
            {(["raw", "ice"] as const).map((n) => (
              <button key={n} onClick={() => setNorm(n)} className={`rounded-md px-2.5 py-1 text-xs font-medium uppercase transition ${norm === n ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{n}</button>
            ))}
          </div>
          <button onClick={() => exportPNG("fold-matrix", `${focal}_foldMAP_${norm}`)} title="Export PNG" className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800">
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-x-5 gap-y-2">
        <Slider label="Bin" value={bin} min={5} max={50} step={5} unit="nt" onChange={setBin} />
        <Slider label="Flank" value={flank} min={0} max={500} step={10} unit="nt" onChange={setFlank} />
        <Slider label="Vmax" value={vmax} min={0} max={Math.max(5, Math.ceil(dispMax))} step={Math.max(1, Math.round(dispMax / 30)) || 1} unit={vmax === 0 ? "auto" : ""} onChange={setVmax} />
      </div>

      {loading ? (
        <LoadingPanel />
      ) : error ? (
        <div className="grid min-h-[360px] place-items-center text-center text-sm text-red-500">
          <div><AlertCircle className="mx-auto mb-2 h-6 w-6" /> Could not load contacts. <button onClick={ensureContacts} className="ml-1 inline-flex items-center gap-1 underline"><RefreshCw className="h-3 w-3" /> retry</button></div>
        </div>
      ) : matRaw && matDisp ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <FoldMatrix matRaw={matRaw} matDisp={matDisp} vmax={vmax || dispMax} flank={flank} disp={disp} accent={accent} />
          {profile && <Profile profile={profile} focalAnn={focalAnn} accent={accent} />}
        </div>
      ) : (
        <div className="grid min-h-[360px] place-items-center text-sm text-slate-400">No self-contacts within this window.</div>
      )}
    </div>
  );
}

function FoldMatrix({ matRaw, matDisp, vmax, flank, disp, accent }: any) {
  const S = 460, pad = 44;
  const inner = S - pad * 2;
  const cw = inner / matRaw.nBins;
  const bStart = Math.floor((matRaw.start - matRaw.ws) / matRaw.bin);
  const bEnd = Math.floor((matRaw.end - matRaw.ws) / matRaw.bin) + 1;

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < matRaw.nBins; i++) {
    for (let j = 0; j < matRaw.nBins; j++) {
      const v = matDisp[i][j];
      if (v <= 0) continue;
      cells.push(<rect key={`${i}-${j}`} x={pad + j * cw} y={pad + i * cw} width={Math.ceil(cw) + 0.5} height={Math.ceil(cw) + 0.5} fill={heat(v / vmax)} />);
    }
  }

  return (
    <div>
      <svg id="fold-matrix" width="100%" viewBox={`0 0 ${S} ${S}`} style={{ maxWidth: 460 }} className="mx-auto block">
        <defs><style>{`text{font-family:ui-sans-serif,system-ui;font-size:10px;fill:#94a3b8}`}</style></defs>
        <rect x={pad} y={pad} width={inner} height={inner} fill="#fff" stroke="#e2e8f0" />
        <rect x={pad} y={pad} width={bStart * cw} height={inner} fill="#0f172a" opacity={0.04} />
        <rect x={pad + bEnd * cw} y={pad} width={inner - bEnd * cw} height={inner} fill="#0f172a" opacity={0.04} />
        {cells}
        <line x1={pad + bStart * cw} y1={pad} x2={pad + bStart * cw} y2={pad + inner} stroke={accent} strokeWidth={1} opacity={0.6} />
        <line x1={pad + bEnd * cw} y1={pad} x2={pad + bEnd * cw} y2={pad + inner} stroke={accent} strokeWidth={1} opacity={0.6} />
        <line x1={pad} y1={pad + bStart * cw} x2={pad + inner} y2={pad + bStart * cw} stroke={accent} strokeWidth={1} opacity={0.6} />
        <line x1={pad} y1={pad + bEnd * cw} x2={pad + inner} y2={pad + bEnd * cw} stroke={accent} strokeWidth={1} opacity={0.6} />
        <rect x={pad} y={pad} width={inner} height={inner} fill="none" stroke="#cbd5e1" />
        <text x={pad + inner / 2} y={S - 14} textAnchor="middle" fontSize={11} fill="#475569">5′ → 3′ (bins)</text>
        <text transform={`translate(14,${pad + inner / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill="#475569">5′ → 3′ (bins)</text>
      </svg>
      <div className="text-center text-[11px] text-slate-400">{matRaw.nBins} × {matRaw.nBins} bins · {matRaw.bin} nt/bin · ±{flank} nt flank</div>
    </div>
  );
}

function Profile({ profile, focalAnn, accent }: any) {
  const W = 460, H = 230, padL = 44, padR = 14, padT = 16, padB = 40;
  const iw = W - padL - padR, ih = H - padT - padB;
  const vals: number[] = profile.smooth;
  const maxY = Math.max(1, ...vals);
  const xS = (i: number) => padL + (i / Math.max(1, vals.length - 1)) * iw;
  const yS = (v: number) => padT + ih - (v / maxY) * ih;
  const gs = focalAnn ? focalAnn.start - profile.ws : 0;
  const ge = focalAnn ? focalAnn.end - profile.ws : vals.length;
  const w = Math.max(0.5, iw / Math.max(1, vals.length));

  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-500">Long-range (&gt; 5 kb) profile · {profile.peaks.length} maxima</div>
      <svg id="fold-profile" width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 460 }} className="block">
        <defs><style>{`text{font-family:ui-sans-serif,system-ui;font-size:10px;fill:#94a3b8}`}</style></defs>
        <rect x={padL} y={padT} width={gs >= 0 ? xS(gs) - padL : 0} height={ih} fill="#0f172a" opacity={0.04} />
        <rect x={xS(ge)} y={padT} width={padL + iw - xS(ge)} height={ih} fill="#0f172a" opacity={0.04} />
        {vals.map((v, i) => <rect key={i} x={xS(i)} y={yS(v)} width={Math.ceil(w)} height={padT + ih - yS(v)} fill="#cbd5e1" />)}
        {profile.peaks.map((i: number, k: number) => <circle key={k} cx={xS(i)} cy={yS(vals[i])} r={3} fill={accent} stroke="#fff" strokeWidth={1} />)}
        <line x1={xS(gs)} y1={padT} x2={xS(gs)} y2={padT + ih} stroke={accent} strokeWidth={1} opacity={0.6} />
        <line x1={xS(ge)} y1={padT} x2={xS(ge)} y2={padT + ih} stroke={accent} strokeWidth={1} opacity={0.6} />
        <line x1={padL} y1={padT + ih} x2={padL + iw} y2={padT + ih} stroke="#cbd5e1" />
        <text x={padL + iw / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#475569">window (5′ → 3′): flank — gene — flank</text>
        <text transform={`translate(14,${padT + ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={10.5} fill="#475569">smoothed events</text>
      </svg>
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

function LoadingPanel() {
  return (
    <div className="grid min-h-[360px] place-items-center">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <Loader2 className="h-7 w-7 animate-spin" />
        <div className="text-sm">Loading chimera contacts…</div>
        <div className="h-2 w-48 overflow-hidden rounded-full shimmer" />
      </div>
    </div>
  );
}
