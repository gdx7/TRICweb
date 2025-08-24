import Link from "next/link";

export const metadata = {
  title: "Help | TRIC-seq Explorer",
  description:
    "How TRIC-seq works, how to interpret the dataset, and how to use globalMAP, csMAP, pairMAP, and foldMAP.",
};

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-6xl p-4 lg:p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold mb-1">Help: TRIC-seq Explorer</h1>
        <p className="text-slate-700">
          A quick guide to TRIC-seq and how to explore RNA–RNA interactions,
          structures, and regulons using the tools in this site.
        </p>
      </header>

      {/* Mobile TOC */}
      <nav
        aria-label="On this page"
        className="lg:hidden mb-6 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm"
      >
        <strong>On this page:</strong>{" "}
        <a className="hover:underline" href="#overview">Overview</a> ·{" "}
        <a className="hover:underline" href="#dataset">Dataset</a> ·{" "}
        <a className="hover:underline" href="#globalmap">globalMAP</a> ·{" "}
        <a className="hover:underline" href="#csmap">csMAP</a> ·{" "}
        <a className="hover:underline" href="#pairmap">pairMAP</a> ·{" "}
        <a className="hover:underline" href="#foldmap">foldMAP</a>
      </nav>

      <div className="grid grid-cols-12 gap-6">
        {/* Desktop sticky TOC */}
        <aside className="col-span-3 hidden lg:block">
          <nav
            aria-label="On this page"
            className="sticky top-24 bg-white border border-slate-200 rounded-lg p-3 text-sm"
          >
            <div className="font-semibold mb-2">On this page</div>
            <ul className="space-y-1">
              <li><a className="hover:underline" href="#overview">Overview</a></li>
              <li><a className="hover:underline" href="#dataset">Using this dataset</a></li>
              <li><a className="hover:underline" href="#globalmap">globalMAP</a></li>
              <li><a className="hover:underline" href="#csmap">csMAP</a></li>
              <li><a className="hover:underline" href="#pairmap">pairMAP</a></li>
              <li><a className="hover:underline" href="#foldmap">foldMAP</a></li>
            </ul>
          </nav>
        </aside>

        <article className="col-span-12 lg:col-span-9 space-y-8">
          {/* Overview */}
          <section id="overview" className="space-y-3">
            <h2 className="text-xl font-semibold">Overview: What is TRIC-seq?</h2>
            <p>
              <strong>TRIC-seq (Total RNA Interaction Capture)</strong> is an <em>in situ</em>,
              genetics-free proximity-ligation method that maps native RNA–RNA contacts across
              bacterial transcriptomes. It preserves cellular context, capturing both
              <em> intramolecular</em> (structure) and <em>intermolecular</em> (regulatory/proximity)
              contacts at high resolution.
            </p>
            <p>
              Each chimeric read corresponds to one ligation event between two RNA fragments that were
              close in the cell. Aggregating millions of such events resolves:
            </p>
            <ul className="list-disc pl-6">
              <li><strong>RNA structures</strong> (Hi-C–like self-contact maps).</li>
              <li><strong>Regulatory networks</strong> (sRNA–mRNA pairs, sponges, hubs).</li>
              <li><strong>System-level patterns</strong> (modular interactomes, stress condensates, ribosome engagement).</li>
            </ul>
          </section>

          {/* Dataset */}
          <section id="dataset" className="space-y-3">
            <h2 className="text-xl font-semibold">Using this dataset</h2>
            <p>
              The explorer provides pre-loaded TRIC-seq datasets for multiple bacteria.
              Choose a preset in each tool to load data instantly.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
              <strong>Tip — presets carry across tools:</strong> When you choose a preset (interactions, annotations, or chimeras),
              it’s remembered locally and the other tools auto-load it on first open. You can also build links like
              <code>?pairs=…&amp;anno=…&amp;chim=…&amp;genes=gene1,gene2</code> to jump in with context.
            </div>
          </section>

          {/* globalMAP */}
          <section id="globalmap" className="space-y-3">
            <h2 className="text-xl font-semibold">Tool guide: globalMAP</h2>
            <p>
              <strong>What it shows:</strong> a genome-aware, RNA-centric map of all partners for a
              selected RNA. Points encode partner position,{" "}
              <span><em>O</em><sup><em>f</em></sup></span>,{" "}
              <span><em>i</em><sub>o</sub></span>, and feature type.
            </p>
            <h3 className="font-semibold">How to use</h3>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Select a dataset preset for your species.</li>
              <li>Search for an RNA (e.g., <code>srna1</code> or <code>gene12</code>).</li>
              <li>
                Tune filters: min <span><em>i</em><sub>o</sub></span>, min{" "}
                <span><em>O</em><sup><em>f</em></sup></span>, distance, and feature class.
              </li>
              <li>
                Click a partner to refocus on that RNA.
              </li>
            </ol>

            <div className="mt-3 overflow-auto rounded border border-slate-200">
              <img
                src="/GlobalHelp.png"
                alt="How to use globalMAP"
                className="block max-w-full h-auto"
              />
            </div>
          </section>

          {/* csMAP */}
          <section id="csmap" className="space-y-3">
            <h2 className="text-xl font-semibold">Tool guide: csMAP</h2>
            <p>
              <strong>What it shows:</strong> collapsed (comparative) interaction profiles so you can
              place multiple RNAs side-by-side and compare their partner spectra.
            </p>
            <h3 className="font-semibold">How to use</h3>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Select a species preset.</li>
              <li>Add two or more RNAs (e.g., <code>srna1</code>, <code>gene15</code>, <code>5'gene28</code>).</li>
              <li>Adjust thresholds and filters to reveal core vs. peripheral partners.</li>
            </ol>
          </section>

          {/* pairMAP */}
          <section id="pairmap" className="space-y-3">
            <h2 className="text-xl font-semibold">Tool guide: pairMAP</h2>
            <p>
              <strong>What it shows:</strong> a high-resolution inter-RNA heat map for a chosen pair
              (axes are nucleotide positions, binned).
            </p>
            <h3 className="font-semibold">How to use</h3>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Enter a Primary RNA and one or more Secondary RNAs (e.g., <code>gene10</code> vs <code>gene16</code>).</li>
              <li>Set Flank (±nt) and Bin (nt/bin) for resolution.</li>
            </ol>

            <div className="mt-3 overflow-auto rounded border border-slate-200">
              <img
                src="/PairHelp.png"
                alt="How to use pairMAP"
                className="block max-w-full h-auto"
              />
            </div>
          </section>

          {/* foldMAP */}
          <section id="foldmap" className="space-y-3">
            <h2 className="text-xl font-semibold">Tool guide: foldMAP</h2>
            <p>
              <strong>What it shows:</strong> an intramolecular (self-contact) map capturing an RNA’s
              average tertiary organization in vivo.
            </p>
            <h3 className="font-semibold">How to use</h3>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Select a species and an RNA (e.g., <code>gene1</code>).</li>
              <li>Choose bin size to balance detail vs. noise.</li>
              <li>Inspect domains and boundaries along the diagonal.</li>
            </ol>
          </section>

          <footer className="pt-4 border-t border-slate-200 text-slate-600">
            <p>
              Need more help? Open an issue on{" "}
              <a
                href="https://github.com/gdx7/TRICweb"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                GitHub
              </a>
              .
            </p>
            <p>
              Explore:{" "}
              <Link href="/global" className="text-blue-600 hover:underline">globalMAP</Link> ·{" "}
              <Link href="/csmap" className="text-blue-600 hover:underline">csMAP</Link> ·{" "}
              <Link href="/pairmap" className="text-blue-600 hover:underline">pairMAP</Link> ·{" "}
              <Link href="/foldmap" className="text-blue-600 hover:underline">foldMAP</Link>
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}
