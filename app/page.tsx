// app/page.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Sora } from "next/font/google";

const sora = Sora({ subsets: ["latin"] });

const FEATURE_COLORS = ["#F78208","#76AAD7","#0C0C0C","#A40194","#82F778","#999999","#F12C2C","#C4C5C5"];

type Bubble = {
  top: number; left: number; size: number; color: string;
  delay: number; dur: number; dx: number; dy: number; blur: number; opacity: number;
};

export default function Home() {
  const bubbles = useMemo<Bubble[]>(() => {
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    // a few more circles, blurrier, faster drift, slightly larger wander
    return Array.from({ length: 30 }).map(() => ({
      top: rand(5, 80),                 // vh
      left: rand(5, 90),                // vw
      size: rand(60, 220),              // px
      color: FEATURE_COLORS[Math.floor(Math.random() * FEATURE_COLORS.length)],
      delay: rand(-6, 6),               // s
      dur: rand(6, 12),                 // s (faster)
      dx: rand(-32, 32),                // px
      dy: rand(-24, 24),                // px
      blur: rand(4, 8),                 // px (more diffused)
      opacity: rand(0.28, 0.58),        // softer outlines
    }));
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* floating outline circles */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bottom-[-8vh]">
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
              opacity: b.opacity,
              animation: `drift ${b.dur}s ease-in-out ${b.delay}s infinite`,
              // @ts-ignore CSS var for keyframes
              "--dx": `${b.dx}px`,
              "--dy": `${b.dy}px`,
            }}
          />
        ))}
      </div>

      {/* hero section: 1.5x taller */}
      <section className="relative mx-auto max-w-5xl px-6 py-32 sm:py-44">
        <h1 className={`${sora.className} text-3xl sm:text-4xl tracking-wide font-semibold flex items-center gap-4`}>
          <img src="/tric-logo.png" alt="TRIC-seq logo" className="h-20 w-20 rounded-sm" />
          <span>TRIC-seq</span>
        </h1>
        <p className="mt-4 text-lg text-slate-600 max-w-3xl">
          Explore global RNA–RNA interactions in bacteria:
        </p>

        {/* tools grid */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <ToolCard title="globalMAP" href="/global" desc="RNA-centric global interaction map with clickable partners." />
          <ToolCard title="csMAP" href="/csmap" desc="Condensed multi-RNA comparative profiles." />
          <ToolCard title="pairMAP" href="/pairmap" desc="Inter-RNA heatmaps forl binding sites." />
          <ToolCard title="foldMAP" href="/foldmap" desc="Structural maps for RNA." />
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
