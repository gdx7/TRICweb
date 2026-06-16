"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, CornerDownLeft } from "lucide-react";
import { useExplorer } from "@/lib/explore/store";
import { formatGeneName, pickColor, combinedLabel } from "@/lib/shared";

export function GeneCombobox() {
  const { allGenes, geneIndex, setFocal, focal } = useExplorer();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K focuses the search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    const starts: string[] = [];
    const incl: string[] = [];
    for (const g of allGenes) {
      const gl = g.toLowerCase();
      if (gl === query) starts.unshift(g);
      else if (gl.startsWith(query)) starts.push(g);
      else if (gl.includes(query)) incl.push(g);
      if (starts.length + incl.length > 60) break;
    }
    return [...starts, ...incl].slice(0, 24);
  }, [q, allGenes]);

  useEffect(() => setActive(0), [q]);

  const choose = (g: string) => {
    setFocal(g);
    setQ("");
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 shadow-sm focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-slate-300/40 transition">
        <Search className="h-4 w-4 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter" && results[active]) { e.preventDefault(); choose(results[active]); }
            else if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search any RNA…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-slate-200 bg-slate-100 px-1.5 font-mono text-[10px] text-slate-500">
          <span className="text-xs">⌘</span>K
        </kbd>
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-2xl">
          <ul className="max-h-80 overflow-auto py-1">
            {results.map((g, i) => {
              const ann = geneIndex[g];
              const disp = formatGeneName(g, ann?.feature_type);
              const color = pickColor(ann?.feature_type);
              const lbl = combinedLabel((ann?.feature_type as any) || "CDS");
              return (
                <li key={g}>
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(g)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${i === active ? "bg-slate-100" : "hover:bg-slate-50"}`}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2" style={{ background: "#fff", boxShadow: `inset 0 0 0 2.5px ${color}` }} />
                    <span className="font-medium text-slate-800" style={{ fontStyle: disp.italic ? "italic" : "normal" }}>{disp.text}</span>
                    <span className="text-xs text-slate-400">{lbl.label}</span>
                    {ann && <span className="ml-auto text-[11px] text-slate-400">{ann.start.toLocaleString()}</span>}
                    {g === focal && <span className="ml-2 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">focal</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">
            <span>↑↓ to navigate</span>
            <span className="inline-flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> to focus</span>
          </div>
        </div>
      )}
    </div>
  );
}
