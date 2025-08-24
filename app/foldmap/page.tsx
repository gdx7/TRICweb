'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type Contact = { i: number; j: number; weight: number };

function simulateIntra(rna: string, n = 80): Contact[] {
  // A few blocks to imitate domains
  const contacts: Contact[] = [];
  const blocks = [
    { start: 5, end: 22, w: 0.9 },
    { start: 28, end: 40, w: 0.7 },
    { start: 48, end: 60, w: 0.8 },
    { start: 66, end: 76, w: 0.6 },
  ];
  for (const b of blocks) {
    for (let i = b.start; i <= b.end; i++) {
      for (let j = b.start; j <= b.end; j++) {
        const d = Math.abs(i - j);
        const val = Math.exp(-(d * d) / 20) * b.w;
        contacts.push({ i, j, weight: val });
      }
    }
  }
  return contacts;
}

export default function FoldMapPage() {
  const search = useSearchParams();
  const [rna, setRna] = useState<string>(search.get('rna') || 'oppA_5UTR');

  const contacts = useMemo(() => simulateIntra(rna), [rna]);

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1000, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>foldMAP</h1>
        <nav style={{ display: 'flex', gap: 16, fontSize: 14 }}>
          <Link href="/globalMAP">globalMAP</Link>
          <Link href="/csMAP">csMAP</Link>
          <Link href="/pairMAP">pairMAP</Link>
          <Link href="/help">Help</Link>
        </nav>
      </header>

      <section style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <label>
          RNA:
          <input value={rna} onChange={(e) => setRna(e.target.value)} style={{ marginLeft: 8, padding: 6, minWidth: 240 }} />
        </label>
        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
          Tip: Use from pairMAP (link per panel) or paste any RNA id to view its simulated structural contacts.
        </div>
      </section>

      <section style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Intramolecular contact map</h3>
        <div style={{ overflowX: 'auto' }}>
          <svg width={480} height={480} role="img" aria-label={`Intra contact ${rna}`}>
            {/* draw upper triangle heat */}
            {contacts.map((c, idx) => {
              const size = 6;
              const shade = Math.round(255 - Math.max(0, Math.min(1, c.weight)) * 200);
              return (
                <rect
                  key={idx}
                  x={c.i * size}
                  y={c.j * size}
                  width={size}
                  height={size}
                  fill={`rgb(${shade},${shade},${shade})`}
                  stroke="#fafafa"
                />
              );
            })}
          </svg>
        </div>
      </section>
    </div>
  );
}
