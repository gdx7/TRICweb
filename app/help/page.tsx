'use client';

import React from 'react';
import Link from 'next/link';

export default function HelpPage() {
  return (
    <div style={{ padding: '24px 20px', maxWidth: 1000, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Help & Quick Guide</h1>
        <nav style={{ display: 'flex', gap: 16, fontSize: 14 }}>
          <Link href="/globalMAP">globalMAP</Link>
          <Link href="/csMAP">csMAP</Link>
          <Link href="/pairMAP">pairMAP</Link>
          <Link href="/foldMAP">foldMAP</Link>
        </nav>
      </header>

      <section style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Data formats</h3>
        <p style={{ marginTop: 8 }}>
          The tools accept a unified “edges” format describing RNA–RNA interactions (chimeras). Provide a CSV/TSV/JSON with
          headers (case-insensitive):
        </p>
        <ul>
          <li><code>ref</code> (or <code>source</code>/<code>query</code>): primary RNA</li>
          <li><code>target</code>: partner RNA</li>
          <li><code>count</code>: interaction count</li>
          <li>Optional: <code>odds_ratio</code>, <code>ref_type</code>, <code>target_type</code>, <code>coord_ref</code>, <code>coord_target</code></li>
        </ul>
        <p style={{ fontSize: 12, color: '#666' }}>
          Tip: Use the same file across tools to keep views consistent. Each page also ships with a small demo dataset so you
          can explore before loading files.
        </p>
      </section>

      <section style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>globalMAP</h3>
        <ol>
          <li>Upload an edges file or click <em>Load Demo</em>.</li>
          <li>Pick a <strong>Primary RNA</strong> (e.g., an sRNA) to view all partners.</li>
          <li>Filter by minimum <em>count</em> and <em>odds ratio</em>; toggle partner types in <em>Advanced</em>.</li>
          <li>
            <strong>Legend scaling:</strong> choose whether circle area is proportional to <code>counts</code> or <code>counts + c</code>.
            The legend updates accordingly; this helps verify/standardize the visual scale used in figures.
          </li>
          <li>Select partners in the plot or table and:
            <ul>
              <li>Open selected in <strong>pairMAP</strong> for site-resolved heatmaps.</li>
              <li>Open selected in <strong>csMAP</strong> to compare target profiles.</li>
            </ul>
          </li>
        </ol>
      </section>

      <section style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>csMAP</h3>
        <p>Compare the “collapsed” partner profiles of multiple RNAs side-by-side.</p>
        <ol>
          <li>Upload your file (same as globalMAP) or <em>Load Demo</em>.</li>
          <li>Add RNAs to the compare list and filter by <em>odds ratio</em>/<em>count</em>.</li>
          <li>Click <em>pairMAP →</em> on any row to inspect that specific pair.</li>
        </ol>
      </section>

      <section style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>pairMAP</h3>
        <p>Site-resolved inter-RNA heat maps. This page preloads a simulated heatmap.</p>
        <ol>
          <li>Primary RNA is carried over from globalMAP/csMAP or can be typed in.</li>
          <li>Add multiple secondary RNAs; adjust bin size as needed.</li>
          <li>Use the per-panel <em>foldMAP</em> link to examine intramolecular structure for a chosen RNA.</li>
        </ol>
      </section>

      <section style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>foldMAP</h3>
        <p>Intramolecular contact maps (simulated by default). Paste any RNA name or follow links from pairMAP.</p>
      </section>
    </div>
  );
}
