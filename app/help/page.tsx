// app/help/page.tsx
import Link from "next/link";

export const metadata = {
  title: "TRIC-seq explorer guide",
  description:
    "How TRIC-seq works, how to interpret the dataset, and how to use globalMAP, csMAP, pairMAP, and foldMAP.",
};

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-6xl p-4 lg:p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">TRIC-seq explorer guide</h1>

        <p className="text-red-600 font-semibold mb-2">
          Important: after selecting a preset file, please wait briefly while the tool
          loads the interaction and chimera files. Once loaded you can interact with
          these datasets without delay.
        </p>

        <p className="text-slate-700">
          A quick guide to TRIC-seq and how to explore RNA–RNA interactions,
          structures, and regulons using the tools in this site. For method details,
          see the preprint&nbsp;
          <a
            href="https://doi.org/10.1101/2025.09.11.675593"
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline"
          >
            doi:10.1101/2025.09.11.675593
          </a>.
        </p>
      </header>

      {/* Mobile TOC */}
      <nav
        aria-label="On this page"
        className="lg:hidden mb-8 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-x-1"
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
            className="sticky top-24 bg-white border border-slate-200 rounded-lg p-4 text-sm"
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

        <article className="col-span-12 lg:col-span-9 space-y-12">
          {/* Overview */}
          <section id="overview" className="space-y-4">
            <h2 className="text-2xl font-semibold">Overview: What is TRIC-seq?</h2>
            <p>
              <strong>TRIC-seq (Total RNA Interactome Capture)</strong> is an <em>in situ</em>,
              genetics‑free proximity‑ligation method that maps native RNA–RNA contacts across
              bacterial transcriptomes. It preserves cellular context and resolves both
              <em> intramolecular</em> (structure) and <em>intermolecular</em> (regulatory/proximity)
              contacts at high resolution and specificity.
            </p>
            <p>
              Each chimeric read corresponds to one ligation event between two RNA fragments that were
              nearby in the cell. Aggregating millions of such events resolves:
            </p>
            <ul className="list-disc pl-6">
              <li><strong>RNA structures</strong> (Hi‑C–like self‑contact maps).</li>
              <li><strong>Regulatory networks</strong> (sRNA–mRNA pairs, sponges, hubs).</li>
              <li><strong>System‑level patterns</strong> (modular interactomes and condensate‑like organization).</li>
            </ul>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <strong>Reference:</strong>{" "}
              <a
                href="https://doi.org/10.1101/2025.09.11.675593"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                Comprehensive architecture of the bacterial RNA interactome (preprint)
              </a>
              .
            </div>
          </section>

          {/* Dataset */}
          <section id="dataset" className="space-y-4">
            <h2 className="text-2xl font-semibold">Using this dataset</h2>
            <p>
              The explorer provides pre‑loaded TRIC‑seq datasets for multiple bacteria
              (e.g., <em>E. coli</em>, <em>Staphylococcus aureus</em>,{" "}
              <em>Stutzerimonas stutzeri</em>, <em>Myxococcus xanthus</em>). Choose a preset in each
              tool to load data instantly.
            </p>

            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Key fields</h3>
                <ul className="list-disc pl-6">
                  <li>
                    <strong>Interaction count</strong>{" "}
                    (<span><em>i</em><sub>o</sub></span>): unique chimeric reads supporting a pair.
                  </li>
                  <li>
                    <strong>Odds ratio</strong>{" "}
                    (<span><em>O</em><sup>f</sup></span>): enrichment relative to a null; higher means more
                    specific pairing.
                  </li>
                  <li>
                    <strong>Adjusted P/FDR</strong>: multiple‑testing–corrected significance (especially for
                    long‑range contacts).
                  </li>
                  <li>
                    <strong>Feature types</strong>: 5′UTR, CDS, 3′UTR, sRNA, tRNA, housekeeping RNA (hkRNA), sponge.
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Quick start</h3>
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
                    <span><em>i</em><sub>o</sub></span> and{" "}
                    <span><em>O</em><sup>f</sup></span>).
                  </li>
                  <li>
                    Click any partner point/row to recenter globalMAP on that RNA.
                  </li>
                  <li>
                    For interface‑level detail, open{" "}
                    <Link href="/pairmap" className="text-blue-600 hover:underline">
                      pairMAP
                    </Link>{" "}
                    with the two RNAs.
                  </li>
                </ol>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-slate-800">
              <strong>Recommended starting thresholds (E. coli, trans):</strong>{" "}
              <span><em>O</em><sup>f</sup></span> ≥ 10 and{" "}
              <span><em>i</em><sub>o</sub></span> ≥ 5. Loosen to explore; tighten for high‑confidence sets.
              For highly connected RNAs (e.g., rRNAs), prioritize{" "}
              <span><em>O</em><sup>f</sup></span>/FDR over raw counts.
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
              <strong>From the preprint—practical reading tips:</strong>
              <ul className="list-disc pl-6">
                <li>
                  TRIC‑seq simultaneously captures <em>intramolecular</em> structure signals and
                  <em> intermolecular</em> regulatory contacts; interpret diagonal‑proximal self‑contacts
                  as structure and distal cross‑locus contacts as pairing/regulatory proximity.
                </li>
                <li>
                  Contact specificity is better reflected by{" "}
                  <span><em>O</em><sup>f</sup></span> (and FDR) than by counts alone—use both when ranking candidates.
                </li>
                <li>
                  Use long‑range (kb‑scale) enrichment to flag distal regulation, then validate in{" "}
                  <Link href="/pairmap" className="text-blue-600 hover:underline">pairMAP</Link>.
                </li>
              </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <strong>Cite this resource:</strong> please cite the TRIC‑seq preprint{" "}
              <a
                href="https://doi.org/10.1101/2025.09.11.675593"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                doi:10.1101/2025.09.11.675593
              </a>{" "}
              and GEO accession <code>GSE305265</code> when using this explorer.
            </div>
          </section>

          {/* globalMAP */}
          <section id="globalmap" className="space-y-4">
            <h2 className="text-2xl font-semibold">Tool guide: globalMAP</h2>
            <p>
              <strong>What it shows:</strong> a genome‑aware, RNA‑centric map of all partners for a
              selected RNA. Points encode partner position,{" "}
              <span><em>O</em><sup>f</sup></span>,{" "}
              <span><em>i</em><sub>o</sub></span>, and feature type. The table includes quick links (↗) to
              external gene databases based on your selected annotation preset.
            </p>

            <h3 className="text-lg font-semibold mt-2">How to use</h3>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Select a dataset preset for your species.</li>
              <li>Search for an RNA (e.g., sRNA <code>RyhB</code> or CDS <code>uvrA</code>).</li>
              <li>
                Tune filters: min <span><em>i</em><sub>o</sub></span>, min{" "}
                <span><em>O</em><sup>f</sup></span>, and feature class.
              </li>
              <li>
                Click a partner to open <strong>globalMAP</strong> centered on that partner (rapid
                “drill‑around” exploration).
              </li>
            </ol>

            <p className="bg-slate-50 border border-slate-200 rounded-md p-3">
              <strong>Tip:</strong> Sorting by{" "}
              <span><em>O</em><sup>f</sup></span> surfaces the most specific targets first. Use the
              highlight box to track a short list of hypotheses while you refocus on different RNAs.
            </p>

            <div className="mt-3 overflow-auto rounded border border-slate-200">
              <img
                src="/GlobalHelp.png"
                alt="How to use globalMAP"
                className="block max-w-full h-auto"
              />
            </div>
          </section>

          {/* csMAP */}
          <section id="csmap" className="space-y-4">
            <h2 className="text-2xl font-semibold">Tool guide: csMAP</h2>
            <p>
              <strong>What it shows:</strong> collapsed (comparative) interaction profiles so you can
              place multiple RNAs side‑by‑side and compare partner spectra.
            </p>

            <h3 className="text-lg font-semibold mt-2">How to use</h3>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Select a species preset.</li>
              <li>Add two or more RNAs to compare (e.g., hub sRNAs or candidate sponges).</li>
              <li>
                Use differences in partner classes (5′UTR vs. CDS) to infer logic; copy candidate pairs to{" "}
                <Link href="/pairmap" className="text-blue-600 hover:underline">
                  pairMAP
                </Link>{" "}
                for interface‑level inspection.
              </li>
            </ol>
          </section>

          {/* pairMAP */}
          <section id="pairmap" className="space-y-4">
            <h2 className="text-2xl font-semibold">Tool guide: pairMAP</h2>
            <p>
              <strong>What it shows:</strong> a high‑resolution inter‑RNA heat map for a chosen pair
              (axes are nucleotide positions, binned).
            </p>

            <h3 className="text-lg font-semibold mt-2">How to use</h3>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Enter a Primary RNA and one or more Secondary RNAs.</li>
              <li>Set Flank (±nt around each RNA) and Bin (nt/bin) for resolution.</li>
              <li>
                Interpret:
                <ul className="list-disc pl-6 mt-1">
                  <li>Focused hotspot near diagonal → base‑pairing interface (typical sRNA–5′UTR).</li>
                  <li>Diffuse CDS‑wide signal → co‑association/aggregation (e.g., mRNA–mRNA).</li>
                  <li>
                    5′UTR hotspot + 3′UTR signal can reflect tertiary folding bringing ends together
                    (not necessarily a second binding site).
                  </li>
                </ul>
              </li>
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
          <section id="foldmap" className="space-y-4">
            <h2 className="text-2xl font-semibold">Tool guide: foldMAP</h2>
            <p>
              <strong>What it shows:</strong> an intramolecular (self‑contact) map capturing an RNA’s
              average tertiary organization in vivo.
            </p>

            <h3 className="text-lg font-semibold mt-2">How to use</h3>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Select a species and an RNA.</li>
              <li>Choose bin size to balance detail vs. sparsity.</li>
              <li>
                Look for domains (blocks along the diagonal), insulated boundaries, and interaction
                islands/deserts.
              </li>
            </ol>

            <p className="bg-slate-50 border border-slate-200 rounded-md p-3">
              <strong>Note:</strong> foldMAP summarizes a population‑average contact map; multiple
              conformations can overlay into the observed pattern. Use the export buttons to save the
              contact map and long‑range profile (SVG/CSV).
            </p>
          </section>

          <footer className="pt-6 border-t border-slate-200 text-slate-600">
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
          </footer>
        </article>
      </div>
    </div>
  );
}
