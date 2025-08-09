// app/page.tsx
"use client";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/90 border-b">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">TRIC-seq Explorer</h1>
          <p className="text-sm text-gray-500">Interactome tools for E. coli (client-side)</p>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/global" className="group border rounded-2xl p-6 shadow-sm hover:shadow-md transition">
            <h2 className="text-xl font-semibold mb-2">Global Interaction Map →</h2>
            <p className="text-sm text-gray-600">
              Gene-centric global interactome (odds ratio on y; genome coordinate on x). Click partners to re-center.
            </p>
            <div className="mt-4 text-blue-600 text-sm group-hover:underline">Open tool</div>
          </Link>

          <Link href="/csmap" className="group border rounded-2xl p-6 shadow-sm hover:shadow-md transition">
            <h2 className="text-xl font-semibold mb-2">csMAP (collapsed multi-gene) →</h2>
            <p className="text-sm text-gray-600">
              Enter a comma-separated list of RNAs to build a collapsed “local peak” map + totals bar chart.
            </p>
            <div className="mt-4 text-blue-600 text-sm group-hover:underline">Open tool</div>
          </Link>

          <Link href="/pairmap" className="group border rounded-2xl p-6 shadow-sm hover:shadow-md transition">
            <h2 className="text-xl font-semibold mb-2">Inter-RNA Heatmap →</h2>
            <p className="text-sm text-gray-600">
              One Y-gene vs many X-genes. Upload a .bed of chimeras. Fixed color scale, strand aware, 5′→3′ axes.
            </p>
            <div className="mt-4 text-blue-600 text-sm group-hover:underline">Open tool</div>
          </Link>
        </div>
      </section>
    </main>
  );
}
