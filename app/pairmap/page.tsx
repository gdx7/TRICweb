'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type PairCell = { x: number; y: number; w: number; h: number; v: number };

function simulateHeat(primary: string, secondary: string, bins = 24): PairCell[] {
  // Simple synthetic diagonal hot-spot to illustrate binding site
  const cells: PairCell[] = [];
  for (let i = 0; i < bins; i++) {
    for (let j = 0; j < bins; j++) {
      const dx = i - j;
      const center = bins * 0.45;
      const g = Math.exp(-((i - center) ** 2 + (j - center) ** 2) / (2 * (bins * 0.07) ** 2));
      const val = Math.exp(-(dx * dx) / 8) * g; // diagonal + local focus
      cells.push({ x: i, y: j, w: 1, h: 1, v: val });
    }
  }
  return cells;
}

export default function PairMapPage() {
  const search = useSearchParams();
  const [primary, setPrimary] = useState<string>(search.get('primary') || 'GcvB');
  const [secondaryList, setSecondaryList] = useState<string[]>(
    search.get('secondary') ? search.get('secondary')!.split(',').filter(Boolean) : ['oppA_5UTR', 'argT_5UTR']
  );
  const [bin, setBin] = useState<number>(24);

  const heatSets = useMemo(() => {
    return secondaryList.map((s) => ({ secondary: s, cells: simulateHeat(primary, s, bin) }));
  }, [primary, secondaryList, bin]);

  useEffect(() => {
    // nothing else for now—sim data always ready
  }, []);

  function addSecondary(name: string) {
    if (!name) return;
    setSecondaryList((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }

  function removeSecondary(name: string) {
    setSecondaryList((prev) => prev.filter((x) => x !== name));
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>pairMAP</h1>
        <nav style={{ display: 'flex', gap: 16, fontSize: 14 }}>
          <Link href="/globalMAP">globalMAP</Link>
          <Link href="/csMAP">csMAP</Link>
          <Link href="/foldMAP">foldMAP</Link>
          <Link href="/help">Help</Link>
        </nav>
      </header>

      <section style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <label>
            Primary RNA:{' '}
            <input value={primary} onChange={(e) => setPrimary(e.target.value)} style={{ padding: 6, minWidth: 200 }} />
          </label>
          <label>
            Add secondary:{' '}
            <input
              onKeyDown={(e: any) => e.key === 'Enter' && addSecondary(e.currentTarget.value)}
              style={{ padding: 6, minWidth: 200 }}
            />
          </label>
          <label>
            Bin size:
            <input type="number" value={bin} onChange={(e) => setBin(Math.max(8, Number(e.target.value) || 24))} style={{ width: 80, padding: 4, marginLeft: 8 }} />
          </label>
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {secondaryList.map((s) => (
            <span key={s} style={{ background: '#eee', borderRadius: 12, padding: '4px 10px', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <code>{s}</code>
              <button onClick={() => removeSecondary(s)} aria-label={`Remove ${s}`} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {heatSets.map(({ secondary, cells }) => (
          <div key={secondary} style={{ border: '1px solid #eee', borderRadius: 8, padding: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <strong>
                {primary} × {secondary}
              </strong>
              <Link href={`/foldMAP?rna=${encodeURIComponent(secondary)}`} style={{ fontSize: 13 }}>
                foldMAP({secondary}) →
              </Link>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <svg width={320} height={320} role="img" aria-label={`Heatmap ${primary}-${secondary}`}>
                {/* simple square heatmap */}
                {cells.map((c, i) => {
                  const size = 12;
                  // value to grayscale
                  const val = Math.max(0, Math.min(1, c.v));
                  const shade = Math.round(255 - val * 200);
                  return (
                    <rect
                      key={i}
                      x={c.x * size}
                      y={c.y * size}
                      width={size}
                      height={size}
                      fill={`rgb(${shade},${shade},${shade})`}
                      stroke="#f8f8f8"
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
