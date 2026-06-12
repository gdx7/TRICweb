"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Database, FlaskConical, Check, Loader2, AlertCircle, Upload } from "lucide-react";
import { useExplorer, SPECIES } from "@/lib/explore/store";

export function SpeciesMenu() {
  const { speciesId, sourceLabel, dataStatus, loadSpecies, loadDemo, onAnnoFile, onPairsFile } = useExplorer();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const annoRef = useRef<HTMLInputElement>(null);
  const pairsRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-white transition"
      >
        {dataStatus === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : dataStatus === "error" ? (
          <AlertCircle className="h-4 w-4 text-red-500" />
        ) : (
          <Database className="h-4 w-4 text-slate-400" />
        )}
        <span className="max-w-[140px] truncate">{sourceLabel}</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-2xl">
          <div className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Dataset</div>

          <button
            onClick={() => { loadDemo(); setOpen(false); }}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
          >
            <FlaskConical className="h-4 w-4 text-violet-500" />
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-800">Simulated demo</div>
              <div className="text-[11px] text-slate-400">Self-consistent across all lenses · instant</div>
            </div>
            {speciesId == null && <Check className="h-4 w-4 text-slate-900" />}
          </button>

          <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">TRIC-seq species</div>
          {SPECIES.map((s) => (
            <button
              key={s.id}
              onClick={() => { loadSpecies(s.id); setOpen(false); }}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
            >
              <span className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-600">{s.id}</span>
              <div className="flex-1">
                <div className="text-sm font-medium italic text-slate-800">{s.latin}</div>
                <div className="text-[11px] text-slate-400">{s.blurb}</div>
              </div>
              {speciesId === s.id && <Check className="h-4 w-4 text-slate-900" />}
            </button>
          ))}

          <div className="border-t border-slate-100 px-3 py-2">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Your data</div>
            <div className="flex gap-2">
              <input ref={annoRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { onAnnoFile(f); setOpen(false); } }} />
              <input ref={pairsRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { onPairsFile(f); setOpen(false); } }} />
              <button onClick={() => annoRef.current?.click()} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                <Upload className="h-3 w-3" /> Annotations
              </button>
              <button onClick={() => pairsRef.current?.click()} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                <Upload className="h-3 w-3" /> Interactions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
