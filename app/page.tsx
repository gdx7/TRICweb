// app/page.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Globe, Copyleft, GitMerge, Network, ArrowRight, Sparkles, Orbit, Grid2x2, Atom, Columns3 } from "lucide-react";

const FEATURE_COLORS = ["#F78208", "#76AAD7", "#0C0C0C", "#A40194", "#82F778", "#999999", "#F12C2C", "#C4C5C5"];

type Bubble = { top: number; left: number; size: number; color: string; delay: number; dur: number; dx: number; dy: number; blur: number };

export default function Home() {
  const bubbles = useMemo<Bubble[]>(() => {
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    return Array.from({ length: 26 }).map(() => ({
      top: rand(5, 80),
      left: rand(5, 90),
      size: rand(60, 220),
      color: FEATURE_COLORS[Math.floor(Math.random() * FEATURE_COLORS.length)],
      delay: rand(-6, 6),
      dur: rand(8, 13),
      dx: rand(-30, 30),
      dy: rand(-22, 22),
      blur: rand(2, 6),
    }));
  }, []);

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-slate-100/50 to-transparent pointer-events-none -z-10" />

      <div className="pointer-events-none absolute inset-x-0 top-0 -z-5" style={{ bottom: "-6vh" }}>
        {bubbles.map((b, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-transparent"
            style={{
              top: `${b.top}vh`,
              left: `${b.left}vw`,
              width: b.size,
              height: b.size,
              border: `3px solid ${b.color}`,
              filter: `blur(${b.blur}px)`,
              animation: `drift ${b.dur}s ease-in-out ${b.delay}s infinite`,
              // @ts-ignore
              "--dx": `${b.dx}px`,
              "--dy": `${b.dy}px`,
            }}
          />
        ))}
      </div>

      {/* HERO */}
      <section className="relative mx-auto max-w-6xl px-6 pt-16 pb-10 sm:pt-24 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-500 backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" /> New · one seamless workspace
        </div>

        <div className="mt-6 flex items-center gap-4">
          <img src="/tric-logo.png" alt="TRIC-seq logo" className="h-16 w-16 sm:h-20 sm:w-20 drop-shadow-md" />
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900">TRIC-seq</h1>
        </div>

        <p className="mt-5 max-w-2xl text-lg sm:text-xl text-slate-600 leading-relaxed">
          Explore global RNA–RNA interactions and structures in bacteria — now unified into a single,
          intuitive explorer where every tool follows the RNA you're studying.
        </p>

        <div className="mt-9 flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/explore"
            className="group inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3.5 text-base font-semibold text-white shadow-xl shadow-slate-900/20 transition hover:bg-slate-800 hover:shadow-2xl"
          >
            Open the Explorer
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/help" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-6 py-3.5 text-base font-semibold text-slate-700 backdrop-blur transition hover:bg-white">
            Read the guide
          </Link>
        </div>

        {/* lens preview chips */}
        <div className="mt-10 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          <LensChip icon={Orbit} title="Interactome" desc="Genome-wide partners" />
          <LensChip icon={Grid2x2} title="Pair" desc="Base-pairing maps" />
          <LensChip icon={Atom} title="Structure" desc="Intramolecular folds" />
          <LensChip icon={Columns3} title="Compare" desc="Side-by-side spectra" />
        </div>
      </section>

      {/* INDIVIDUAL TOOLS */}
      <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-6">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Or jump straight to a single tool</h2>
            <p className="text-sm text-slate-500">The classic standalone views, still here for focused analysis.</p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-4">
          <ToolCard title="globalMAP" href="/global" desc="RNA-centric global interaction map with clickable partners" icon={Globe} />
          <ToolCard title="csMAP" href="/csmap" desc="Multi-RNA comparative target profiles" icon={Copyleft} />
          <ToolCard title="pairMAP" href="/pairmap" desc="Inter-RNA heatmaps for binding sites" icon={GitMerge} />
          <ToolCard title="foldMAP" href="/foldmap" desc="Structural contact maps of RNAs" icon={Network} />
        </div>
      </section>
    </div>
  );
}

function LensChip({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-slate-200/70 bg-white/60 px-3 py-4 backdrop-blur">
      <Icon className="h-5 w-5 text-slate-700" />
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      <div className="text-[11px] text-slate-400">{desc}</div>
    </div>
  );
}

function ToolCard({ title, desc, href, icon: Icon }: { title: string; desc: string; href: string; icon: React.ElementType }) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between rounded-2xl border border-slate-200/60 bg-white/50 backdrop-blur-xl shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 hover:-translate-y-1.5 p-6 h-full ring-1 ring-transparent hover:ring-slate-300/50 focus-visible:ring-2 focus-visible:ring-slate-400 focus:outline-none overflow-hidden relative"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-50/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div className="relative z-10">
        <div className="mb-5 inline-flex flex-shrink-0 items-center justify-center p-3 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-slate-800 group-hover:text-white shadow-sm transition-colors">
          <Icon className="h-6 w-6" />
        </div>
        <div className="text-xl font-bold mb-2 tracking-tight text-slate-900">{title}</div>
        <p className="text-slate-600 text-sm leading-relaxed">{desc}</p>
      </div>
      <div className="mt-8 relative z-10 inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-500 group-hover:text-slate-900 transition-colors">
        Explore <span className="transition-transform duration-300 group-hover:translate-x-1.5">→</span>
      </div>
    </Link>
  );
}
