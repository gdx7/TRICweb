'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

type Edge = {
  ref: string;
  target: string;
  count: number;
  odds_ratio?: number;
  ref_type?: string;
  target_type?: string;
  coord_ref?: number;
  coord_target?: number;
};

type FeatureType =
  | 'sRNA'
  | '5UTR'
  | 'CDS'
  | '3UTR'
  | 'tRNA'
  | 'hkRNA'
  | 'sponge'
  | 'other';

const RNA_COLORS: Record<string, string> = {
  sRNA: '#b100e8',
  '5UTR': '#1f77b4',
  CDS: '#ff7f0e',
  '3UTR': '#2ca02c',
  tRNA: '#d62728',
  hkRNA: '#9467bd',
  sponge: '#8c564b',
  other: '#7f7f7f',
};

const DEFAULT_PRIMARY = 'GcvB';

const demoEdges: Edge[] = [
  // --- minimal but illustrative demo dataset ---
  { ref: 'GcvB', target: 'oppA_5UTR', count: 28, odds_ratio: 24.1, ref_type: 'sRNA', target_type: '5UTR', coord_ref: 100, coord_target: 2_100_000 },
  { ref: 'GcvB', target: 'argT_5UTR', count: 22, odds_ratio: 19.3, ref_type: 'sRNA', target_type: '5UTR', coord_ref: 100, coord_target: 3_420_000 },
  { ref: 'GcvB', target: 'dppA_5UTR', count: 18, odds_ratio: 14.9, ref_type: 'sRNA', target_type: '5UTR', coord_ref: 100, coord_target: 4_850_000 },
  { ref: 'GcvB', target: 'gltI_5UTR', count: 12, odds_ratio: 10.7, ref_type: 'sRNA', target_type: '5UTR', coord_ref: 100, coord_target: 4_130_000 },

  // Add some hkRNA/background contacts to show filtering
  { ref: 'GcvB', target: '16S_rRNA', count: 5, odds_ratio: 1.2, ref_type: 'sRNA', target_type: 'hkRNA', coord_ref: 100, coord_target: 4_200_000 },
  { ref: 'GcvB', target: '23S_rRNA', count: 4, odds_ratio: 0.9, ref_type: 'sRNA', target_type: 'hkRNA', coord_ref: 100, coord_target: 4_205_000 },

  // Second sRNA hub to show cluster separation
  { ref: 'RyhB', target: 'sodB_5UTR', count: 30, odds_ratio: 25.4, ref_type: 'sRNA', target_type: '5UTR', coord_ref: 200, coord_target: 1_850_000 },
  { ref: 'RyhB', target: 'sdhC_5UTR', count: 16, odds_ratio: 12.2, ref_type: 'sRNA', target_type: '5UTR', coord_ref: 200, coord_target: 1_900_000 },
];

function parseDelimited(text: string): Edge[] {
  const sep = text.includes('\t') ? '\t' : ',';
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);

  const iRef = [idx('ref'), idx('source'), idx('query')].find(i => i >= 0) ?? -1;
  const iTarget = [idx('target')].find(i => i >= 0) ?? -1;
  const iCount = [idx('count'), idx('interaction count'), idx('interaction_count')].find(i => i >= 0) ?? -1;

  const iOf = [idx('odds_ratio'), idx('of'), idx('oddsratio')].find(i => i >= 0) ?? -1;
  const iRefType = [idx('ref_type'), idx('source_type')].find(i => i >= 0) ?? -1;
  const iTargetType = [idx('target_type')].find(i => i >= 0) ?? -1;
  const iCoordRef = [idx('coord_ref'), idx('start_ref')].find(i => i >= 0) ?? -1;
  const iCoordTarget = [idx('coord_target'), idx('start_target')].find(i => i >= 0) ?? -1;

  const out: Edge[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cells = lines[li].split(sep);
    if (iRef < 0 || iTarget < 0 || iCount < 0) continue;
    const e: Edge = {
      ref: cells[iRef]?.trim(),
      target: cells[iTarget]?.trim(),
      count: Number(cells[iCount]) || 0,
    };
    if (iOf >= 0) e.odds_ratio = Number(cells[iOf]) || undefined;
    if (iRefType >= 0) e.ref_type = (cells[iRefType]?.trim() as FeatureType) || undefined;
    if (iTargetType >= 0) e.target_type = (cells[iTargetType]?.trim() as FeatureType) || undefined;
    if (iCoordRef >= 0) e.coord_ref = Number(cells[iCoordRef]) || undefined;
    if (iCoordTarget >= 0) e.coord_target = Number(cells[iCoordTarget]) || undefined;
    if (e.ref && e.target) out.push(e);
  }
  return out;
}

