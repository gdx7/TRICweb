// app/page.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";

const FEATURE_COLORS = ["#F78208","#76AAD7","#0C0C0C","#A40194","#82F778","#999999","#F12C2C","#C4C5C5"];

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
    <div className="relative overflow-x-hidden">
      {/* floating outline circles */}
      <div className="pointer-events-none absolute inset-x-0 top-0" style={{ bottom: "-6vh" }}>
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

      {/* HERO — previously 80svh, now ~65svh (15% less) */}
      <section className="relative mx-auto max-w-5xl px-6 pt-14 pb-2 sm:pt-18 sm:pb-3 min-h-[65svh]">
        {/* Title row: bigger logo, smaller title */}
        <div className="flex items-center gap-3">
          <img src="/tric-logo.png" alt="TRIC-seq logo" className="h-16 w-16 sm:h-20 sm:w-20" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">TRIC-seq</h1>
        </div>

        <p className="mt-4 text-lg text-slate-600 max-w-3xl">
          Explore global RNA–RNA interactions in bacteria:
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <ToolCard title="globalMAP" href="/global" desc="RNA-centric global interaction maps" />
          <ToolCard title="csMAP" href="/csmap" desc="Multi-RNA comparative target profiles" />
          <ToolCard title="pairMAP" href="/pairmap" desc="Inter-RNA heatmaps for binding sites" />
          <ToolCard title="foldMAP" href="/foldmap" desc="Structural contact maps of RNAs" />
        </div>
      </section>
    </div>
  );
}

function ToolCard({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border bg-white/80 backdrop-blur shadow-sm hover:shadow-md transition
                 p-6 ring-1 ring-slate-200 hover:ring-slate-300"
    >
      <div className="text-xl font-semibold">{title}</div>
      <p className="mt-2 text-slate-600 text-sm">{desc}</p>
      <div className="mt-4 inline-flex items-center gap-1 text-blue-600 group-hover:gap-2 transition">
        Open →
      </div>
    </Link>
  );
}
