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
      <nav aria-label="On this page" className="lg:hidden mb-6 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
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
          <nav aria-label="On this page" className="sticky top-24 bg-white border border-slate-200 rounded-lg p-3 text-sm">
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
              The explorer provides pre-loaded TRIC-seq datasets for multiple bacteria
              (e.g., <em>E. coli</em>, <em>Staphylococcus aureus</em>,{" "}
              <em>Stutzerimonas stutzeri</em>, <em>Myxococcus xanthus</em>). Choose a preset in each tool to load data instantly.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold">Key fields</h3>
                <ul className="list-disc pl-6">
                  <li><strong>Interaction count</strong> (<span><em>i</em><sub>o</sub></span>)</li>
                  <li><strong>Odds ratio</strong> (<span><em>O</em><sup><em>f</em></sup></span>)</li>
                  <li><strong>Adjusted P/FDR</strong></li>
                  <li><strong>Feature types</strong></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold">Quick start</h3>
                <ol className="list-decimal pl-6 space-y-1">
                  <li>Open <Link href="/global" className="text-blue-600 hover:underline">globalMAP</Link> and select a species preset.</li>
                  <li>Search or highlight an RNA; adjust filters (min <span><em>i</em><sub>o</sub></span>, min <span><em>O</em><sup><em>f</em></sup></span>).</li>
                  <li>Click any partner point/row to refocus the map on that partner.</li>
                  <li><strong>Multi-select partners</strong> in the table and open them directly in <Link href="/pairmap" className="text-blue-600 hover:underline">pairMAP</Link> or compare in <Link href="/csmap" className="text-blue-600 hover:underline">csMAP</Link>.</li>
                </ol>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-slate-800">
              <strong>Recommended starting thresholds (E. coli trans):</strong>{" "}
              <span><em>O</em><sup><em>f</em></sup></span> ≥ 10 and{" "}
              <span><em>i</em><sub>o</sub></span> ≥ 5.
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <strong>Circle size scale:</strong> in globalMAP and csMAP you can switch to
              area ∝ √(<code>counts + c</code>) via the “offset c” slider. This is helpful to
              standardize visual scales across figures (set <code>c=0</code> to use raw counts).
            </div>
          </section>

          {/* tool guides (unchanged content with slight phrasing) */}
          <section id="globalmap" className="space-y-3">
            <h2 className="text-xl font-semibold">Tool guide: globalMAP</h2>
            <p><strong>What it shows:</strong> genome-aware, RNA-centric map of all partners for the selected RNA.</p>
            <h3 className="font-semibold">How to use</h3>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Select a dataset preset for your species or upload CSVs.</li>
              <li>Search for an RNA; tune filters and circle size.</li>
              <li>Use <strong>multi-select</strong> to open selected partners in pairMAP or csMAP.</li>
            </ol>
            <div className="mt-3 overflow-auto rounded border border-slate-200">
              <img src="/GlobalHelp.png" alt="How to use globalMAP" className="block max-w-full h-auto" />
            </div>
          </section>

          <section id="csmap" className="space-y-3">
            <h2 className="text-xl font-semibold">Tool guide: csMAP</h2>
            <p><strong>What it shows:</strong> collapsed (comparative) interaction profiles side-by-side.</p>
            <h3 className="font-semibold">How to use</h3>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Load a preset or your CSVs; add two or more RNAs.</li>
              <li>Adjust circle size (×) and offset c for consistent area scaling.</li>
              <li>Use differences in partner classes to form hypotheses, then open pairs in pairMAP.</li>
            </ol>
          </section>

          <section id="pairmap" className="space-y-3">
            <h2 className="text-xl font-semibold">Tool guide: pairMAP</h2>
            <p><strong>What it shows:</strong> inter-RNA heat maps (nucleotide-binned) for chosen RNA pairs.</p>
            <h3 className="font-semibold">How to use</h3>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Enter a Primary RNA and one or more Secondary RNAs (or follow a link from globalMAP).</li>
              <li>Set Flank and Bin to control window and resolution.</li>
              <li>Use the <em>foldMAP →</em> link on each panel to inspect that RNA’s self-contacts.</li>
            </ol>
            <div className="mt-3 overflow-auto rounded border border-slate-200">
              <img src="/PairHelp.png" alt="How to use pairMAP" className="block max-w-full h-auto" />
            </div>
          </section>

          <section id="foldmap" className="space-y-3">
            <h2 className="text-xl font-semibold">Tool guide: foldMAP</h2>
            <p><strong>What it shows:</strong> intramolecular maps (self-contacts) and long-range profiles.</p>
            <h3 className="font-semibold">How to use</h3>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Load annotations + chimeras, or use <em>Load Demo</em> to explore the UI instantly.</li>
              <li>Choose bin size and normalization (Raw/ICE); export figures and peak CSVs.</li>
            </ol>
          </section>

          <footer className="pt-4 border-t border-slate-200 text-slate-600">
            <p>
              Need more help? Open an issue on{" "}
              <a href="https://github.com/gdx7/TRICweb" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                GitHub
              </a>.
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
