import React, { useMemo } from "react";
import { Annotation, FeatureType, Pair, cf, formatGeneName, symlog } from "@/lib/shared";
import { FEATURE_COLORS, exportSVG } from "@/lib/shared";

interface CsMapPlotProps {
    geneList: string[];
    pairs: Pair[];
    annoByCF: Map<string, Annotation>;
    sizeScaleFactor: number;
}

const CsMapPlot = React.memo(function CsMapPlot({
    geneList,
    pairs,
    annoByCF,
    sizeScaleFactor,
}: CsMapPlotProps) {
    // ---------- Build csMAP dots + totals ----------
    const { dots, totals, warnings } = useMemo(() => {
        const warnings: string[] = [];
        const dots: { col: number; yT: number; r: number; stroke: string }[] = [];
        const totals: { gene: string; total: number; type?: FeatureType }[] = [];

        const COUNT_MIN = 10;
        const DIST_MIN = 5000; // bp
        const OR_CAP = 5000;
        const LINTHRESH = 10;

        // Local symlog for consistency with specific internal usage if needed, 
        // but we can use shared symlog. 
        // The implementation in shared is: return a <= linthresh ? s * (a / linthresh) : s * (1 + Math.log(a / linthresh) / Math.log(base));
        // The implementation in csmap was: return a <= LINTHRESH ? (a / LINTHRESH) : (1 + Math.log10(a / LINTHRESH));
        // Shared uses log(base) which defaults to ln(10) so it's log10. 
        // So distinct implementation is not needed unless parameters differ consistently.
        // In csmap, base is implied 10. Shared default is 10.
        // However, shared uses Math.log/Math.log(base). csmap used Math.log10. Math.log(x)/Math.log(10) == Math.log10(x).
        // So we can use shared symlog(v, LINTHRESH, 10).

        geneList.forEach((gRaw, col) => {
            const gCF = cf(gRaw);
            const annG = annoByCF.get(gCF);
            if (!annG) warnings.push(`No annotation for ${gRaw}`);

            // totals
            let total = 0;
            for (const e of pairs) {
                if (cf(e.ref) === gCF && e.total_ref) { total = e.total_ref; break; }
                if (cf(e.target) === gCF && e.totals) { total = e.totals; break; }
            }
            totals.push({ gene: gRaw, total: Math.max(0, Math.floor(total)), type: annG?.feature_type });

            const cand: { pos: number; or: number; counts: number; type: FeatureType }[] = [];
            for (const e of pairs) {
                const isRef = cf(e.ref) === gCF;
                const isTgt = cf(e.target) === gCF;
                if (!isRef && !isTgt) continue;

                const partner = isRef ? e.target : e.ref;
                const annP = annoByCF.get(cf(partner));
                if (!annP || !annG) continue;

                const dist = Math.min(
                    Math.abs(annP.start - (annG.end ?? annP.end)),
                    Math.abs(annP.end - (annG.start ?? annP.start)),
                    Math.abs(annP.start - (annG.start ?? annP.start)),
                    Math.abs(annP.end - (annG.end ?? annP.end))
                );

                const counts = Number(e.counts) || 0;
                const or = Number(e.odds_ratio) || 0;
                const type = (isRef ? e.target_type : e.ref_type) || annP.feature_type || "CDS";

                if (counts < COUNT_MIN) continue;
                if (!(or > 0)) continue;
                if (dist <= DIST_MIN) continue;
                if (type === "hkRNA") continue;

                cand.push({ pos: annP.start, or, counts, type: type as FeatureType });
            }

            cand.sort((a, b) => a.pos - b.pos);
            const peaks: typeof cand = [];
            let cur = cand[0];
            for (let i = 1; i < cand.length; i++) {
                const nx = cand[i];
                if (nx.pos > (cur?.pos ?? 0) + 1000) {
                    if (cur) peaks.push(cur);
                    cur = nx;
                } else if (cur && nx.or > cur.or) {
                    cur = nx;
                }
            }
            if (cur) peaks.push(cur);

            peaks.sort((a, b) => b.counts - a.counts);
            for (const p of peaks) {
                const y = Math.min(OR_CAP, p.or);
                // Using shared symlog
                const yT = symlog(y, LINTHRESH, 10);
                const r = (Math.sqrt(p.counts) * 1.5) * sizeScaleFactor; // radius ∝ √counts → area ∝ counts
                dots.push({ col, yT, r, stroke: FEATURE_COLORS[p.type] || "#F78208" });
            }
        });

        return { dots, totals, warnings };
    }, [geneList, pairs, annoByCF, sizeScaleFactor]);

    // ---------- Layout / scales ----------
    const W = Math.max(560, 200 * Math.max(1, geneList.length));
    const SC_H = 560;
    const margin = { top: 40, right: 90, bottom: 88, left: 64 };
    const innerW = W - margin.left - margin.right;
    const innerH = SC_H - margin.top - margin.bottom;

    const yMaxT = 1 + Math.log10(5000 / 10);
    const yPix = (t: number) => innerH - (t / yMaxT) * innerH;

    // bar (totals)
    const BAR_H = 340;
    const bMargin = { top: 28, right: 40, bottom: 74, left: 64 };
    const bInnerW = W - bMargin.left - bMargin.right;
    const bInnerH = BAR_H - bMargin.top - bMargin.bottom;

    const tMax = Math.max(1, ...totals.map((t) => t.total));
    const log10 = (v: number) => (v <= 0 ? 0 : Math.log10(v));
    const barY = (v: number) => bInnerH - (log10(v) / log10(tMax || 1)) * bInnerH;
    const barW = Math.min(18, Math.max(12, bInnerW / (geneList.length * 3)));
    const maxPow = Math.ceil(log10(tMax || 1));
    const barTicks = Array.from({ length: maxPow + 1 }, (_, k) => Math.pow(10, k));

    return (
        <>
            {/* Collapsed scatter */}
            <div className="relative overflow-x-auto rounded-lg border bg-white dark:bg-slate-900">
                <button
                    onClick={() => exportSVG("csmap-scatter", "csMAP_scatter")}
                    className="absolute right-3 top-3 text-xs px-2 py-1 border rounded bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800"
                >
                    Export SVG
                </button>
                <svg id="csmap-scatter" width={W} height={SC_H} style={{ display: "block" }}>
                    <defs>
                        <style>{`text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#334155;font-size:11px}`}</style>
                    </defs>
                    <g transform={`translate(${margin.left},${margin.top})`}>
                        <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#222" />
                        {geneList.map((g, i) => {
                            const cx = ((i + 0.5) / geneList.length) * innerW;
                            const annG = annoByCF.get(cf(g));
                            const disp = formatGeneName(g, annG?.feature_type);
                            return (
                                <g key={i} transform={`translate(${cx},${innerH})`}>
                                    <line y2={6} stroke="#222" />
                                    <text y={24} textAnchor="middle" style={{ fontStyle: disp.italic ? "italic" : "normal" }}>
                                        {disp.text}
                                    </text>
                                </g>
                            );
                        })}
                        {[0, 1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000].map((v, i) => {
                            const t = v <= 10 ? v / 10 : 1 + Math.log10(v / 10);
                            return (
                                <g key={i} transform={`translate(0,${yPix(t)})`}>
                                    <line x2={-6} stroke="#222" />
                                    <text x={-9} y={3} textAnchor="end">{v}</text>
                                    <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eef2f7" />
                                </g>
                            );
                        })}
                        <text transform={`translate(${-50},${innerH / 2}) rotate(-90)`}>Odds ratio (symlog)</text>

                        {dots.map((d, idx) => {
                            const cx = ((d.col + 0.5) / geneList.length) * innerW + (Math.random() - 0.5) * 6;
                            const cy = yPix(d.yT);
                            return (
                                <g key={idx} transform={`translate(${cx},${cy})`}>
                                    <circle r={d.r} fill="#fff" stroke={d.stroke} strokeWidth={2} />
                                </g>
                            );
                        })}
                    </g>
                </svg>

                <div className="px-4 pb-4">
                    <div className="mt-2 flex flex-wrap gap-4 items-center">
                        <span className="text-sm font-medium">Feature types</span>
                        {[
                            { key: "CDS", color: FEATURE_COLORS.CDS, label: "CDS" },
                            { key: "5'UTR", color: FEATURE_COLORS["5'UTR"], label: "5'UTR" },
                            { key: "3'UTR", color: FEATURE_COLORS["3'UTR"], label: "3'UTR" },
                            { key: "sRNA/ncRNA", color: FEATURE_COLORS.sRNA, label: "sRNA/ncRNA" },
                            { key: "tRNA", color: FEATURE_COLORS.tRNA, label: "tRNA" },
                            { key: "rRNA/hkRNA", color: FEATURE_COLORS.rRNA, label: "rRNA/hkRNA" },
                            { key: "sponge", color: FEATURE_COLORS.sponge, label: "Sponge" },
                        ].map((item) => (
                            <span key={item.key} className="inline-flex items-center gap-2 text-xs">
                                <span
                                    className="inline-block w-3 h-3 rounded-full border"
                                    style={{ background: "#fff", borderColor: item.color, boxShadow: `inset 0 0 0 2px ${item.color}` }}
                                />
                                {item.label}
                            </span>
                        ))}
                        <span className="ml-4 text-xs text-slate-500 dark:text-slate-400">Circle area ∝ counts</span>
                    </div>
                </div>
            </div>

            {/* Totals bar chart (log10) */}
            <div className="relative overflow-x-auto rounded-lg border bg-white dark:bg-slate-900 mt-6">
                <button
                    onClick={() => exportSVG("csmap-bars", "csMAP_totals")}
                    className="absolute right-3 top-3 text-xs px-2 py-1 border rounded bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800"
                >
                    Export SVG
                </button>
                <svg id="csmap-bars" width={W} height={BAR_H} style={{ display: "block" }}>
                    <defs>
                        <style>{`text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#334155;font-size:11px}`}</style>
                    </defs>
                    <g transform={`translate(${bMargin.left},${bMargin.top})`}>
                        <line x1={0} y1={bInnerH} x2={bInnerW} y2={bInnerH} stroke="#222" />
                        {barTicks.map((v, i) => {
                            const y = barY(v);
                            return (
                                <g key={i} transform={`translate(0,${y})`}>
                                    <line x2={-6} stroke="#222" />
                                    <text x={-9} y={3} textAnchor="end">{v}</text>
                                    <line x1={0} x2={bInnerW} y1={0} y2={0} stroke="#eef2f7" />
                                </g>
                            );
                        })}
                        <text transform={`translate(${-46},${bInnerH / 2}) rotate(-90)`}>Total interactions (log10)</text>

                        {totals.map((t, i) => {
                            const x = (i + 0.5) * (bInnerW / Math.max(1, totals.length)) - barW / 2;
                            const y = barY(Math.max(1, t.total));
                            const h = bInnerH - y;
                            const disp = formatGeneName(t.gene, t.type);
                            return (
                                <g key={i}>
                                    <rect x={x} y={y} width={barW} height={h} fill="#93c5fd" stroke="#60a5fa" />
                                    <text x={x + barW / 2} y={bInnerH + 18} textAnchor="middle" style={{ fontStyle: disp.italic ? "italic" : "normal" }}>
                                        {disp.text}
                                    </text>
                                </g>
                            );
                        })}
                    </g>
                </svg>
            </div>

            {warnings.length > 0 && (
                <div className="mt-3 text-xs text-amber-700">{warnings.join(" · ")}</div>
            )}
        </>
    );
});

export default CsMapPlot;
