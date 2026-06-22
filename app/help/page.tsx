// app/help/page.tsx
import Link from "next/link";

export const metadata = {
  title: "TRIC-seq explorer guide",
  description:
    "How TRIC-seq works, how to read the dataset, and how to use the unified Explorer — Interactome, Pair, Structure and Compare lenses — plus the legacy globalMAP, csMAP, pairMAP and foldMAP tools.",
};

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-6xl p-4 lg:p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">TRIC-seq explorer guide</h1>

        <p className="text-red-600 font-semibold mb-2">
          Important: after selecting a species dataset, please wait briefly while the tool
          loads the interaction and chimera-contact files. The Pair and Structure lenses
          need the raw contacts, which stream in the first time you open them. Once loaded,
          everything is instant. The simulated demo loads immediately.
        </p>

        <p className="text-slate-700 dark:text-slate-300">
          A quick guide to TRIC-seq and how to explore RNA–RNA interactions,
          structures, and regulons. The{" "}
          <Link href="/explore" className="text-blue-600 hover:underline font-medium">
            Explorer
          </Link>{" "}
          is the recommended way in: one focal RNA, viewed through four lenses. For method
          details, see the preprint&nbsp;
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
        className="lg:hidden mb-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm space-x-1"
      >
        <strong>On this page:</strong>{" "}
        <a className="hover:underline" href="#overview">Overview</a> ·{" "}
        <a className="hover:underline" href="#dataset">Dataset</a> ·{" "}
        <a className="hover:underline" href="#explorer">Explorer</a> ·{" "}
        <a className="hover:underline" href="#interactome">Interactome</a> ·{" "}
        <a className="hover:underline" href="#pair">Pair</a> ·{" "}
        <a className="hover:underline" href="#structure">Structure</a> ·{" "}
        <a className="hover:underline" href="#compare">Compare</a> ·{" "}
        <a className="hover:underline" href="#partners">Partners</a> ·{" "}
        <a className="hover:underline" href="#legacy">Legacy tools</a>
      </nav>

      <div className="grid grid-cols-12 gap-8">
        {/* Desktop sticky TOC */}
        <aside className="col-span-3 hidden lg:block">
          <nav
            aria-label="On this page"
            className="sticky top-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-sm"
          >
            <div className="font-semibold mb-2">On this page</div>
            <ul className="space-y-2">
              <li><a className="hover:underline" href="#overview">Overview</a></li>
              <li><a className="hover:underline" href="#dataset">Using this dataset</a></li>
              <li>
                <a className="hover:underline font-medium" href="#explorer">The Explorer</a>
                <ul className="mt-1 ml-3 space-y-1 border-l border-slate-200 dark:border-slate-700 pl-3 text-slate-500 dark:text-slate-400">
                  <li><a className="hover:underline" href="#interactome">Interactome lens</a></li>
                  <li><a className="hover:underline" href="#pair">Pair lens</a></li>
                  <li><a className="hover:underline" href="#structure">Structure lens</a></li>
                  <li><a className="hover:underline" href="#compare">Compare lens</a></li>
                  <li><a className="hover:underline" href="#partners">Partners &amp; export</a></li>
                  <li><a className="hover:underline" href="#byod">Your own data</a></li>
                </ul>
              </li>
              <li><a className="hover:underline" href="#legacy">Legacy tools</a></li>
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
            <ul className="list-disc pl-6 mb-4">
              <li><strong>RNA structures</strong> (Hi‑C–like self‑contact maps, identifying functional domains, insulators, and structural hot-spots).</li>
              <li><strong>Regulatory networks</strong> (identifying highly connected sRNA–mRNA pairs, regulatory sponges, and trans-acting hubs).</li>
              <li><strong>System‑level patterns</strong> (uncovering modular interactomes, extensive mRNA-mRNA contacts, and condensate‑like organization, driven largely by non-ribosomal transcripts).</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-2">Biological Insights</h3>
            <p className="mb-4">
              By circumventing biases associated with probe-based or UV-crosslinking strategies, TRIC-seq provides an unbiased look into the spatial orchestration of the transcriptome. Key findings unlocked by TRIC-seq include:
            </p>
            <ul className="list-disc pl-6">
              <li><strong>Pervasive mRNA-mRNA architecture:</strong> Transcripts don&apos;t act alone; they frequently overlap geographically, participating in interconnected communities and operon-spanning regulatory cross-talk.</li>
              <li><strong>Target discovery:</strong> Novel trans-acting RNA-RNA interactions can be discovered systematically by mapping robustly enriched intermolecular loops (significant Odd Ratios).</li>
              <li><strong>Tertiary folds in vivo:</strong> Long-range intramolecular contacts pinpoint 5′UTR/3′UTR interactions that gate functional expression.</li>
            </ul>

            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
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
              The Explorer ships with pre‑loaded TRIC‑seq datasets for multiple bacteria —{" "}
              <em>Escherichia coli</em> (K‑12 MG1655, the reference interactome),{" "}
              <em>Staphylococcus aureus</em>, <em>Stutzerimonas stutzeri</em> and{" "}
              <em>Myxococcus xanthus</em> — plus a self‑consistent <strong>simulated demo</strong> you
              can click through instantly. Pick any of them from the dataset menu (top‑right).
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
                    Open the{" "}
                    <Link href="/explore" className="text-blue-600 hover:underline">
                      Explorer
                    </Link>{" "}
                    and choose a species (or the demo) from the dataset menu.
                  </li>
                  <li>
                    Search any RNA in the top bar (<kbd className="rounded border border-slate-300 bg-slate-100 px-1 text-xs">⌘K</kbd>),
                    e.g. sRNA <code>RyhB</code> or CDS <code>uvrA</code>. It becomes the <em>focal</em> RNA.
                  </li>
                  <li>
                    Read its partners in the right‑hand panel; tune filters (min{" "}
                    <span><em>i</em><sub>o</sub></span> and <span><em>O</em><sup>f</sup></span>).
                  </li>
                  <li>
                    Click any partner to <strong>refocus</strong> on it; double‑click to open its{" "}
                    <strong>Pair</strong> contact map.
                  </li>
                </ol>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-slate-800 dark:text-slate-200">
              <strong>Recommended starting thresholds (E. coli, trans):</strong>{" "}
              <span><em>O</em><sup>f</sup></span> ≥ 10 and{" "}
              <span><em>i</em><sub>o</sub></span> ≥ 5. Loosen to explore; tighten for high‑confidence sets.
              For highly connected RNAs (e.g., rRNAs), prioritize{" "}
              <span><em>O</em><sup>f</sup></span>/FDR over raw counts.
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-1">
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
                  Use long‑range (kb‑scale) enrichment to flag distal regulation, then validate in the{" "}
                  <a className="text-blue-600 hover:underline" href="#pair">Pair lens</a>.
                </li>
              </ul>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
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

          {/* ===================== EXPLORER ===================== */}
          <section id="explorer" className="space-y-4 scroll-mt-24">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
              Recommended
            </span>
            <h2 className="text-2xl font-semibold">The Explorer — one RNA, every lens</h2>
            <p>
              The{" "}
              <Link href="/explore" className="text-blue-600 hover:underline font-medium">
                Explorer
              </Link>{" "}
              unifies all four legacy tools into a single workspace. You pick <strong>one focal RNA</strong>{" "}
              and view it through four <em>lenses</em> that all read from the same dataset and the same
              filters. Change the focal RNA and every lens updates at once — so you can move from a
              genome‑wide overview to a base‑pair‑level interface without losing your place.
            </p>

            <div className="grid sm:grid-cols-2 gap-3">
              <LensCard title="Interactome" sub="≈ globalMAP" desc="Every partner of the focal RNA, on a circular genome or a linear scatter." href="#interactome" />
              <LensCard title="Pair" sub="≈ pairMAP" desc="A base‑pairing contact map between the focal RNA and one chosen partner, with built‑in duplex prediction." href="#pair" />
              <LensCard title="Structure" sub="≈ foldMAP" desc="The focal RNA's intramolecular self‑contact map and its long‑range contact profile." href="#structure" />
              <LensCard title="Compare" sub="≈ csMAP" desc="The focal RNA's target spectrum lined up against pinned RNAs." href="#compare" />
            </div>

            <h3 className="text-xl font-semibold mt-6">Anatomy of the workspace</h3>
            <p>
              Five regions you&apos;ll use constantly. Numbers below match the figure.
            </p>
            <figure className="my-3">
              <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white">
                <img src="/explore-workspace.svg" alt="Annotated map of the Explorer workspace" className="block w-full h-auto" />
              </div>
              <figcaption className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                The Explorer workspace: ① focal‑RNA search, ② shared filters &amp; dataset menu, ③ lens
                tabs, ④ the active lens, ⑤ the partners panel.
              </figcaption>
            </figure>
            <ol className="list-decimal pl-6 space-y-1.5">
              <li>
                <strong>Focal‑RNA search</strong> — type any gene/RNA name (or press{" "}
                <kbd className="rounded border border-slate-300 bg-slate-100 px-1 text-xs">⌘K</kbd> /{" "}
                <kbd className="rounded border border-slate-300 bg-slate-100 px-1 text-xs">Ctrl K</kbd>),
                arrow‑keys to choose, Enter to set the <em>focal</em> RNA.
              </li>
              <li>
                <strong>Filters &amp; dataset</strong> — the sliders icon opens shared filters (below);
                the dataset button switches species, loads the demo, or uploads your own data.
              </li>
              <li>
                <strong>Lens tabs</strong> — switch between Interactome / Pair / Structure / Compare.
                The Compare tab shows a badge with the number of RNAs you&apos;ve pinned.
              </li>
              <li>
                <strong>Active lens</strong> — the main canvas. Every plot has an{" "}
                <strong>Export PNG</strong> button.
              </li>
              <li>
                <strong>Partners panel</strong> — a live, sortable list of the focal RNA&apos;s partners
                with pin / pair / database‑link actions, CSV export and an AI‑hypothesis helper.
              </li>
            </ol>

            <h3 className="text-xl font-semibold mt-6">Shared filters</h3>
            <p>
              One set of filters applies to every lens, so a threshold you set in the Interactome also
              shapes the partner list and the Compare spectra.
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 text-left">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Control</th>
                    <th className="px-3 py-2 font-semibold">Default</th>
                    <th className="px-3 py-2 font-semibold">What it does</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr>
                    <td className="px-3 py-2 whitespace-nowrap">Min reads (<em>i</em><sub>o</sub>)</td>
                    <td className="px-3 py-2">5</td>
                    <td className="px-3 py-2">Hide partners supported by fewer unique chimeric reads.</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 whitespace-nowrap">Odds‑ratio cap (<em>O</em><sup>f</sup>)</td>
                    <td className="px-3 py-2">5000</td>
                    <td className="px-3 py-2">Clamp the plotted odds ratio so a few huge values don&apos;t flatten the scale (data is not removed).</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 whitespace-nowrap">Label threshold</td>
                    <td className="px-3 py-2">50</td>
                    <td className="px-3 py-2">Only partners with <em>O</em><sup>f</sup> above this get a text label in the maps.</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 whitespace-nowrap">Circle size</td>
                    <td className="px-3 py-2">×1</td>
                    <td className="px-3 py-2">Scale every dot up or down for crowded or sparse RNAs.</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 whitespace-nowrap">Exclude feature types</td>
                    <td className="px-3 py-2">tRNA off</td>
                    <td className="px-3 py-2">Toggle whole classes (5′UTR, CDS, 3′UTR, sRNA/ncRNA, rRNA/hkRNA, sponge, tRNA) in or out.</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 whitespace-nowrap">Highlight genes</td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2">Type names (comma/space‑separated) to make those partners glow yellow across the maps.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-3 text-sm">
              <strong>The golden rule:</strong> <em>click a partner to refocus</em> the whole Explorer on
              it; <em>double‑click to open its Pair map</em>. This works in the Interactome map and in the
              partners list, and is the fastest way to walk an interaction network hop by hop.
            </div>
          </section>

          {/* Interactome */}
          <section id="interactome" className="space-y-4 scroll-mt-24">
            <h3 className="text-xl font-semibold">
              Interactome lens <span className="text-base font-normal text-slate-400">≈ globalMAP</span>
            </h3>
            <p>
              <strong>What it shows:</strong> a genome‑aware, RNA‑centric map of <em>all</em> partners of
              the focal RNA. The focal RNA sits at the centre; each partner is drawn at its real genomic
              position. <strong>Dot area ∝ reads</strong> (<em>i</em><sub>o</sub>), <strong>dot outline =
              feature type</strong>, and the connecting arc&apos;s colour encodes the{" "}
              <strong>odds ratio</strong> (<em>O</em><sup>f</sup>).
            </p>

            <figure className="my-3">
              <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-2">
                <img src="/explore-interactome.svg" alt="Interactome lens — circular genome view of the sRNA GcvB and its partners in E. coli" className="mx-auto block max-w-full h-auto" />
              </div>
              <figcaption className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Interactome (Genome view) of the sRNA <em>GcvB</em> in <em>E. coli</em>. Chords fan out
                from the focal RNA to each partner; arc colour = odds ratio, arc width = read depth, dot
                area = reads, dot outline = feature class. GcvB&apos;s top partners are the 5′UTRs of its
                amino‑acid–transport regulon (<em>oppA</em>, <em>dppA</em>, <em>argT</em>, <em>sstT</em>…).
              </figcaption>
            </figure>

            <figure className="my-3">
              <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-2">
                <img src="/explore-interactome-ril.svg" alt="Interactome with the RIL-seq overlay — GcvB partners that are known RIL-seq targets shown in teal" className="mx-auto block max-w-full h-auto" />
              </div>
              <figcaption className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                The same view with the <strong>RIL‑seq overlay</strong> on. Teal chords/dots mark partners
                that are independently known RIL‑seq targets (Melamed et al. 2016); the button reads{" "}
                <strong>RIL‑seq (19)</strong> — here every one of GcvB&apos;s high‑confidence TRIC‑seq
                partners is corroborated, a quick visual cross‑check of new vs. validated targets.
              </figcaption>
            </figure>

            <h4 className="font-semibold">Two views</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Genome</strong> — a circular “circos” layout. Best for seeing where on the chromosome a hub RNA reaches, and for spotting clustered (operon‑local) vs. genome‑spanning partners.</li>
              <li><strong>Linear</strong> — a scatter with genomic position on X and odds ratio (symlog) on Y. Best for ranking partners by specificity at a glance.</li>
            </ul>

            <h4 className="font-semibold mt-2">Controls</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>RIL‑seq</strong> — (E. coli) highlights partners that are known RIL‑seq targets (Melamed et al. 2016) in teal, so you can see what is corroborated vs. novel (see the overlay figure above).</li>
              <li><strong>Density</strong> — (Genome view) overlays a circular histogram of specific partners (<em>O</em><sup>f</sup> &gt; 5) per genomic window, revealing interaction hot‑regions.</li>
              <li><strong>OR ≥ 5</strong> — the chip by the colour bar drops unspecific partners and keeps only enriched ones.</li>
              <li><strong>Shuffle</strong> — jump to a random, well‑connected RNA — a good way to start exploring.</li>
              <li><strong>Export PNG</strong> — save the current view.</li>
            </ul>

            <p className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-3 text-sm">
              <strong>Interactions:</strong> hover a dot for <em>O</em><sup>f</sup>, <em>i</em><sub>o</sub> and FDR.
              <strong> Single‑click</strong> a partner to make it the new focal RNA. <strong>Double‑click</strong>{" "}
              to jump straight to its Pair contact map.
            </p>
          </section>

          {/* Pair */}
          <section id="pair" className="space-y-4 scroll-mt-24">
            <h3 className="text-xl font-semibold">
              Pair lens <span className="text-base font-normal text-slate-400">≈ pairMAP</span>
            </h3>
            <p>
              <strong>What it shows:</strong> a high‑resolution base‑pairing contact map between the focal
              RNA (Y axis) and one chosen partner (X axis), both drawn 5′→3′. Choose the partner by
              double‑clicking it (in the Interactome or the partners list) or with the dropdown. Bright
              cells are nucleotide bins that ligated often — i.e. were in close contact.
            </p>

            <figure className="my-3">
              <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-2">
                <img src="/explore-pair.svg" alt="Pair lens — base-pairing contact map between GcvB and the 5' UTR of oppA" className="mx-auto block max-w-full h-auto" />
              </div>
              <figcaption className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Pair contact map for <em>GcvB</em> (Y) × the 5′UTR of <em>oppA</em> (X) — a textbook GcvB
                target. The contact hotspot pins the interface to GcvB&apos;s conserved R1 region; axis ticks
                mark −flank / start / end / +flank, colour = read depth, and the cross marks the predicted
                base‑pairing site.
              </figcaption>
            </figure>

            <h4 className="font-semibold">Controls</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Flank Y / Flank X</strong> — how much sequence (±nt) to show around each transcript (default ±300).</li>
              <li><strong>Bin</strong> — nucleotides per cell (default 10 nt). Large windows are auto‑coarsened to stay legible.</li>
              <li><strong>Vmax</strong> — the colour ceiling; <em>auto</em> by default, lower it to bring out faint signal.</li>
            </ul>

            <h4 className="font-semibold mt-2">Built‑in base‑pairing prediction</h4>
            <p>
              The Pair lens runs a lightweight, <strong>RNAduplex‑style</strong> predictor over ±30 nt of
              each feature and reports up to two candidate duplex sites: estimated ΔG, base‑pair count
              (including G·U), the nucleotide span in each RNA, and the alignment. Each site is drawn as a{" "}
              <strong>cross on the map</strong> (black = site 1, grey = site 2). When the cross lands on a
              TRIC‑seq hotspot, you have independent sequence support for that interface.
            </p>
            <div className="bg-amber-50 border border-amber-300 rounded-md p-3 text-sm text-slate-800 dark:text-slate-200">
              <strong>Read it as:</strong> a focused hotspot near the two interfaces → a base‑pairing
              interface (classic sRNA–5′UTR); a diffuse block across a CDS → co‑association/aggregation;
              a 5′UTR + 3′UTR signal can reflect tertiary folding bringing the ends together. Treat the
              predicted ΔG as an estimate (it approximates IntaRNA&apos;s seed but omits the accessibility term).
              Sequence prediction is available for the bundled species and the demo.
            </div>
          </section>

          {/* Structure */}
          <section id="structure" className="space-y-4 scroll-mt-24">
            <h3 className="text-xl font-semibold">
              Structure lens <span className="text-base font-normal text-slate-400">≈ foldMAP</span>
            </h3>
            <p>
              <strong>What it shows:</strong> the focal RNA&apos;s <em>intramolecular</em> (self‑contact)
              map — an average picture of how the molecule folds back on itself in vivo — alongside a
              long‑range contact profile.
            </p>

            <figure className="my-3">
              <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-2">
                <img src="/explore-structure.svg" alt="Structure lens — intramolecular self-contact matrix and long-range profile" className="mx-auto block max-w-full h-auto" />
              </div>
              <figcaption className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Structure lens for <em>GcvB</em>. Left: the symmetric self‑contact matrix (5′→3′ on both
                axes, gene body framed, flanks shaded). Right: the long‑range (&gt; 5 kb) contact profile,
                with maxima marked.
              </figcaption>
            </figure>

            <h4 className="font-semibold">Controls</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Bin</strong> — nucleotides per cell (default 20 nt); smaller is sharper but sparser.</li>
              <li><strong>Flank</strong> — how much flanking sequence (±nt) to include (default 200).</li>
              <li><strong>raw / ICE</strong> — switch to <strong>ICE</strong> to balance per‑position coverage biases and bring out genuine architecture.</li>
              <li><strong>Vmax</strong> — colour ceiling (auto by default).</li>
            </ul>
            <p className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-3 text-sm">
              <strong>Read it as:</strong> blocks along the diagonal = local folded domains; gaps between
              blocks = insulated boundaries; off‑diagonal “corner” signal = long‑range contacts (e.g. 5′–3′
              end pairing). The <strong>long‑range profile</strong> on the right counts contacts each
              position makes with loci &gt; 5 kb away and flags the peaks — useful for spotting distal/trans
              engagement. This is a population average, so several conformations can overlay.
            </p>
          </section>

          {/* Compare */}
          <section id="compare" className="space-y-4 scroll-mt-24">
            <h3 className="text-xl font-semibold">
              Compare lens <span className="text-base font-normal text-slate-400">≈ csMAP</span>
            </h3>
            <p>
              <strong>What it shows:</strong> the focal RNA&apos;s target spectrum placed side‑by‑side with
              any RNAs you&apos;ve <strong>pinned</strong>. Pin partners with the{" "}
              <span className="font-medium">pin</span> icon in the partners list; the Compare tab badge
              tracks how many you&apos;ve added.
            </p>

            <figure className="my-3">
              <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-2">
                <img src="/explore-compare.svg" alt="Compare lens — target spectra of GcvB, 5'oppA, SroC and CsrB side by side" className="mx-auto block max-w-full h-auto" />
              </div>
              <figcaption className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Compare lens: <em>GcvB</em> (focal) against its target <em>5′oppA</em>, its sponge{" "}
                <em>SroC</em>, and the unrelated sRNA <em>CsrB</em>. Each column&apos;s dots are that RNA&apos;s
                distal targets (y = odds ratio, area = reads, colour = target class); the lower panel shows
                total interactions per RNA (log scale) — GcvB&apos;s hub connectivity towers over the rest.
              </figcaption>
            </figure>

            <ul className="list-disc pl-6 space-y-1">
              <li>The <strong>scatter</strong> (top) lines up each RNA&apos;s enriched distal targets so you can compare partner classes and specificity at a glance.</li>
              <li>The <strong>totals bars</strong> (bottom) compare overall connectivity — useful for separating promiscuous hubs from focused regulators.</li>
              <li>The focal RNA is always the first, highlighted column.</li>
            </ul>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Use it to contrast candidate hub sRNAs, or a regulator against a suspected sponge: similar
              target classes hint at shared logic; very different spectra argue for distinct roles.
            </p>
          </section>

          {/* Partners + export */}
          <section id="partners" className="space-y-4 scroll-mt-24">
            <h3 className="text-xl font-semibold">Partners panel &amp; export</h3>
            <p>
              The right‑hand panel is shared by every lens. At the top it summarises the focal RNA — feature
              type, coordinates, strand, total interactions and the number of partners passing your filters —
              with a link out to the relevant gene database (BioCyc, AureoWiki or SubtiWiki, by species).
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Sort</strong> the partner list by Odds ratio, Reads, FDR, Distance or Position.</li>
              <li><strong>Click</strong> a row to refocus; <strong>double‑click</strong> (or the grid icon) to open its Pair map; the <strong>pin</strong> icon adds it to Compare; the <strong>↗</strong> icon opens it in a gene database.</li>
              <li><strong>Export CSV</strong> downloads the full partner table (partner, feature, coordinates, reads, odds ratio, FDR, distance).</li>
              <li><strong>AI hypothesis</strong> sends the high‑confidence partners (reads ≥ 5 and <em>O</em><sup>f</sup> ≥ 10) to a model that drafts a short, testable regulatory hypothesis — a starting point, not a conclusion.</li>
            </ul>

            {/* BYOD */}
            <div id="byod" className="scroll-mt-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mt-4 space-y-2">
              <h4 className="font-semibold">Bring your own data</h4>
              <p className="text-sm">
                From the dataset menu, under <em>Your data</em>, upload an{" "}
                <strong>annotations CSV</strong> (<code>gene_name, start, end, feature_type, strand, chromosome</code>)
                and an <strong>interactions CSV</strong> (<code>ref, target, counts, odds_ratio, fdr, totals,
                total_ref, ref_type, target_type</code>). These power the Interactome, Compare and partners
                views immediately. The Pair and Structure contact maps rely on raw chimera files, which are
                bundled for the provided species and the demo.
              </p>
            </div>
          </section>

          {/* ===================== LEGACY ===================== */}
          <section id="legacy" className="space-y-4 scroll-mt-24 border-t border-slate-200 dark:border-slate-700 pt-8">
            <h2 className="text-2xl font-semibold">Legacy standalone tools</h2>
            <p className="text-slate-600 dark:text-slate-300">
              The four original tools below are kept for reference and reproducibility. Everything they do
              is now available — and linked together — inside the{" "}
              <Link href="/explore" className="text-blue-600 hover:underline">Explorer</Link>, which is the
              recommended way to work. The mapping is: globalMAP → Interactome, pairMAP → Pair, foldMAP →
              Structure, csMAP → Compare.
            </p>

            {/* globalMAP */}
            <div id="globalmap" className="space-y-3 scroll-mt-24">
              <h3 className="text-xl font-semibold">globalMAP</h3>
              <p>
                <strong>What it shows:</strong> a genome‑aware, RNA‑centric map of all partners for a
                selected RNA. Points encode partner position,{" "}
                <span><em>O</em><sup>f</sup></span>,{" "}
                <span><em>i</em><sub>o</sub></span>, and feature type. The table includes quick links (↗) to
                external gene databases based on your selected annotation preset.
              </p>
              <ol className="list-decimal pl-6 space-y-1">
                <li>Select a dataset preset for your species.</li>
                <li>Search for an RNA (e.g., sRNA <code>RyhB</code> or CDS <code>uvrA</code>).</li>
                <li>Tune filters: min <span><em>i</em><sub>o</sub></span>, min <span><em>O</em><sup>f</sup></span>, and feature class.</li>
                <li>Click a partner to recenter globalMAP on it.</li>
              </ol>
              <div className="mt-3 overflow-auto rounded border border-slate-200 dark:border-slate-700">
                <img src="/GlobalHelp.png" alt="How to use globalMAP" className="block max-w-full h-auto" />
              </div>
            </div>

            {/* csMAP */}
            <div id="csmap" className="space-y-3 scroll-mt-24">
              <h3 className="text-xl font-semibold">csMAP</h3>
              <p>
                <strong>What it shows:</strong> collapsed (comparative) interaction profiles so you can
                place multiple RNAs side‑by‑side and compare partner spectra.
              </p>
              <ol className="list-decimal pl-6 space-y-1">
                <li>Select a species preset.</li>
                <li>Add two or more RNAs to compare (e.g., hub sRNAs or candidate sponges).</li>
                <li>Use differences in partner classes (5′UTR vs. CDS) to infer logic; copy candidate pairs to <Link href="/pairmap" className="text-blue-600 hover:underline">pairMAP</Link> for interface‑level inspection.</li>
              </ol>
            </div>

            {/* pairMAP */}
            <div id="pairmap" className="space-y-3 scroll-mt-24">
              <h3 className="text-xl font-semibold">pairMAP</h3>
              <p>
                <strong>What it shows:</strong> a high‑resolution inter‑RNA heat map for a chosen pair
                (axes are nucleotide positions, binned).
              </p>
              <ol className="list-decimal pl-6 space-y-1">
                <li>Enter a Primary RNA and one or more Secondary RNAs.</li>
                <li>Set Flank (±nt around each RNA) and Bin (nt/bin) for resolution.</li>
                <li>
                  Interpret:
                  <ul className="list-disc pl-6 mt-1">
                    <li>Focused hotspot near diagonal → base‑pairing interface (typical sRNA–5′UTR).</li>
                    <li>Diffuse CDS‑wide signal → co‑association/aggregation (e.g., mRNA–mRNA).</li>
                    <li>5′UTR hotspot + 3′UTR signal can reflect tertiary folding bringing ends together (not necessarily a second binding site).</li>
                  </ul>
                </li>
              </ol>
              <div className="mt-3 overflow-auto rounded border border-slate-200 dark:border-slate-700">
                <img src="/PairHelp.png" alt="How to use pairMAP" className="block max-w-full h-auto" />
              </div>
            </div>

            {/* foldMAP */}
            <div id="foldmap" className="space-y-3 scroll-mt-24">
              <h3 className="text-xl font-semibold">foldMAP</h3>
              <p>
                <strong>What it shows:</strong> an intramolecular (self‑contact) map capturing an RNA&apos;s
                average tertiary organization in vivo.
              </p>
              <ol className="list-decimal pl-6 space-y-1">
                <li>Select a species and an RNA.</li>
                <li>Choose bin size to balance detail vs. sparsity.</li>
                <li>Look for domains (blocks along the diagonal), insulated boundaries, and interaction islands/deserts.</li>
              </ol>
              <p className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-3">
                <strong>Note:</strong> foldMAP summarizes a population‑average contact map; multiple
                conformations can overlay into the observed pattern. Use the export buttons to save the
                contact map and long‑range profile (SVG/CSV).
              </p>
            </div>
          </section>

          <footer className="pt-6 border-t border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
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

function LensCard({ title, sub, desc, href }: { title: string; sub: string; desc: string; href: string }) {
  return (
    <a
      href={href}
      className="block rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 transition hover:border-slate-300 hover:shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-slate-900 dark:text-slate-100">{title}</span>
        <span className="text-xs text-slate-400">{sub}</span>
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{desc}</p>
    </a>
  );
}
