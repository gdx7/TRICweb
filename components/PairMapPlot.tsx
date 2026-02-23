import React, { useMemo } from "react";
import { Annotation, FeatureType, cf, formatGeneName, exportSVG } from "@/lib/shared";

interface PairMapPlotProps {
    primaryRNA: string;
    yAnn?: Annotation;
    xAnns: { label: string; key: string; ann: Annotation }[];
    contacts: Array<[number, number]>;
    flankX: number;
    flankY: number;
    binSize: number;
    vmax: number;
}

const PairMapPlot = React.memo(function PairMapPlot({
    primaryRNA,
    yAnn,
    xAnns,
    contacts,
    flankX,
    flankY,
    binSize,
    vmax,
}: PairMapPlotProps) {

    const mats = useMemo(() => {
        if (!yAnn) return [];
        const wy_s = Math.max(1, yAnn.start - flankY);
        const wy_e = yAnn.end + flankY;
        const len_y = wy_e - wy_s + 1;
        const bins_y = Math.ceil(len_y / binSize);

        function toBin(coord: number, ws: number, we: number, strand?: string) {
            const plus = strand !== "-";
            return plus ? Math.floor((coord - ws) / binSize) : Math.floor((we - coord) / binSize);
        }

        return xAnns.map(({ label, ann }, i) => {
            const wx_s = Math.max(1, ann.start - flankX);
            const wx_e = ann.end + flankX;
            const len_x = wx_e - wx_s + 1;
            const bins_x = Math.ceil(len_x / binSize);

            const mat = Array.from({ length: bins_y }, () => Array(bins_x).fill(0));
            for (const [c1, c2] of contacts) {
                let b1y = -1, b1x = -1, b2y = -1, b2x = -1;
                if (c1 >= wy_s && c1 <= wy_e) b1y = toBin(c1, wy_s, wy_e, yAnn.strand);
                if (c1 >= wx_s && c1 <= wx_e) b1x = toBin(c1, wx_s, wx_e, ann.strand);
                if (c2 >= wy_s && c2 <= wy_e) b2y = toBin(c2, wy_s, wy_e, yAnn.strand);
                if (c2 >= wx_s && c2 <= wx_e) b2x = toBin(c2, wx_s, wx_e, ann.strand);
                if (b1y !== -1 && b2x !== -1) mat[b1y][b2x] += 1;
                if (b2y !== -1 && b1x !== -1) mat[b2y][b1x] += 1;
            }

            return {
                label,
                typeX: ann.feature_type as FeatureType | undefined,
                mat,
                bins_x, bins_y,
                y_len_bins: Math.floor((yAnn.end - yAnn.start) / binSize),
                x_len_bins: Math.floor((ann.end - ann.start) / binSize),
                paletteIndex: i % 6,
            };
        });
    }, [contacts, xAnns, yAnn, flankX, flankY, binSize]);

    const leftPad = 54;
    const bottomPad = 56;
    const panelW = 360, panelH = 300, pad = 20;
    const W = Math.max(panelW * Math.max(1, mats.length) + pad * 2, 760);
    const H = panelH + 120;

    function colorFrom(val: number, vmaxVal: number, paletteIndex: number) {
        const t = Math.max(0, Math.min(1, val / Math.max(1, vmaxVal)));
        const hues = [0, 120, 220, 30, 280, 0];
        const hue = hues[paletteIndex]!;
        if (paletteIndex === 5) {
            const g = Math.round(230 - t * 200);
            return `rgb(${g},${g},${g})`;
        }
        return `hsla(${hue}, 75%, 50%, ${Math.pow(t, 0.85)})`;
    }

    const dispY = formatGeneName(primaryRNA, yAnn?.feature_type);

    return (
        <>
            <div className="rounded-lg border bg-white overflow-x-auto">
                <svg id="pairmap-svg" width={W} height={H} style={{ display: "block" }}>
                    <defs>
                        <style>{`text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;fill:#334155;font-size:11px}`}</style>
                    </defs>

                    {mats.map((m, i) => {
                        const left = 10 + i * panelW;
                        const top = 28;

                        const cw = panelW - (54 + 30);
                        const ch = panelH - (10 + 56);
                        const cellW = cw / m.bins_x;
                        const cellH = ch / m.bins_y;

                        const yPix = (bin: number) => 10 + (m.bins_y - 1 - bin) * cellH; // invert Y
                        const dispX = formatGeneName(m.label, m.typeX);

                        return (
                            <g key={i} transform={`translate(${left},${top})`}>
                                <rect x={54} y={10} width={cw} height={ch} fill="#fff" stroke="#222" strokeWidth={1} />

                                {m.mat.map((row, yy) =>
                                    row.map((v, xx) => (
                                        <rect
                                            key={`${yy}-${xx}`}
                                            x={54 + xx * cellW}
                                            y={yPix(yy)}
                                            width={cellW}
                                            height={cellH}
                                            fill={v > 0 ? colorFrom(v, vmax, i % 6) : "#ffffff"}
                                        />
                                    ))
                                )}

                                {/* X ticks */}
                                {(() => {
                                    const gx_len = m.x_len_bins;
                                    const gx_s = Math.floor(flankX / binSize);
                                    const gx_e = gx_s + gx_len - 1;
                                    const xticks = [0, gx_s, gx_e, m.bins_x - 1];
                                    const xlbls = [`-${flankX}`, "start", "end", `+${flankX}`];
                                    return xticks.map((b, j) => (
                                        <g key={j} transform={`translate(${54 + (b / m.bins_x) * cw},${10 + ch})`}>
                                            <line x1={0} y1={0} x2={0} y2={6} stroke="#222" />
                                            <text x={0} y={18} textAnchor="middle">{xlbls[j]}</text>
                                        </g>
                                    ));
                                })()}

                                {/* Y ticks */}
                                {(() => {
                                    const gy_len = m.y_len_bins;
                                    const gy_s = Math.floor(flankY / binSize);
                                    const gy_e = gy_s + gy_len - 1;
                                    const yticks = [0, gy_s, gy_e, m.bins_y - 1];
                                    const ylbls = [`-${flankY}`, "start", "end", `+${flankY}`];
                                    return yticks.map((b, j) => (
                                        <g key={j} transform={`translate(${54},${yPix(b)})`}>
                                            <line x1={-6} y1={0} x2={0} y2={0} stroke="#222" />
                                            <text x={-10} y={3} textAnchor="end">{ylbls[j]}</text>
                                        </g>
                                    ));
                                })()}

                                <text x={54 + cw / 2} y={ch + 38} textAnchor="middle" style={{ fontStyle: dispX.italic ? "italic" : "normal" }}>
                                    {dispX.text} (5′→3′)
                                </text>
                                <text transform={`translate(${54 - 34},${10 + ch / 2}) rotate(-90)`} textAnchor="middle" style={{ fontStyle: dispY.italic ? "italic" : "normal" }}>
                                    {dispY.text} (5′→3′)
                                </text>
                            </g>
                        );
                    })}
                </svg>
            </div>

            {!yAnn && (
                <div className="mt-2 text-xs text-amber-700">
                    Upload annotations (via dropdown or file) and ensure the primary RNA exists (names are case-insensitive).
                </div>
            )}
        </>
    );
});

export default PairMapPlot;
