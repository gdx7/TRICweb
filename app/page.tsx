"use client";

import Link from "next/link";
import React, { useMemo } from "react";

export default function HomePage() {
  // Colors match your feature palette (stroke only, no fill)
  const ringColors = [
    "#F78208", // CDS
    "#76AAD7", // 5'UTR
    "#0C0C0C", // 3'UTR
    "#A40194", // ncRNA/sRNA magenta
    "#82F778", // tRNA
    "#999999", // rRNA (grey)
    "#F12C2C", // sponge
  ];

  // Gentle drifting rings
  const rings = useMemo(() => {
    const RINGS = 18;
    const out: Array<{
      size: number;
      top: string;
      left: string;
      color: string;
      dur1: string;
      dur2: string;
      blur: number;
      opacity: number;
    }> = [];
    for (let i = 0; i < RINGS; i++) {
      const size = Math.floor(70 + Math.random() * 170);
      const top = `${Math.floor(Math.random() * 80)}%`;
      const left = `${Math.floor(Math.random() * 80)}%`;
      const color = ringColors[i % ringColors.length];
      const dur1 = `${8 + Math.random() * 10}s`;
      const dur2 = `${10 + Math.random() * 12}s`;
      const blur = Math.random() < 0.5 ? 2 : 4;
      const opacity = 0.22 + Math.random() * 0.18;
      out.push({ size, top, left, color, dur1, dur2, blur, opacity });
    }
    return out;
  }, []);

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-white text-gray-900">
      {/* Floating rings */}
      <div className="absolute inset-0 pointer-events-none">
        {rings.map((r, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              top: r.top,
              left: r.left,
              width: r.size,
              height: r.size,
              border: `3px solid ${r.color}`,
              filter: `blur(${r.blur}px)`,
              opacity: r.opacity,
              animation: `driftX ${r.dur1} ease-in-out infinite alternate, driftY ${r.dur2} ease-in-out infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* Hero content */}
      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-20 pb-10">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
            TRIC-seq Interactome Explorer
          </h1>
          <p className="mt-3 text-base sm:text-lg text-gray-600">
            Explore global RNA–RNA interaction maps, generate collapsed csMAPs, and
            build pairwise inter-RNA heatmaps—in your browser.
          </p>
        </div>

        {/* Buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <CTA href="/global" label="GlobalMAP" color="#76AAD7" />
          <CTA href="/csmap" label="csMAP" color="#A40194" />
          <CTA href="/pairmap" label="pairMAP" color="#F78208" />
        </div>

        {/* Quick tips */}
        <div className="mt-10 grid sm:grid-cols-3 gap-4 text-sm text-gray-600">
          <Tip>
            <b>GlobalMAP:</b> search an RNA, click partners to re-center, export SVG.
          </Tip>
          <Tip>
            <b>csMAP:</b> paste a comma/space gene list and upload your CSVs to
            compare peaks across RNAs.
          </Tip>
          <Tip>
            <b>pairMAP:</b> enter a pair and upload your .bed chimeras to see a
            2D heatmap.
          </Tip>
        </div>
      </div>

      {/* Footer with lab logo */}
      <footer className="relative z-10 mx-auto max-w-5xl px-6 pb-10">
        <div className="mt-12 pt-6 border-t flex items-center justify-center gap-3">
          <a
            href="https://www.drna.nl"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-3"
          >
            {/* Put your logo file at /public/drna-logo.png */}
            <img
              src="/drna-logo.png"
              alt="dRNA Lab"
              width={44}
              height={44}
              className="opacity-80 group-hover:opacity-100 transition-opacity"
            />
            <span className="text-xs text-gray-600">
              a <span className="font-medium text-gray-800">dRNA Lab</span> production
            </span>
          </a>
        </div>
      </footer>

      {/* Page styles (animations) */}
      <style jsx global>{`
        @keyframes driftX {
          0% { transform: translateX(0px); }
          100% { transform: translateX(30px); }
        }
        @keyframes driftY {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-24px); }
        }
      `}</style>
    </main>
  );
}

function CTA({ href, label, color }: { href: string; label: string; color: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-full px-7 py-3 text-base font-medium bg-white/70 hover:bg-white
                 ring-2 transition focus:outline-none focus-visible:ring-4"
      style={{
        color: "#111827",
        borderColor: color,
        boxShadow: `0 0 0 2px ${color} inset`,
      }}
    >
      {label}
    </Link>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white/70 p-3">
      {children}
    </div>
  );
}
