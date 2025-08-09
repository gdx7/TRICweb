// src/app/page.tsx  (or app/page.tsx)
"use client";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/90 border-b">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">TRIC-seq Explorer</h1>
          <p className="text-sm text-gray-500">Interactome tools (client-side)</p>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/global" className="group border rounded-2xl p-6 shadow-sm hover:shadow-md transition">
            <h2 className="text-xl font-semibold mb-2">globalMAP →</h2>
            <p className="text-sm text-gray-600">
              Gene-centric global interactome (odds ratio vs. genome coord). Click partners to re-center.
            </p>
            <div className="mt-4 text-blue-600 text-sm group-hover:underline">Open tool</div>
          </Link>

          <Link href="/csmap" className="group border rounded-2xl p-6 shadow-sm hover:shadow-md transition">
            <h2 className="text-xl font-semibold mb-2">csMAP →</h2>
            <p className="text-sm text-gray-600">
              Comma-separated list → collapsed peak map + totals bar chart.
            </p>
            <div className="mt-4 text-blue-600 text-sm group-hover:underline">Open tool</div>
          </Link>

          <Link href="/pairmap" className="group border rounded-2xl p-6 shadow-sm hover:shadow-md transition">
            <h2 className="text-xl font-semibold mb-2">pairMAP →</h2>
            <p className="text-sm text-gray-600">
              One Y-gene vs many X-genes heatmaps from .bed chimeras, strand-aware, fixed scale.
            </p>
            <div className="mt-4 text-blue-600 text-sm group-hover:underline">Open tool</div>
          </Link>
        </div>
      </section>
    </main>
  );
}
