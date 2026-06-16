"use client";

import React, { useState } from "react";
import { Pin, Grid2x2, ExternalLink, ArrowUpDown, Download, Sparkles, X } from "lucide-react";
import { useExplorer, SortKey } from "@/lib/explore/store";
import { formatGeneName, pickColor, combinedLabel } from "@/lib/shared";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "odds_ratio", label: "Odds ratio" },
  { key: "counts", label: "Reads" },
  { key: "fdr", label: "FDR" },
  { key: "distance", label: "Distance" },
  { key: "start", label: "Position" },
];

export function PartnersPanel({ onOpenPair }: { onOpenPair: () => void }) {
  const {
    focal, focalAnn, focalTotal, partners, sortedPartners, sortKey, sortDesc, setSort,
    setFocal, setActivePartner, effectiveActivePartner, pinned, togglePin, clearPins, dbLink,
  } = useExplorer();
  const [hyp, setHyp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const focalDisp = formatGeneName(focal, focalAnn?.feature_type);
  const focalLbl = combinedLabel((focalAnn?.feature_type as any) || "CDS");
  const accent = pickColor(focalAnn?.feature_type);
  const activeName = effectiveActivePartner?.partner;
  const link = dbLink(focal);

  const exportCSV = () => {
    const header = ["Partner", "Feature", "Start", "End", "reads", "odds_ratio", "FDR", "Distance"];
    const rows = sortedPartners.map((p) => [p.partner, combinedLabel(p.type as any).label, p.start, p.end, p.counts, p.rawY.toFixed(3), p.fdr != null ? p.fdr.toExponential(3) : "", p.distance]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${focal}_partners.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const genHypothesis = async () => {
    setBusy(true); setHyp(null);
    try {
      const valid = partners.filter((p) => p.counts >= 5 && p.rawY >= 10);
      const info = valid.slice(0, 50).map((p) => `- ${p.partner} (${combinedLabel(p.type as any).label}): reads=${p.counts}, OR=${p.rawY.toFixed(2)}${p.fdr != null ? `, FDR=${p.fdr.toExponential(2)}` : ""}`).join("\n");
      if (!info.trim()) { setHyp("Not enough high-confidence partners (reads ≥ 5 and OR ≥ 10) for a robust hypothesis."); setBusy(false); return; }
      const res = await fetch("/api/hypothesis", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focal, focalFeatureType: focalAnn?.feature_type || "Unknown", partnersInfo: info }),
      });
      const data = await res.json();
      setHyp(res.ok && data.hypothesis ? data.hypothesis : `Unavailable: ${data.error || "failed"}`);
    } catch (e: any) {
      setHyp(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass flex h-full flex-col rounded-3xl">
      {/* focal summary */}
      <div className="rounded-t-3xl border-b border-slate-100 p-4" style={{ background: `linear-gradient(180deg, ${accent}14, transparent)` }}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: "#fff", boxShadow: `inset 0 0 0 3px ${accent}` }} />
              <span className="text-lg font-bold text-slate-900" style={{ fontStyle: focalDisp.italic ? "italic" : "normal" }}>{focalDisp.text}</span>
              {link && (
                <a href={link} target="_blank" rel="noreferrer" title="Open in gene database" className="text-slate-400 hover:text-slate-700">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">{focalLbl.label}{focalAnn && <> · {focalAnn.start.toLocaleString()}–{focalAnn.end.toLocaleString()} · {(focalAnn.strand as string) || "+"}</>}</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="Interactions" value={focalTotal.toLocaleString()} />
          <Stat label="Partners shown" value={String(partners.length)} />
        </div>
      </div>

      {/* sort */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Partners</span>
        <div className="ml-auto flex items-center gap-1">
          <ArrowUpDown className="h-3 w-3 text-slate-400" />
          <select value={sortKey} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600">
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <span className="text-xs text-slate-400">{sortDesc ? "↓" : "↑"}</span>
        </div>
      </div>

      {/* list */}
      <div className="min-h-0 flex-1 overflow-auto px-2">
        {sortedPartners.length === 0 && <div className="px-3 py-8 text-center text-sm text-slate-400">No partners pass the current filters.</div>}
        <ul className="space-y-0.5 pb-2">
          {sortedPartners.map((p) => {
            const disp = formatGeneName(p.partner, p.type);
            const col = pickColor(p.type);
            const isActive = p.partner === activeName;
            const isPinned = pinned.includes(p.partner);
            return (
              <li key={p.partner}>
                <div
                  className={`group flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-1.5 transition ${isActive ? "bg-slate-900/[0.06] ring-1 ring-slate-900/10" : "hover:bg-slate-50"}`}
                  onClick={() => setFocal(p.partner)}
                  onDoubleClick={() => { setActivePartner(p.partner); onOpenPair(); }}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "#fff", boxShadow: `inset 0 0 0 2.5px ${col}` }} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700" style={{ fontStyle: disp.italic ? "italic" : "normal" }}>{disp.text}</span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="text-xs font-semibold text-slate-700">{p.rawY >= 1000 ? `${(p.rawY / 1000).toFixed(1)}k` : p.rawY.toFixed(0)}</span>
                    <span className="ml-1 text-[10px] text-slate-400">{p.counts}r</span>
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                    <button title="Pin to compare" onClick={(e) => { e.stopPropagation(); togglePin(p.partner); }} className={`grid h-6 w-6 place-items-center rounded-md ${isPinned ? "bg-slate-900 text-white" : "text-slate-400 hover:bg-slate-200"}`}>
                      <Pin className="h-3 w-3" />
                    </button>
                    <button title="Open pair contact map" onClick={(e) => { e.stopPropagation(); setActivePartner(p.partner); onOpenPair(); }} className="grid h-6 w-6 place-items-center rounded-md text-slate-400 hover:bg-slate-200">
                      <Grid2x2 className="h-3 w-3" />
                    </button>
                  </div>
                  {isPinned && <Pin className="h-3 w-3 shrink-0 text-slate-900 group-hover:hidden" />}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* footer */}
      <div className="border-t border-slate-100 p-3">
        {pinned.length > 0 && (
          <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-medium">{pinned.length} pinned</span>
            <button onClick={clearPins} className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-slate-400 hover:bg-slate-100"><X className="h-3 w-3" /> clear</button>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={genHypothesis} disabled={busy || partners.length === 0} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
            <Sparkles className="h-3.5 w-3.5" /> {busy ? "Thinking…" : "AI hypothesis"}
          </button>
          <button onClick={exportCSV} title="Export partner table (CSV)" className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-800">
            <Download className="h-4 w-4" />
          </button>
        </div>
        {hyp && (
          <div className="mt-2 max-h-44 overflow-auto rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs leading-relaxed text-slate-700">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold text-slate-800">Hypothesis</span>
              <button onClick={() => setHyp(null)} className="text-slate-400 hover:text-slate-600"><X className="h-3 w-3" /></button>
            </div>
            <div className="whitespace-pre-wrap">{hyp}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/70 px-3 py-2">
      <div className="text-base font-bold tabular-nums text-slate-900">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}
