// app/help/page.tsx
"use client";

import Link from "next/link";

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-7xl p-4 space-y-8">
      <h1 className="text-2xl font-semibold">Help &amp; Quick Start</h1>

      <section className="border rounded-2xl p-4 bg-white shadow-sm">
        <h2 className="text-lg font-semibold mb-2">What is this?</h2>
        <p className="text-sm text-slate-600">
          TRIC-seq Interactome Explorer lets you browse RNA–RNA interactions with four tools:
          {" "}
          <Link href="/global" className="text-blue-600 hover:underline">globalMAP</Link>,{" "}
          <Link href="/csmap" className="text-blue-600 hover:underline">csMAP</Link>,{" "}
          <Link href="/pairmap" className="text-blue-600 hover:underline">pairMAP</Link>, and{" "}
          <Link href="/foldmap" className="text-blue-600 hover:underline">foldMAP</Link>.
        </p>
      </section>

      <section className="border rounded-2xl p-4 bg-white shadow-sm">
        <h2 className="text-lg font-semibold mb-2">globalMAP — usage</h2>
        <ol className="list-decimal pl-6 text-sm text-slate-700 space-y-1">
          <li>Pick a focal RNA via the <em>Search</em> box or click any circle on the plot.</li>
          <li>Use sliders to filter by minimum counts, distance, and cap the odds ratio.</li>
          <li>Upload your own <code>.csv</code> files or choose presets from the dropdowns.</li>
          <li>Export the figure as SVG via <em>Export SVG</em>.</li>
        </ol>
        <div className="mt-4 overflow-auto rounded border">
          <img
            src="/GlobalHelp.png"
            alt="globalMAP help"
            className="block max-w-full h-auto"
          />
        </div>
      </section>

      <section className="border rounded-2xl p-4 bg-white shadow-sm">
        <h2 className="text-lg font-semibold mb-2">pairMAP — usage</h2>
        <ol className="list-decimal pl-6 text-sm text-slate-700 space-y-1">
          <li>Enter a primary RNA (Y-axis) and one or more secondary RNAs (X-axis).</li>
          <li>Load annotations and chimera files (BED/CSV) or select presets.</li>
          <li>Adjust flanks, bin size, and <em>Vmax</em> to tune the heat maps.</li>
          <li>Export each multi-panel map as SVG.</li>
        </ol>
        <div className="mt-4 overflow-auto rounded border">
          <img
            src="/PairHelp.png"
            alt="pairMAP help"
            className="block max-w-full h-auto"
          />
        </div>
      </section>

      <section className="border rounded-2xl p-4 bg-white shadow-sm">
        <h2 className="text-lg font-semibold mb-2">File formats</h2>
        <ul className="list-disc pl-6 text-sm text-slate-700 space-y-1">
          <li>
            <strong>Interactions (globalMAP/csMAP):</strong>{" "}
            CSV with headers <code>ref, target, counts, odds_ratio, …</code>
          </li>
          <li>
            <strong>Annotations:</strong>{" "}
            CSV with headers <code>gene_name, start, end, feature_type, strand, chromosome</code>
          </li>
          <li>
            <strong>Chimeras (pairMAP/foldMAP):</strong>{" "}
            BED (chrom, pos1, pos2) or 2-column CSV of coordinates
          </li>
        </ul>
      </section>

      <section className="text-sm text-slate-600">
        Need more? Open an issue on the repo or email via{" "}
        <a href="https://www.drna.nl" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
          dRNA Lab
        </a>.
      </section>
    </div>
  );
}
