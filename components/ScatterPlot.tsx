import React from "react";
import { Annotation, FeatureType, baseGene, formatGeneName, keyForPair, symlog } from "@/lib/shared";

// Adapted ScatterRow to match shared usage or re-defined here if specific to this component's view
// In shared.ts we have Pair, but ScatterRow is a View optimized interface.
// We can define it here or export it from shared if used elsewhere.
// For now, let's redefine it here or import if I added it to shared. 
// I did NOT add ScatterRow to shared.ts, so I will define it here.

export type ScatterRow = {
    partner: string;
    x: number;
    start: number;
    end: number;
    y: number;
    rawY: number;
    counts: number;
    type: FeatureType;
    distance: number;
    fdr?: number;
};

// colorOf is not in shared.ts export? 
// I put pickColor in shared.ts. I should use pickColor.
// I will alias it or just use pickColor.

import { pickColor } from "@/lib/shared";

interface ScatterPlotProps {
    focal: string;
    focalAnn?: Annotation;
    focalChimeraTotal: number;
    partners: ScatterRow[];
    genomeStart: number;
    genomeLen: number;
    yCap: number;
    yTicks: number[];
    labelThreshold: number;
    highlightSet: Set<string>;
    sizeScaleFactor: number;
    rilEnabled: boolean;
    rilPairsLower: Set<string>;
    onClickPartner: (gene: string) => void;
}

const ScatterPlot = React.memo(function ScatterPlot({
    focal,
    focalAnn,
    focalChimeraTotal,
    partners,
    genomeStart,
    genomeLen,
    yCap,
    yTicks,
    labelThreshold,
    highlightSet,
    sizeScaleFactor,
    rilEnabled,
    rilPairsLower,
    onClickPartner,
}: ScatterPlotProps) {
    const width = 900;
    const height = 520;
    const margin = { top: 12, right: 120, bottom: 42, left: 60 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const xScale = (x: number) => ((x - genomeStart) / genomeLen) * innerW;
    const yScale = (v: number) => {
        const t = symlog(v, 10, 10);
        const tMax = symlog(yCap, 10, 10);
        return innerH - (t / tMax) * innerH;
    };
    const sizeScale = (c: number) => (Math.sqrt(c) * 2 + 4) * sizeScaleFactor;

    // labels (do NOT mutate partners)
    const sortedForLabels = [...partners].sort((a, b) => b.rawY - a.rawY);
    const placed: { x: number; y: number }[] = [];
    const labels = sortedForLabels
        .filter((p) => p.rawY >= labelThreshold)
        .filter((p) => {
            const px = xScale(p.x);
            const py = yScale(p.y);
            const tooClose = placed.some((q) => Math.abs(q.x - px) < 12 && Math.abs(q.y - py) < 12);
            if (!tooClose) placed.push({ x: px, y: py });
            return !tooClose;
        })
        .slice(0, 80);

    // Buffer optimization: avoid creating arrays every render if possible, but here it's cheap enough
    const tickStep = 0.5 * 1_000_000;
    const tickCount = Math.floor(genomeLen / tickStep);
    const mbTicks = Array.from({ length: tickCount }, (_, i) => (i + 1) * 0.5);

    const focalBase = baseGene(focal).toLowerCase();

    return (
        <div className="w-full overflow-x-auto">
            <svg id="scatter-svg" width={width} height={height} className="mx-auto block">
                <defs>
                    <style>{`text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#1f2937;font-size:10px}.axis-label{font-size:11px}`}</style>
                </defs>
                <g transform={`translate(${margin.left},${margin.top})`}>
                    {/* X-axis */}
                    <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#222" />
                    {mbTicks.map((m, i) => {
                        const xAbs = genomeStart + m * 1_000_000;
                        return (
                            <g key={i} transform={`translate(${xScale(xAbs)},${innerH})`}>
                                <line y2={6} stroke="#222" />
                                <text y={20} textAnchor="middle">
                                    {Number.isInteger(m) ? `${m.toFixed(0)} Mb` : `${m} Mb`}
                                </text>
                            </g>
                        );
                    })}

                    {/* Y-axis */}
                    <line x1={0} y1={0} x2={0} y2={innerH} stroke="#222" />
                    {yTicks.map((t, i) => (
                        <g key={i} transform={`translate(0,${yScale(t)})`}>
                            <line x2={-6} stroke="#222" />
                            <text x={-9} y={3} textAnchor="end">{t}</text>
                            <line x1={0} x2={innerW} y1={0} y2={0} stroke="#eee" />
                        </g>
                    ))}
                    <text transform={`translate(${-44},${innerH / 2}) rotate(-90)`} className="axis-label">
                        Odds ratio
                    </text>

                    {/* focal marker */}
                    {focalAnn && (
                        <g>
                            {(() => {
                                const midAbs = Math.floor((focalAnn.start + focalAnn.end) / 2);
                                const disp = formatGeneName(focal, focalAnn.feature_type);
                                return (
                                    <>
                                        <line x1={xScale(midAbs)} y1={0} x2={xScale(midAbs)} y2={innerH} stroke="#444" strokeDasharray="3 3" />
                                        <polygon points={`${xScale(midAbs) - 6},${innerH + 10} ${xScale(midAbs) + 6},${innerH + 10} ${xScale(midAbs)},${innerH + 2}`} fill="#000" />
                                        <text x={xScale(midAbs)} y={-2} textAnchor="middle" style={{ fontStyle: disp.italic ? "italic" : "normal" }}>
                                            {disp.text} ({focalChimeraTotal})
                                        </text>
                                    </>
                                );
                            })()}
                        </g>
                    )}

                    {/* points — draw by counts WITHOUT mutating original partners */}
                    {[...partners].sort((a, b) => b.counts - a.counts).map((p, idx) => {
                        const partnerBase = baseGene(p.partner).toLowerCase();
                        const rilHit = rilEnabled && rilPairsLower.has(keyForPair(focalBase, partnerBase));
                        const highlighted = highlightSet.has(p.partner);
                        const face = rilHit ? "#2DD4BF" : (highlighted ? "#FFEB3B" : "#FFFFFF");
                        const color = pickColor(p.type);

                        return (
                            <g key={idx} transform={`translate(${xScale(p.x)},${yScale(p.y)})`}>
                                <circle
                                    r={sizeScale(p.counts)}
                                    fill={face}
                                    stroke={color}
                                    strokeWidth={2}
                                    className="cursor-pointer hover:opacity-80"
                                    onClick={() => onClickPartner(p.partner)}
                                />
                                <line x1={0} y1={0} x2={0} y2={Math.max(0, innerH - yScale(p.y))} stroke="#999" strokeDasharray="2 3" opacity={0.12} />
                            </g>
                        );
                    })}

                    {/* labels */}
                    {labels.map((p, i) => {
                        const disp = formatGeneName(p.partner, partners.find((q) => q.partner === p.partner)?.type);
                        return (
                            <g key={i} transform={`translate(${xScale(p.x)},${yScale(p.y)})`}>
                                <text x={6} y={-6} style={{ fontStyle: disp.italic ? "italic" : "normal" }}>
                                    {disp.text}
                                </text>
                            </g>
                        );
                    })}
                </g>
            </svg>
        </div>
    );
});

export default ScatterPlot;
