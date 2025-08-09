// app/page.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";

// same palette as your plots (stroke-only circles)
const FEATURE_COLORS = [
  "#F78208", // CDS
  "#76AAD7", // 5'UTR
  "#0C0C0C", // 3'UTR
  "#A40194", // ncRNA/sRNA magenta
  "#82F778", // tRNA
  "#999999", // rRNA
  "#F12C2C", // sponge
  "#C4C5C5", // hkRNA
];

type Bubble = { top: number; left: number; size: number; color: string; delay: number; dur: number; dx: number; dy: number; blur: number; };

export default function Home() {
  // generate a handful of softly drifting, blurred outline circles
  const bubbles = useMemo<Bubble[]>(() => {
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    return Array.from({ length: 22 }).map(() => ({
      top: rand(5, 80),      // vh
      left: rand(5, 90),     // vw
      size: rand(60, 220),   // px
      color: FEATURE_COLORS[Math.floor(Math.random() * FEATURE_COLORS.length)],
      delay: rand(-8, 8),    // s
      dur: rand(14, 26),     // s
      dx: rand(-22, 22),     // px
      dy: rand(-14, 14),     // px
      blur: rand(0, 2.5),    // px
    }));
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* floating outline circles */}
      <div className="pointer-events-none absolute inset-0">
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
              // custom per-bubble offsets
              // @ts-ignore
              "--dx": `${b.dx}px`,
              "--dy": `${b.dy}px`,
            }}
          />
        ))}
      </div>

      {/* hero content */}
      <section className="relative mx-auto max-w-5xl px-6 py-20 sm:py-28">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          TRIC-seq Interactome Explorer
        </h1>
        <p className="mt-4 text-lg text-slate-600 max-w-3xl">
          Explore E. coli RNA–RNA interactomes. Upload your pairs + annotation tables or try the simulator.
          Click a tool to begin:
        </p>

        {/* big buttons */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <ToolCard title="globalMAP" href="/global" desc="Gene-centric global interaction map with clickable partners." />
          <ToolCard title="csMAP" href="/csmap" desc="Collapsed multi-gene profiles and totals (local peaks)." />
          <ToolCard title="pairMAP" href="/pairmap" desc="Inter-RNA multi-panel heatmaps from raw chimeras." />
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
