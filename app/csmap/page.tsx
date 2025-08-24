'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

type Edge = {
  ref: string;
  target: string;
  count: number;
  odds_ratio?: number;
  target_type?: string;
};

const demoEdges: Edge[] = [
  { ref: 'GcvB', target: 'oppA_5UTR', count: 28, odds_ratio: 24.1, target_type: '5UTR' },
  { ref: 'GcvB', target: 'argT_5UTR', count: 22, odds_ratio: 19.3, target_type: '5UTR' },
  { ref: 'GcvB', target: 'dppA_5UTR', count: 18, odds_ratio: 14.9, target_type: '5UTR' },
  { ref: 'RyhB', target: 'sodB_5UTR', count: 30, odds_ratio: 25.4, target_type: '5UTR' },
  { ref: 'RyhB', target: 'sdhC_5UTR', count: 16, odds_ratio: 12.2, target_type: '5UTR' },
];

function parseFile(text: string, name: string): Edge[] {
  const lower = name.toLowerCase();
  try {
    if (lower.endsWith('.json')) {
      const arr = JSON.parse(text);
      if (Array.isArray(arr)) return arr;
    }
  } catch {}
  const sep = text.includes('\t') ? '\t' : ',';
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const iRef = headers.indexOf('ref');
  const iTarget = headers.indexOf('target');
  const iCount = headers.indexOf('count');
  const iOf = headers.indexOf('odds_ratio');
  const iTtype = headers.indexOf('target_type');
  const out: Edge[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep);
    out.push({
      ref: cells[iRef]?.trim(),
      target: cells[iTarget]?.trim(),
      count: Number(cells[iCount]) || 0,
      odds_ratio: iOf >= 0 ? Number(cells[iOf]) || undefined : undefined,
      target_type: iTtype >= 0 ? cells[iTtype]?.trim() : undefined,
    });
  }
  return out.filter((e) => e.ref && e.target);
}

export default function CsMapPage() {
  const search = useSearchParams();
  const router = useRouter();

  const [edges, setEdges] = useState<Edge[]>([]);
  const [compareList, setCompareList] = useState<string[]>(
    search.get('compare') ? search.get('compare')!.split(',').filter(Boolean) : ['GcvB', 'RyhB']
  );
  const [minOf, setMinOf] = useState<number>(0);
  const [minCount, setMinCount] = useState<number>(0);

  useEffect(() => {
    if (edges.length === 0) setEdges(demoEdges);
  }, [edges.length]);

  const allRefs = useMemo(() => Array.from(new Set(edges.map((e) => e.ref))).sort(), [edges]);

  const grouped = useMemo(() => {
    const g = new Map<string, Edge[]>();
    for (const e of edges) {
      if (!g.has(e.ref)) g.set(e.ref, []);
      g.get(e.ref)!.push(e);
    }
    return g;
  }, [edges]);

  const filteredByRef = useMemo(() => {
    return compareList.map((r) => {
      const arr = (grouped.get(r) || []).filter((e) => (e.odds_ratio ?? 0) >= minOf && e.count >= minCount);
      arr.sort((a, b) => (b.odds_ratio ?? 0) - (a.odds_ratio ?? 0));
      return { ref: r, edges: arr.slice(0, 50) };
    });
  }, [grouped, compareList, minOf, minCount]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setEdges(parseFile(text, f.name));
    };
    reader.readAsText(f);
  }

  function addRef(r: string) {
    if (!r) return;
    setCompareList((prev) => (prev.includes(r) ? prev : [...prev, r]));
  }

  function removeRef(r: string) {
    setCompareList((prev) => prev.filter((x) => x !== r));
  }

  function goPair(primary: string, target: string) {
    router.push(`/pairMAP?primary=${encodeURIComponent(primary)}&secondary=${encodeURIComponent(target)}`);
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>csMAP</h1>
        <nav style={{ display: 'flex', gap: 16, fontSize: 14 }}>
          <Link href="/globalMAP">globalMAP</Link>
          <Link href="/pairMAP">pairMAP</Link>
          <Link href="/foldMAP">foldMAP</Link>
          <Link href="/help">Help</Link>
        </nav>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label htmlFor="file">Load chimera/edges file:</label>
            <input id="file" type="file" accept=".csv,.tsv,.json,.txt" onChange={onFile} />
            <button onClick={() => setEdges(demoEdges)} style={{ padding: '6px 10px' }}>
              Load Demo
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
            Compare multiple RNAs side‑by‑side. Use presets or upload the same file used in globalMAP.
          </div>
        </div>

        <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label>Add RNA:</label>
            <input list="allRefs" onKeyDown={(e: any) => e.key === 'Enter' && addRef(e.currentTarget.value)} style={{ padding: 6, minWidth: 180 }} />
            <datalist id="allRefs">
              {allRefs.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {compareList.map((r) => (
              <span key={r} style={{ background: '#eee', borderRadius: 12, padding: '4px 10px', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <code>{r}</code>
                <button onClick={() => removeRef(r)} aria-label={`Remove ${r}`} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <details style={{ marginTop: 8 }}>
            <summary>Advanced filters</summary>
            <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
              <label>
                Min odds ratio:{' '}
                <input type="number" step="0.1" value={minOf} onChange={(e) => setMinOf(Number(e.target.value) || 0)} style={{ width: 80, padding: 4 }} />
              </label>
              <label>
                Min count:{' '}
                <input type="number" value={minCount} onChange={(e) => setMinCount(Number(e.target.value) || 0)} style={{ width: 80, padding: 4 }} />
              </label>
            </div>
          </details>
        </div>
      </section>

      <section style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Collapsed target profiles</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {filteredByRef.map((block) => (
            <div key={block.ref} style={{ border: '1px solid #f2f2f2', borderRadius: 8, padding: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <strong>{block.ref}</strong>
                <span style={{ fontSize: 12, color: '#666' }}>{block.edges.length} targets</span>
              </div>
              <div style={{ maxHeight: 280, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: '4px 6px' }}>Target</th>
                      <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: '4px 6px' }}>Type</th>
                      <th style={{ textAlign: 'right', borderBottom: '1px solid #eee', padding: '4px 6px' }}>Count</th>
                      <th style={{ textAlign: 'right', borderBottom: '1px solid #eee', padding: '4px 6px' }}>Odds</th>
                      <th style={{ borderBottom: '1px solid #eee' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {block.edges.map((e, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #fafafa' }}>
                        <td style={{ padding: '4px 6px' }}><code>{e.target}</code></td>
                        <td style={{ padding: '4px 6px' }}>{e.target_type ?? 'other'}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right' }}>{e.count}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right' }}>{e.odds_ratio?.toFixed(2) ?? '—'}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                          <button onClick={() => goPair(block.ref, e.target)} style={{ padding: '4px 8px' }}>
                            pairMAP →
                          </button>
                        </td>
                      </tr>
                    ))}
                    {block.edges.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: 8, color: '#777' }}>No targets pass current filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
