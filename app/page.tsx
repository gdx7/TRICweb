// app/page.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Globe, Copyleft, GitMerge, Network } from "lucide-react";

const FEATURE_COLORS = ["#F78208", "#76AAD7", "#0C0C0C", "#A40194", "#82F778", "#999999", "#F12C2C", "#C4C5C5"];

type Bubble = { top: number; left: number; size: number; color: string; delay: number; dur: number; dx: number; dy: number; blur: number; };

export default function Home() {
  const bubbles = useMemo<Bubble[]>(() => {
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    return Array.from({ length: 30 }).map(() => ({
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
      {/* background gradient element */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-slate-100/50 to-transparent dark:from-slate-900/50 dark:to-transparent pointer-events-none -z-10" />

      {/* floating outline circles */}
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
      <section className="relative mx-auto max-w-6xl px-6 pt-16 pb-12 sm:pt-24 sm:pb-16 min-h-[70svh] flex flex-col justify-center">
        {/* Title row: bigger logo, smaller title */}
        <div className="flex items-center gap-4">
          <img src="/tric-logo.png" alt="TRIC-seq logo" className="h-16 w-16 sm:h-20 sm:w-20 drop-shadow-md dark:brightness-110" />
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">TRIC-seq</h1>
        </div>

        <p className="mt-5 text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
          Explore global RNA–RNA interactions and structures in bacteria.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 md:grid-cols-4 z-10">
          <ToolCard title="globalMAP" href="/global" desc="RNA-centric global interaction map with clickable partners" icon={Globe} />
          <ToolCard title="csMAP" href="/csmap" desc="Multi-RNA comparative target profiles" icon={Copyleft} />
          <ToolCard title="pairMAP" href="/pairmap" desc="Inter-RNA heatmaps for binding sites" icon={GitMerge} />
          <ToolCard title="foldMAP" href="/foldmap" desc="Structural contact maps of RNAs" icon={Network} />
        </div>
      </section>
    </div>
  );
}

function ToolCard({ title, desc, href, icon: Icon }: { title: string; desc: string; href: string, icon: React.ElementType }) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all duration-300 hover:-translate-y-1.5 p-6 h-full ring-1 ring-transparent hover:ring-slate-300/50 dark:hover:ring-slate-700/50 focus-visible:ring-2 focus-visible:ring-slate-400 focus:outline-none overflow-hidden relative"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-50/10 dark:to-slate-800/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div className="relative z-10">
        <div className="mb-5 inline-flex flex-shrink-0 items-center justify-center p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-slate-800 group-hover:text-white dark:group-hover:bg-slate-100 dark:group-hover:text-slate-900 shadow-sm transition-colors">
          <Icon className="h-6 w-6" />
        </div>
        <div className="text-xl font-bold mb-2 tracking-tight text-slate-900 dark:text-slate-100">{title}</div>
        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{desc}</p>
      </div>
      <div className="mt-8 relative z-10 inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
        Explore <span className="transition-transform duration-300 group-hover:translate-x-1.5">→</span>
      </div>
    </Link>
  );
}