function parseJSON(text: string): Edge[] {
  try {
    const obj = JSON.parse(text);
    if (Array.isArray(obj)) {
      return obj
        .map((o: any) => ({
          ref: String(o.ref ?? o.source ?? o.query ?? ''),
          target: String(o.target ?? ''),
          count: Number(o.count ?? o.interaction_count ?? 0),
          odds_ratio: o.odds_ratio != null ? Number(o.odds_ratio) : undefined,
          ref_type: o.ref_type,
          target_type: o.target_type,
          coord_ref: o.coord_ref != null ? Number(o.coord_ref) : undefined,
          coord_target: o.coord_target != null ? Number(o.coord_target) : undefined,
        }))
        .filter((e: Edge) => e.ref && e.target);
    }
  } catch {
    // ignore
  }
  return [];
}

function parseFile(text: string, name: string): Edge[] {
  const lower = name.toLowerCase();
  if (lower.endsWith('.json')) return parseJSON(text);
  return parseDelimited(text);
}

const Badge: React.FC<{ label: string; color?: string }> = ({ label, color = '#eee' }) => (
  <span style={{ background: color, color: '#000', borderRadius: 8, padding: '2px 8px', fontSize: 12, marginRight: 8 }}>
    {label}
  </span>
);

const Legend: React.FC<{
  areaMode: 'count' | 'countPlusC';
  c: number;
  sampleCounts?: number[];
  colorByType?: boolean;
}> = ({ areaMode, c, sampleCounts = [5, 15, 30], colorByType = true }) => {
  const toRadius = (count: number) => {
    const base = areaMode === 'count' ? count : Math.max(0, count + c);
    const area = base; // proportional to value; scale handled in plot
    return Math.sqrt(area);
  };
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ fontSize: 12, color: '#555' }}>
        Circle area ∝ <b>{areaMode === 'count' ? 'counts' : 'counts + c'}</b>
        {areaMode === 'countPlusC' ? ` (c = ${c})` : ''}.
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        {sampleCounts.map((v) => (
          <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width={40} height={40}>
              <circle cx={20} cy={20} r={toRadius(v)} fill={colorByType ? '#777' : '#333'} opacity={0.2} stroke="#777" />
            </svg>
            <div style={{ fontSize: 12 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function GlobalMapPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [edges, setEdges] = useState<Edge[]>([]);
  const [primary, setPrimary] = useState<string>(search.get('primary') || DEFAULT_PRIMARY);
  const [filterMinCount, setFilterMinCount] = useState<number>(0);
  const [filterMinOf, setFilterMinOf] = useState<number>(0);
  const [areaMode, setAreaMode] = useState<'count' | 'countPlusC'>('count');
  const [cOffset, setCOffset] = useState<number>(5);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [highlightTypes, setHighlightTypes] = useState<FeatureType[]>(['5UTR', 'CDS', 'sRNA']);

  const primaryEdges = useMemo(
    () =>
      edges
        .filter((e) => e.ref === primary)
        .filter((e) => e.count >= filterMinCount && (e.odds_ratio ?? 0) >= filterMinOf),
    [edges, primary, filterMinCount, filterMinOf]
  );

  const allPrimaries = useMemo(() => Array.from(new Set(edges.map((e) => e.ref))).sort(), [edges]);

  useEffect(() => {
    // Auto-load demo if dataset is empty
    if (edges.length === 0) {
      setEdges(demoEdges);
    }
  }, [edges.length]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const parsed = parseFile(text, f.name);
      if (parsed.length > 0) {
        setEdges(parsed);
        // default primary = most frequent ref
        const refCounts = parsed.reduce<Record<string, number>>((acc, x) => {
          acc[x.ref] = (acc[x.ref] ?? 0) + 1;
          return acc;
        }, {});
        const topRef = Object.entries(refCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (topRef) setPrimary(topRef);
      }
    };
    reader.readAsText(f);
  }

  const xScale = useMemo(() => {
    // compute a linear mapping for coord_target (if provided) else index-based
    const coords = primaryEdges.map((e, i) => e.coord_target ?? i * 1000);
    const min = Math.min(...coords, 0);
    const max = Math.max(...coords, 1);
    return (v: number, w: number) => {
      if (max === min) return w / 2;
      return ((v - min) / (max - min)) * (w - 60) + 30; // pad
    };
  }, [primaryEdges]);

  const rScale = (count: number) => {
    const base = areaMode === 'count' ? count : Math.max(0, count + cOffset);
    // square-root scaling so area ∝ base; tweak factor for visual range
    return Math.sqrt(base) * 1.4 + 2;
  };

  const visible = useMemo(() => {
    if (!highlightTypes.length) return primaryEdges;
    return primaryEdges.filter((e) => (e.target_type ? highlightTypes.includes((e.target_type as FeatureType) ?? 'other') : true));
  }, [primaryEdges, highlightTypes]);

  function toggleTarget(name: string) {
    setSelectedTargets((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  }

  function openPairMAP() {
    if (!primary || selectedTargets.length === 0) return;
    const secondary = selectedTargets.join(',');
    router.push(`/pairMAP?primary=${encodeURIComponent(primary)}&secondary=${encodeURIComponent(secondary)}`);
  }

  function openCsMAP() {
    const compare = [primary, ...selectedTargets].join(',');
    router.push(`/csMAP?compare=${encodeURIComponent(compare)}`);
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>globalMAP</h1>
        <nav style={{ display: 'flex', gap: 16, fontSize: 14 }}>
          <Link href="/csMAP">csMAP</Link>
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
            <button
              onClick={() => {
                setEdges(demoEdges);
                setPrimary(DEFAULT_PRIMARY);
                setSelectedTargets([]);
              }}
              style={{ padding: '6px 10px' }}
              aria-label="Load demo dataset"
            >
              Load Demo (E. coli)
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
            Accepted columns: <code>ref,target,count</code> (optional: <code>odds_ratio,ref_type,target_type,coord_ref,coord_target</code>).
          </div>
        </div>

        <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label>Primary RNA:</label>
            <input
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              list="primaries"
              style={{ padding: 6, minWidth: 180 }}
              aria-label="Primary RNA"
            />
            <datalist id="primaries">
              {allPrimaries.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <Badge label={`${primaryEdges.length} partners`} />
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <label>
              Min count:{' '}
              <input
                type="number"
                value={filterMinCount}
                onChange={(e) => setFilterMinCount(Number(e.target.value) || 0)}
                style={{ width: 80, padding: 4 }}
              />
            </label>
            <label>
              Min odds ratio:{' '}
              <input
                type="number"
                value={filterMinOf}
                onChange={(e) => setFilterMinOf(Number(e.target.value) || 0)}
                style={{ width: 80, padding: 4 }}
                step="0.1"
              />
            </label>
            <div>
              <label style={{ marginRight: 8 }}>Legend area:</label>
              <select
                value={areaMode}
                onChange={(e) => setAreaMode(e.target.value as 'count' | 'countPlusC')}
                style={{ padding: 4 }}
                aria-label="Area scaling mode"
              >
                <option value="count">counts</option>
                <option value="countPlusC">counts + c</option>
              </select>
              {areaMode === 'countPlusC' && (
                <input
                  type="number"
                  value={cOffset}
                  onChange={(e) => setCOffset(Number(e.target.value) || 0)}
                  style={{ width: 70, marginLeft: 8, padding: 4 }}
                  aria-label="Constant c"
                />
              )}
            </div>
          </div>

          <details style={{ marginTop: 8 }}>
            <summary>Advanced</summary>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['sRNA', '5UTR', 'CDS', '3UTR', 'tRNA', 'hkRNA', 'sponge'] as FeatureType[]).map((ft) => {
                const active = highlightTypes.includes(ft);
                return (
                  <label key={ft} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() =>
                        setHighlightTypes((prev) => (active ? prev.filter((x) => x !== ft) : [...prev, ft]))
                      }
                    />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: RNA_COLORS[ft],
                          opacity: 0.7,
                        }}
                      />
                      {ft}
                    </span>
                  </label>
                );
              })}
            </div>
          </details>
        </div>
      </section>

      {/* Visualization */}
      <section style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Interaction map for <em>{primary}</em></h3>
          <Legend areaMode={areaMode} c={cOffset} />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <svg width={1000} height={260} role="img" aria-label="Global interaction scatter">
            {/* axis */}
            <line x1={30} y1={220} x2={970} y2={220} stroke="#ccc" />
            <text x={30} y={240} fontSize={12} fill="#666">Genome / index</text>

            {visible.map((e, i) => {
              const x = xScale(e.coord_target ?? i * 1000, 1000);
              const y = 110; // single row for simplicity
              const r = rScale(e.count);
              const color = RNA_COLORS[e.target_type ?? 'other'] ?? RNA_COLORS.other;
              const selected = selectedTargets.includes(e.target);
              return (
                <g key={`${e.target}-${i}`} transform={`translate(${x},${y})`} style={{ cursor: 'pointer' }}
                   onClick={() => toggleTarget(e.target)}>
                  <circle r={r} fill={color} opacity={selected ? 0.6 : 0.25} stroke={selected ? '#000' : color} />
                  <text y={r + 12} textAnchor="middle" fontSize={10} fill="#333">{e.target}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
          Tip: click circles to select/deselect partners.
        </div>
      </section>

      {/* Partner table + hand-offs */}
      <section style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Partners</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={openPairMAP} disabled={!selectedTargets.length} style={{ padding: '6px 10px' }}>
              Open in pairMAP
            </button>
            <button onClick={openCsMAP} disabled={!selectedTargets.length} style={{ padding: '6px 10px' }}>
              Compare in csMAP
            </button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ borderBottom: '1px solid #eee', padding: '6px 8px' }}>Selected</th>
                <th style={{ borderBottom: '1px solid #eee', padding: '6px 8px' }}>Target</th>
                <th style={{ borderBottom: '1px solid #eee', padding: '6px 8px' }}>Type</th>
                <th style={{ borderBottom: '1px solid #eee', padding: '6px 8px' }}>Count</th>
                <th style={{ borderBottom: '1px solid #eee', padding: '6px 8px' }}>Odds ratio</th>
              </tr>
            </thead>
            <tbody>
              {primaryEdges
                .slice()
                .sort((a, b) => (b.odds_ratio ?? 0) - (a.odds_ratio ?? 0))
                .map((e, i) => {
                  const checked = selectedTargets.includes(e.target);
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '6px 8px' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleTarget(e.target)} />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <code>{e.target}</code>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: RNA_COLORS[e.target_type ?? 'other'] ?? RNA_COLORS.other,
                              display: 'inline-block',
                            }}
                          />
                          {e.target_type ?? 'other'}
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px' }}>{e.count}</td>
                      <td style={{ padding: '6px 8px' }}>{e.odds_ratio?.toFixed(2) ?? '—'}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
