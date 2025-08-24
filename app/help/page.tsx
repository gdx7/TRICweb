// app/help/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Help | TRIC-seq Explorer",
  description:
    "How TRIC-seq works, how to interpret the dataset, and how to use globalMAP, csMAP, pairMAP, and foldMAP.",
};

export default function HelpPage() {
  return (
    <article className="mx-auto max-w-3xl lg:max-w-5xl p-4 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold mb-1">Help: TRIC-seq Explorer</h1>
        <p className="text-slate-700">
          A quick guide to TRIC-seq and how to explore RNA–RNA interactions,
          structures, and regulons using the tools in this site.
        </p>
      </header>

      <nav
        aria-label="On this page"
        className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm"
      >
        <strong>On this page:</strong>{" "}
        <a className="hover:underline" href="#overview">Overview</a> ·{" "}
        <a className="hover:underline" href="#dataset">Using this dataset</a> ·{" "}
        <a className="hover:underline" href="#globalmap">globalMAP</a> ·{" "}
        <a className="hover:underline" href="#csmap">csMAP</a> ·{" "}
        <a className="hover:underline" href="#pairmap">pairMAP</a> ·{" "}
        <a className="hover:underline" href="#foldmap">foldMAP</a>
      </nav>

      <section id="overview" className="space-y-3">
        <h2 className="text-xl font-semibold">Overview: What is TRIC-seq?</h2>
        <p>
          <strong>TRIC-seq (Total RNA Interaction Capture)</strong> is an{" "}
          <em>in situ</em>, genetics-free proximity-ligation method that maps
          native RNA–RNA contacts across bacterial transcriptomes. It preserves
          cellular context, capturing both <em>intramolecular</em> (structure)
          and <em>intermolecular</em> (regulatory/proximity) contacts at
          high resolution.
        </p>
        <p>
          Each chimeric read corresponds to a unique ligation event between two
          RNA fragments that were close in the cell. By aggregating millions of
          such events, TRIC-seq resolves:
        </p>
        <ul className="list-disc pl-6">
          <li>
            <strong>RNA structures</strong> (Hi-C–like contact maps for rRNAs,
            mRNAs, sRNAs, etc.).
          </li>
          <li>
            <strong>Regulatory networks</strong> (sRNA–mRNA pairs, sponges,
            hubs).
          </li>
          <li>
            <strong>System-level patterns</strong> (modular interactomes, stress
            RNA condensates, ribosome engagement).
          </li>
        </ul>
      </section>

      <section id="dataset" className="space-y-3">
        <h2 className="text-xl font-semibold">Using this dataset</h2>
        <p>
          The explorer provides pre-loaded TRIC-seq datasets for multiple
          bacteria (e.g., <em>E. coli</em>, <em>Staphylococcus aureus</em>,{" "}
          <em>Stutzerimonas stutzeri</em>, <em>Myxococcus xanthus</em>). Choose
          a preset in each tool to load data instantly.
        </p>

        <h3 className="font-semibold">Key concepts &amp; fields you’ll see</h3>
        <ul className="list-disc pl-6">
          <li>
            <strong>Interaction count</strong> (<code>io</code>): number of
            unique chimeric reads supporting a pair.
          </li>
          <li>
            <strong>Odds ratio</strong> (<code>Of</code>): enrichment over a
            degree-preserving configuration-model null (higher = more specific).
          </li>
          <li>
            <strong>Adjusted P/FDR</strong>: multiple-testing–corrected
            significance for long-range interactions.
          </li>
          <li>
            <strong>Feature types</strong>: 5′UTR, CDS, 3′UTR, sRNA, tRNA,
            housekeeping RNA (hkRNA), sponge.
          </li>
        </ul>

        <h3 className="font-semibold">Quick start</h3>
        <ol className="list-decimal pl-6 space-y-1">
          <li>
            Open a tool (e.g.,{" "}
            <Link href="/global" className="text-blue-600 hover:underline">
              globalMAP
            </Link>
            ) and select a species preset.
          </li>
          <li>
            Search or highlight an RNA/gene of interest; adjust filters (e.g.,
            minimum <code>io</code>, minimum <code>Of</code>, distance).
          </li>
          <li>
            Click partners to drill down to detailed views (e.g.,{" "}
            <Link href="/pairmap" className="text-blue-600 hover:underline">
              pairMAP
            </Link>
            ).
          </li>
          <li>
            Use per-tool export (SVG/CSV) if available to capture figures or
            data for your analysis.
          </li>
        </ol>

        <h3 className="font-semibold">Recommended interpretation thresholds</h3>
        <p>
          For high-confidence <em>trans</em> regulatory interactions in{" "}
          <em>E. coli</em>, a pragmatic default is{" "}
          <strong>
            <code>Of ≥ 10</code> and <code>io ≥ 5</code>
          </strong>
          . Relax thresholds to explore; tighten them for claims. For highly
          connected RNAs (e.g., rRNAs), prioritize <code>Of</code>/FDR over raw
          counts.
        </p>

        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-slate-800">
          <strong>Cite the resource:</strong> please cite the TRIC-seq paper and
          GEO accession <code>GSE305265</code> when using this explorer.
        </div>
      </section>

      <section id="globalmap" className="space-y-3">
        <h2 className="text-xl font-semibold">Tool guide: globalMAP</h2>
        <p>
          <strong>What it shows:</strong> a genome-aware, RNA-centric map of all
          partners for a selected RNA (or an overview). Points encode partner
          position, <code>Of</code>, <code>io</code>, and feature type.
        </p>
        <h3 className="font-semibold">How to use</h3>
        <ol className="list-decimal pl-6 space-y-1">
          <li>Select a dataset preset for your species.</li>
          <li>
            Search for a query RNA by name (e.g., sRNA <code>RyhB</code> or CDS{" "}
            <code>uvrA</code>).
          </li>
          <li>
            Tune filters: min <code>io</code>, min <code>Of</code>, distance,
            and feature class.
          </li>
          <li>
            Click a partner to open a detailed view (e.g.,{" "}
            <Link href="/pairmap" className="text-blue-600 hover:underline">
              pairMAP
            </Link>{" "}
            or{" "}
            <Link href="/csmap" className="text-blue-600 hover:underline">
              csMAP
            </Link>
            ).
          </li>
        </ol>
        <p className="bg-slate-50 border border-slate-200 rounded-md p-2">
          <strong>Tip:</strong> Sorting by <code>Of</code> surfaces the most
          specific targets first.
        </p>

        {/* Helper PNG for globalMAP */}
        <div className="mt-3 overflow-auto rounded border border-slate-200">
          <img
            src="/GlobalHelp.png"
            alt="How to use globalMAP"
            className="block max-w-full h-auto"
          />
        </div>
      </section>

      <section id="csmap" className="space-y-3">
        <h2 className="text-xl font-semibold">Tool guide: csMAP</h2>
        <p>
          <strong>What it shows:</strong> collapsed (comparative) interaction
          profiles so you can place multiple RNAs side-by-side and compare their
          partner spectra.
        </p>
        <h3 className="font-semibold">How to use</h3>
        <ol className="list-decimal pl-6 space-y-1">
          <li>Select a species preset.</li>
          <li>
            Add two or more RNAs to compare (e.g., hub sRNAs or candidate
            sponges).
          </li>
          <li>
            Adjust <code>io</code>/<code>Of</code> thresholds and feature
            filters to reveal core vs. peripheral partners.
          </li>
          <li>
            Use differences in partner classes (5′UTR vs. CDS) to infer logic;
            follow up any pair in{" "}
            <Link href="/pairmap" className="text-blue-600 hover:underline">
              pairMAP
            </Link>
            .
          </li>
        </ol>
        <p className="bg-slate-50 border border-slate-200 rounded-md p-2">
          <strong>Tip:</strong> Non-overlapping profiles often indicate distinct
          modules; overlaps can flag co-regulation or shared sponges.
        </p>
      </section>

      <section id="pairmap" className="space-y-3">
        <h2 className="text-xl font-semibold">Tool guide: pairMAP</h2>
        <p>
          <strong>What it shows:</strong> a high-resolution inter-RNA heat map
          for a chosen pair (axes are nucleotide positions, binned).
        </p>
        <h3 className="font-semibold">How to use</h3>
        <ol className="list-decimal pl-6 space-y-1">
          <li>Enter a Primary RNA and one or more Secondary RNAs.</li>
          <li>
            Set Flank (±nt around each RNA) and Bin (nt/bin) for resolution.
          </li>
          <li>
            Interpret:
            <ul className="list-disc pl-6 mt-1">
              <li>
                Focused hotspot near diagonal → base-pairing interface (typical
                sRNA–5′UTR).
              </li>
              <li>
                Diffuse CDS-wide signal → co-association/aggregation (e.g.,
                mRNA–mRNA).
              </li>
              <li>
                5′UTR hotspot + 3′UTR signal can reflect tertiary folding
                bringing ends together (not a second binding site).
              </li>
            </ul>
          </li>
        </ol>
        <p className="bg-slate-50 border border-slate-200 rounded-md p-2">
          <strong>Tip:</strong> Smaller bins localize interfaces; larger flanks
          reveal context.
        </p>

        {/* Helper PNG for pairMAP */}
        <div className="mt-3 overflow-auto rounded border border-slate-200">
          <img
            src="/PairHelp.png"
            alt="How to use pairMAP"
            className="block max-w-full h-auto"
          />
        </div>
      </section>

      <section id="foldmap" className="space-y-3">
        <h2 className="text-xl font-semibold">Tool guide: foldMAP</h2>
        <p>
          <strong>What it shows:</strong> an intramolecular (self-contact) map
          capturing an RNA’s average tertiary organization in vivo.
        </p>
        <h3 className="font-semibold">How to use</h3>
        <ol className="list-decimal pl-6 space-y-1">
          <li>Select a species and an RNA.</li>
          <li>Choose bin size to balance detail vs. noise.</li>
          <li>
            Look for domains (blocks along the diagonal), insulated boundaries,
            and interaction islands/deserts.
          </li>
        </ol>
        <p className="bg-slate-50 border border-slate-200 rounded-md p-2">
          <strong>Tip:</strong> rRNAs often recapitulate known 3D organization;
          mRNAs show ORF-centric domains tied to translation behavior.
        </p>
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
          <Link href="/global" className="text-blue-600 hover:underline">
            globalMAP
          </Link>{" "}
          ·{" "}
          <Link href="/csmap" className="text-blue-600 hover:underline">
            csMAP
          </Link>{" "}
          ·{" "}
          <Link href="/pairmap" className="text-blue-600 hover:underline">
            pairMAP
          </Link>{" "}
          ·{" "}
          <Link href="/foldmap" className="text-blue-600 hover:underline">
            foldMAP
          </Link>
        </p>
      </footer>
    </article>
  );
}
