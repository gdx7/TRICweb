// app/help/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Help | TRIC‑seq Explorer",
  description:
    "How TRIC‑seq works, how to interpret the dataset, and how to use globalMAP, csMAP, pairMAP, and foldMAP.",
};

export default function HelpPage() {
  return (
    <article>
      <header>
        <h1>Help: TRIC‑seq Explorer</h1>
        <p className="lede">
          A quick guide to TRIC‑seq and how to explore RNA–RNA interactions,
          structures, and regulons using the tools in this site.
        </p>
      </header>

      <nav aria-label="On this page" className="onthepage">
        <strong>On this page:</strong>{" "}
        <a href="#overview">Overview</a> ·{" "}
        <a href="#dataset">Using this dataset</a> ·{" "}
        <a href="#globalmap">globalMAP</a> · <a href="#csmap">csMAP</a> ·{" "}
        <a href="#pairmap">pairMAP</a> · <a href="#foldmap">foldMAP</a>
      </nav>

      <section id="overview">
        <h2>Overview: What is TRIC‑seq?</h2>
        <p>
          <strong>TRIC‑seq (Total RNA Interaction Capture)</strong> is an{" "}
          <em>in situ</em>, genetics‑free proximity‑ligation method that maps
          native RNA–RNA contacts across bacterial transcriptomes. It preserves
          cellular context, capturing both{" "}
          <em>intramolecular</em> (structure/tertiary organization) and{" "}
          <em>intermolecular</em> (regulatory and proximity) contacts at
          high resolution.
        </p>
        <p>
          Each chimeric read corresponds to a unique ligation event between two
          RNA fragments that were close in the cell. By aggregating millions of
          such events, TRIC‑seq resolves:
        </p>
        <ul>
          <li>
            <strong>RNA structures</strong> (Hi‑C–like contact maps for rRNAs,
            mRNAs, sRNAs, etc.).
          </li>
          <li>
            <strong>Regulatory networks</strong> (sRNA–mRNA pairs, sponges,
            hubs).
          </li>
          <li>
            <strong>System‑level patterns</strong> (modular interactomes, stress
            RNA condensates, ribosome engagement).
          </li>
        </ul>
      </section>

      <section id="dataset">
        <h2>Using this dataset</h2>
        <p>
          The explorer provides pre‑loaded TRIC‑seq datasets for multiple
          bacteria (e.g., <em>E. coli</em>, <em>Staphylococcus aureus</em>,{" "}
          <em>Stutzerimonas stutzeri</em>, <em>Myxococcus xanthus</em>).
          Choose a preset in each tool to load data instantly.
        </p>

        <h3>Key concepts & fields you’ll see</h3>
        <ul>
          <li>
            <strong>Interaction count</strong> (<code>io</code>): number of
            unique chimeric reads supporting a pair.
          </li>
          <li>
            <strong>Odds ratio</strong> (<code>Of</code>): enrichment over a
            degree‑preserving configuration‑model null (higher means more
            specific than expected by chance).
          </li>
          <li>
            <strong>Adjusted P/FDR</strong>: multiple‑testing–corrected
            significance for long‑range interactions.
          </li>
          <li>
            <strong>Feature types</strong>: 5′UTR, CDS, 3′UTR, sRNA, tRNA,
            housekeeping RNA (hkRNA), sponge.
          </li>
        </ul>

        <h3>Quick start</h3>
        <ol>
          <li>
            Open a tool (e.g.,{" "}
            <Link href="/globalmap">globalMAP</Link>) and select a species
            preset.
          </li>
          <li>
            Search or highlight an RNA/gene of interest; adjust filters (e.g.,
            minimum <code>io</code>, minimum <code>Of</code>, distance).
          </li>
          <li>
            Click partners to drill down to detailed views (e.g.,{" "}
            <Link href="/pairmap">pairMAP</Link> for a heat map).
          </li>
          <li>
            Use per‑tool export (SVG/CSV) if available to capture figures or
            data for your analysis.
          </li>
        </ol>

        <h3>Recommended interpretation thresholds</h3>
        <p>
          For high‑confidence <em>trans</em> regulatory interactions in{" "}
          <em>E. coli</em>, a pragmatic default is{" "}
          <strong>
            <code>Of ≥ 10</code> (configuration‑model odds) and{" "}
            <code>io ≥ 5</code>
          </strong>
          . You can relax thresholds to explore hypotheses, then tighten them
          for claims. Remember that high‑degree RNAs (e.g., rRNAs) naturally
          accrue many low‑specificity contacts; prioritize <code>Of</code> and
          FDR over raw counts in those cases.
        </p>

        <aside className="note">
          <strong>Cite the resource:</strong> please cite the TRIC‑seq paper and
          the GEO dataset (accession <code>GSE305265</code>) when using results
          derived from this explorer.
        </aside>
      </section>

      <section id="globalmap">
        <h2>Tool guide: globalMAP</h2>
        <p>
          <strong>What it shows:</strong> a genome‑aware, RNA‑centric map of all
          partners for a selected RNA (or a genome‑wide overview when used
          broadly). Points typically encode partner genomic position,{" "}
          <code>Of</code>, and <code>io</code>, with color/shape by feature
          type.
        </p>
        <h3>How to use</h3>
        <ol>
          <li>Select a dataset preset for your species.</li>
          <li>
            Search for a query RNA by name (e.g., an sRNA like <code>RyhB</code>{" "}
            or a CDS like <code>uvrA</code>).
          </li>
          <li>
            Tune filters:
            <ul>
              <li>
                <em>Min interactions (<code>io</code>)</em> to reduce visual
                clutter.
              </li>
              <li>
                <em>Min odds (<code>Of</code>)</em> to emphasize specific pairs.
              </li>
              <li>
                Distance / class filters (e.g., focus on 5′UTRs or sRNAs).
              </li>
            </ul>
          </li>
          <li>
            Click a partner to open a detailed inspection (e.g.,{" "}
            <Link href="/pairmap">pairMAP</Link> for a heat map of the pair, or{" "}
            <Link href="/csmap">csMAP</Link> to compare multiple RNAs).
          </li>
        </ol>
        <p className="tip">
          <strong>Tip:</strong> For sRNA regulons, sorting by{" "}
          <code>Of</code> quickly reveals the most specific (high‑confidence)
          targets.
        </p>
      </section>

      <section id="csmap">
        <h2>Tool guide: csMAP</h2>
        <p>
          <strong>What it shows:</strong> collapsed (comparative) interaction
          profiles so you can place multiple RNAs side‑by‑side and compare their
          partner spectra at a glance.
        </p>
        <h3>How to use</h3>
        <ol>
          <li>Select a species preset.</li>
          <li>
            Add two or more RNAs to compare (e.g., several hub sRNAs, or
            candidate sponge RNAs).
          </li>
          <li>
            Adjust <code>io</code>/<code>Of</code> thresholds and feature
            filters to reveal core versus peripheral partners.
          </li>
          <li>
            Use differences in partner classes (e.g., 5′UTRs vs CDSs) to infer
            regulatory logic; follow up any intriguing pair in{" "}
            <Link href="/pairmap">pairMAP</Link>.
          </li>
        </ol>
        <p className="tip">
          <strong>Tip:</strong> Distinct, non‑overlapping partner profiles often
          indicate module separation; heavy overlap can flag co‑regulation or
          shared sponges.
        </p>
      </section>

      <section id="pairmap">
        <h2>Tool guide: pairMAP</h2>
        <p>
          <strong>What it shows:</strong> a high‑resolution inter‑RNA heat map
          for a chosen pair, optionally with flanking context. The axes are the
          nucleotide positions of each RNA, binned for clarity.
        </p>
        <h3>How to use</h3>
        <ol>
          <li>
            Enter a <em>Primary RNA</em> and one or more{" "}
            <em>Secondary RNAs</em>.
          </li>
          <li>
            Set <em>Flank</em> (±nt around each RNA) and <em>Bin</em> (nt per
            bin) for your resolution/zoom.
          </li>
          <li>
            Interpret:
            <ul>
              <li>
                A focused spot near the diagonal usually marks a base‑pairing
                interface (typical of sRNA–5′UTR).
              </li>
              <li>
                Broad, diffuse signal across CDS regions suggests co‑association
                (e.g., mRNA–mRNA co‑aggregation).
              </li>
              <li>
                If an sRNA binds in the 5′UTR while you also see signal near the
                mRNA 3′UTR, that can reflect tertiary folding that brings ends
                into proximity (not necessarily a second base‑pairing site).
              </li>
            </ul>
          </li>
        </ol>
        <p className="tip">
          <strong>Tip:</strong> Increase bin resolution (smaller bin size) to
          localize interfaces; widen flanks to reveal additional context.
        </p>
      </section>

      <section id="foldmap">
        <h2>Tool guide: foldMAP</h2>
        <p>
          <strong>What it shows:</strong> an intramolecular (self‑contact) map
          capturing the RNA’s average tertiary organization in vivo. Useful for
          rRNAs, structured sRNAs, and long mRNAs (ORF‑centric domains).
        </p>
        <h3>How to use</h3>
        <ol>
          <li>Select a species and an RNA of interest.</li>
          <li>Choose bin size to balance detail vs. noise.</li>
          <li>
            Look for domains (blocks along the diagonal), insulated regions, and
            interaction “deserts/islands.”
          </li>
        </ol>
        <p className="tip">
          <strong>Tip:</strong> For abundant RNAs (e.g., rRNAs), foldMAPs often
          recapitulate known 3D organization; for mRNAs, discrete ORF‑centric
          domains correlate with translation behavior.
        </p>
      </section>

      <footer className="foot">
        <p>
          Need more help? Open an issue on{" "}
          <a
            href="https://github.com/gdx7/TRICweb"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          .
        </p>
        <p>
          Explore:{" "}
          <Link href="/globalmap">globalMAP</Link> ·{" "}
          <Link href="/csmap">csMAP</Link> · <Link href="/pairmap">pairMAP</Link>{" "}
          · <Link href="/foldmap">foldMAP</Link>
        </p>
      </footer>

      <style jsx>{`
        h1 {
          margin-bottom: 0.25rem;
        }
        .lede {
          color: #374151;
          margin: 0.25rem 0 0.75rem;
        }
        .onthepage {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          padding: 0.75rem;
          border-radius: 8px;
          margin: 1rem 0 1.5rem;
        }
        .onthepage a {
          text-decoration: none;
        }
        .note {
          background: #fffbeb;
          border: 1px solid #fde68a;
          padding: 0.75rem;
          border-radius: 8px;
          margin-top: 0.75rem;
        }
        .tip {
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          padding: 0.6rem 0.75rem;
          border-radius: 6px;
          margin-top: 0.5rem;
        }
        .foot {
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
          color: #4b5563;
        }
      `}</style>
    </article>
  );
}
