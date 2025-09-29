import Link from "next/link";

export const metadata = {
  title: "TRIC-seq explorer guide",
  description:
    "How TRIC-seq works, how to interpret the dataset, and how to use globalMAP, csMAP, pairMAP, and foldMAP.",
};

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-6xl p-4 lg:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold mb-3">TRIC-seq explorer guide</h1>

        <p className="text-red-600 font-semibold mb-3">
          Important: after selecting a preset file, please wait briefly while the tool loads
          the interaction and chimera files. Once loaded you can interact with these datasets without delay.
        </p>

        <p className="text-slate-700 mb-3">
          A quick guide to TRIC-seq and how to explore RNA–RNA interactions,
          structures, and regulons using the tools in this site.
        </p>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="font-medium mb-1">Preprint</div>
          <p className="text-sm">
            Comprehensive architecture of the bacterial RNA interactome — TRIC-seq.
            DOI:&nbsp;
            <a
              href="https://doi.org/10.1101/2025.09.11.675593"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline"
            >
              10.1101/2025.09.11.675593
            </a>
          </p>
        </div>
      </header>

      {/* Mobile TOC */}
      <nav
        aria-label="On this page"
        className="lg:hidden mb-8 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm"
      >
        <strong>On this page:</strong>{" "}
        <a className="hover:underline" href="#overview">Overview</a> ·{" "}
        <a className="hover:underline" href="#dataset">Dataset</a> ·{" "}
        <a className="hover:underline" href="#globalmap">globalMAP</a> ·{" "}
        <a className="hover:underline" href="#csmap">csMAP</a> ·{" "}
        <a className="hover:underline" href="#pairmap">pairMAP</a> ·{" "}
        <a className="hover:underline" href="#foldmap">foldMAP</a>
      </nav>

      <div className="grid grid-cols-12 gap-8">
        {/* Desktop sticky TOC */}
        <aside className="col-span-3 hidden lg:block">
          <nav
            aria-label="On this page"
            className="sticky top-24 bg-white border border-slate-200 rounded-lg p-3 text-sm"
          >
            <div className="font-semibold mb-2">On this page</div>
            <ul className="space-y-2">
              <li><a className="hover:underline" href="#overview">Overview</a></li>
              <li><a className="hover:underline" href="#dataset">Using this dataset</a></li>
              <li><a className="hover:underline" href="#globalmap">globalMAP</a></li>
              <li><a className="hover:underline" href="#csmap">csMAP</a></li>
              <li><a className="hover:underline" href="#pairmap">pairMAP</a></li>
              <li><a className="hover:underline" href="#foldmap">foldMAP</a></li>
            </ul>
          </nav>
        </aside>

        <article className="col-span-12 lg:col-span-9 space-y-10">
          {/* Overview */}
          <section id="overview" className="space-y-4">
            <h2 className="text-xl font-semibold">Overview: What is TRIC-seq?</h2>
            <p>
              <strong>TRIC-seq (Total RNA Interactome Capture)</strong> is an <em>in situ</em>,
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
              <li><strong>System-level patterns</strong> (modular interactomes, ribosome engagement, stress-induced remodeling).</li>
            </ul>

            <div className="bg-sky-50 border border-sky-200 rounded-lg p-3">
              <div className="font-medium mb-1">Practical tips (from the preprint, paraphrased)</div>
              <ul className="list-disc pl-6 text-sm space-y-1">
                <li>
                  Rank partners primarily by enrichment (<em>O</em><sup><em>f</em></sup>) and FDR; raw counts
                  (<em>i</em><sub>o</sub>) can be high for very abundant RNAs without being specific.
                </li>
                <li>
                  For highly connected RNAs (e.g., rRNA/hkRNA), specificity metrics and distance context
                  help separate broad co-association from targeted interactions.
                </li>
                <li>
                  In self-contact maps, blocks along the diagonal indicate domains; sharp boundaries suggest
                  insulated regions and folding constraints that can localize interaction hotspots.
                </li>
                <li>
                  Long-range profiles (≥5 kb) are useful to spot single-stranded maxima that often coincide
                  with productive interfaces.
                </li>
              </ul>
            </div>
          </section>

          {/* Dataset */}
          <section id="dataset" className="space-y-4">
            <h2 className="text-xl font-semibold">Using this dataset</h2>
            <p>
              The explorer provides pre-loaded TRIC-seq datasets for multiple bacteria
              (e.g., <em>E. coli</em>, <em>Staphylococcus aureus</em>,{" "}
              <em>Stutzerimonas stutzeri</em>, <em>Myxococcus xanthus</em>). Choose a preset in each tool to load data instantly.
            </p>

            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <h3 className="font-semibold">Key fields</h3>
                <ul className="list-disc pl-6">
                  <li>
                    <strong>Interaction count</strong>{" "}
                    (<span><em>i</em><sub>o</sub></span>): unique chimeric reads supporting a pair.
                  </li>
                  <li>
                    <strong>Odds ratio</strong>{" "}
                    (<span><em>O</em><sup>f</sup></span>): enrichment vs. a degree-preserving configuration-model null
                    (higher → more specific).
                  </li>
                  <li>
                    <strong>Adjusted P/FDR</strong>: multiple-testing–corrected significance (esp. long-range).
                  </li>
                  <li>
                    <strong>Feature types</strong>: 5′UTR, CDS, 3′UTR, sRNA, tRNA, housekeeping RNA (hkRNA), sponge.
                  </li>
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Quick start</h3>
                <ol className="list-decimal pl-6 space-y-1">
                  <li>
                    Open{" "}
                    <Link href="/global" className="text-blue-600 hover:underline">
                      globalMAP
                    </Link>{" "}
                    and select a species preset.
                  </li>
                  <li>
                    Search or highlight an RNA; adjust filters (min{" "}
                    <span><em>i</em><sub>o</sub></span>, min{" "}
                    <span><em>O</em><sup>f</sup></span>, distance).
                  </li>
                  <li>
                    Click any partner point/row to open <strong>globalMAP</strong> centered on that partner.
                  </li>
                  <li>
                    To examine a specific pair in detail, open{" "}
                    <Link href="/pairmap" className="text-blue-
