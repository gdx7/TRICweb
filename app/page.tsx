"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";

const STROKES = [
  "#A40194", // ncRNA/sRNA
  "#F12C2C", // sponge
  "#82F778", // tRNA
  "#F78208", // CDS
  "#76AAD7", // 5'UTR
  "#0C0C0C", // 3'UTR
  "#999999", // rRNA
  "#C4C5C5", // hkRNA
];

type Bubble = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  color: string;
};

export default function Home() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const bubblesRef = useRef<Bubble[]>([]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const W = svg.clientWidth || 1200;
    const H = svg.clientHeight || 700;

    // init bubbles
    const N = 36;
    const B: Bubble[] = [];
    for (let i = 0; i < N; i++) {
      B.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 16 + Math.random() * 80,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        color: STROKES[i % STROKES.length],
      });
    }
    bubblesRef.current = B;

    const nodes = B.map((b, i) => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("opacity", "0.6");
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", String(b.x));
      c.setAttribute("cy", String(b.y));
      c.setAttribute("r", String(b.r));
      c.setAttribute("fill", "none");
      c.setAttribute("stroke", b.color);
      c.setAttribute("stroke-width", "2.5");
      c.setAttribute("filter", "url(#soft)");
      g.appendChild(c);
      svg.appendChild(g);
      return c;
    });

    let raf = 0;
    const tick = () => {
      const W = svg.clientWidth || 1200;
      const H = svg.clientHeight || 700;
      B.forEach((b, i) => {
        b.x += b.vx;
        b.y += b.vy;
        if (b.x < -100) b.x = W + 100;
        if (b.x > W + 100) b.x = -100;
        if (b.y < -100) b.y = H + 100;
        if (b.y > H + 100) b.y = -100;
        nodes[i].setAttribute("cx", String(b.x));
        nodes[i].setAttribute("cy", String(b.y));
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <main className="relative min-h-[86vh] overflow-hidden bg-white">
      {/* animated background */}
      <svg ref={svgRef} className="absolute inset-0 w-full h-full" aria-hidden>
        <defs>
          <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>
      </svg>

      {/* content */}
      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-20 pb-16 text-center">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900">
          TRIC-seq Interactome Explorer
        </h1>
        <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
          Explore global RNA–RNA contacts, collapse maps for custom gene sets, and inter-RNA heatmaps.
          Upload your CSV/BED files and click your way through the interactome.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/global"
            className="inline-flex items-center justify-center rounded-xl border px-6 py-3 text-base font-medium shadow-sm hover:shadow transition bg-white/80 backdrop-blur"
          >
            globalMAP
          </Link>
          <Link
            href="/csmap"
            className="inline-flex items-center justify-center rounded-xl border px-6 py-3 text-base font-medium shadow-sm hover:shadow transition bg-white/80 backdrop-blur"
          >
            csMAP
          </Link>
          <Link
            href="/pairmap"
            className="inline-flex items-center justify-center rounded-xl border px-6 py-3 text-base font-medium shadow-sm hover:shadow transition bg-white/80 backdrop-blur"
          >
            pairMAP
          </Link>
        </div>

        <div className="mt-10 text-xs text-gray-500">
          Colors match feature types (magenta: sRNA/ncRNA, orange: CDS, blue: 5′UTR, black: 3′UTR, green: tRNA, grey: rRNA/hkRNA).
        </div>
      </div>
    </main>
  );
}
