"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Orbit, Grid2x2, Atom, Columns3, SlidersHorizontal, ChevronLeft, BookOpen, AlertCircle, X } from "lucide-react";
import { useExplorer } from "@/lib/explore/store";
import { GeneCombobox } from "./GeneCombobox";
import { SpeciesMenu } from "./SpeciesMenu";
import { PartnersPanel } from "./PartnersPanel";
import { InteractomeLens } from "./InteractomeLens";
import { PairLens } from "./PairLens";
import { FoldLens } from "./FoldLens";
import { CompareLens } from "./CompareLens";
import type { FeatureType } from "@/lib/shared";

type Lens = "interactome" | "pair" | "structure" | "compare";

const LENSES: { id: Lens; label: string; icon: React.ElementType; hint: string }[] = [
  { id: "interactome", label: "Interactome", icon: Orbit, hint: "Genome-wide partners" },
  { id: "pair", label: "Pair", icon: Grid2x2, hint: "Base-pairing contact map" },
  { id: "structure", label: "Structure", icon: Atom, hint: "Intramolecular fold" },
  { id: "compare", label: "Compare", icon: Columns3, hint: "Side-by-side spectra" },
];

export function ExplorerShell() {
  const { sourceLabel, dataStatus, dataError, pinned } = useExplorer();
  const [lens, setLens] = useState<Lens>("interactome");

  return (
    <div className="explorer-bg min-h-screen">
      {/* top bar */}
      <header className="sticky top-0 z-40 border-b border-white/40 bg-white/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-slate-500 transition hover:text-slate-800">
            <ChevronLeft className="h-4 w-4" />
            <img src="/tric-logo.png" alt="TRIC-seq" className="h-7 w-7" />
          </Link>
          <div className="hidden shrink-0 sm:block">
            <div className="text-sm font-bold leading-tight text-slate-900">TRIC-seq Explorer</div>
            <div className="text-[11px] leading-tight text-slate-400">one RNA · every lens</div>
          </div>
          <div className="mx-auto flex w-full max-w-md justify-center px-2">
            <GeneCombobox />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <FiltersButton />
            <SpeciesMenu />
            <Link href="/help" title="Guide" className="hidden h-9 w-9 place-items-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-500 hover:text-slate-800 sm:grid">
              <BookOpen className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {dataError && dataStatus === "error" && (
        <div className="mx-auto mt-3 flex max-w-[1500px] items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> Couldn't load {sourceLabel}: {dataError}. The simulated demo is still available from the dataset menu.
        </div>
      )}

      <main className="mx-auto max-w-[1500px] px-4 py-5">
        {/* lens tabs */}
        <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
          {LENSES.map((l) => {
            const active = lens === l.id;
            const Icon = l.icon;
            return (
              <button
                key={l.id}
                onClick={() => setLens(l.id)}
                className={`group flex shrink-0 items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-left transition ${active ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/10" : "border-white/60 bg-white/60 text-slate-600 hover:border-slate-200 hover:bg-white"}`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-white" : "text-slate-400 group-hover:text-slate-600"}`} />
                <div>
                  <div className="text-sm font-semibold leading-tight">{l.label}</div>
                  <div className={`text-[11px] leading-tight ${active ? "text-slate-300" : "text-slate-400"}`}>{l.hint}</div>
                </div>
                {l.id === "compare" && pinned.length > 0 && (
                  <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-white/20" : "bg-slate-900 text-white"}`}>{pinned.length}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* workspace */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8 xl:col-span-9">
            {lens === "interactome" && <InteractomeLens />}
            {lens === "pair" && <PairLens />}
            {lens === "structure" && <FoldLens />}
            {lens === "compare" && <CompareLens />}
          </div>
          <aside className="lg:col-span-4 xl:col-span-3">
            <div className="lg:sticky lg:top-[84px] lg:h-[calc(100vh-104px)]">
              <PartnersPanel onOpenPair={() => setLens("pair")} />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

const EXCLUDE_GROUPS: { label: string; types: FeatureType[] }[] = [
  { label: "tRNA", types: ["tRNA"] },
  { label: "5'UTR", types: ["5'UTR"] },
  { label: "3'UTR", types: ["3'UTR"] },
  { label: "CDS", types: ["CDS"] },
  { label: "sponge", types: ["sponge"] },
  { label: "sRNA/ncRNA", types: ["sRNA", "ncRNA"] },
  { label: "rRNA/hkRNA", types: ["hkRNA", "rRNA"] },
];

function FiltersButton() {
  const { minCounts, yCap, labelThreshold, sizeScale, excludeTypes, setMinCounts, setYCap, setLabelThreshold, setSizeScale, toggleExclude, highlight, setHighlight } = useExplorer();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [hl, setHl] = useState("");

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const active = minCounts !== 5 || yCap !== 1000 || labelThreshold !== 10 || excludeTypes.length !== 1 || highlight.size > 0;

  const applyHl = (s: string) => {
    setHl(s);
    setHighlight(new Set(s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean)));
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className={`relative grid h-9 w-9 place-items-center rounded-xl border bg-white/80 transition ${active ? "border-slate-900 text-slate-900" : "border-slate-200/80 text-slate-500 hover:text-slate-800"}`} title="Filters">
        <SlidersHorizontal className="h-4 w-4" />
        {active && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-slate-900 ring-2 ring-white" />}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-slate-200/80 bg-white/95 p-4 backdrop-blur-xl shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">Filters</span>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-3">
            <Range label="Min reads (iₒ)" value={minCounts} min={0} max={50} step={1} onChange={setMinCounts} />
            <Range label="Odds-ratio cap (Oᶠ)" value={yCap} min={10} max={5000} step={10} onChange={setYCap} />
            <Range label="Label threshold" value={labelThreshold} min={0} max={500} step={5} onChange={setLabelThreshold} />
            <Range label={`Circle size ×${sizeScale.toFixed(1)}`} value={sizeScale} min={0.2} max={2} step={0.1} onChange={setSizeScale} hideValue />
          </div>

          <div className="mt-4">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Exclude feature types</div>
            <div className="flex flex-wrap gap-1.5">
              {EXCLUDE_GROUPS.map((g) => {
                const on = g.types.every((t) => excludeTypes.includes(t));
                return (
                  <button key={g.label} onClick={() => toggleExclude(g.types)} className={`rounded-lg border px-2 py-1 text-xs transition ${on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>{g.label}</button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Highlight genes</div>
            <input value={hl} onChange={(e) => applyHl(e.target.value)} placeholder="e.g. gene4, gene12" className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-300" />
            <div className="mt-1 text-[11px] text-slate-400">Highlighted partners glow yellow in the map.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Range({ label, value, min, max, step, onChange, hideValue }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; hideValue?: boolean }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        {!hideValue && <span className="font-medium text-slate-700">{value}</span>}
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-slate-900" />
    </label>
  );
}
