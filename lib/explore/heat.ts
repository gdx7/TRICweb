// lib/explore/heat.ts — multi-stop colour ramps for contact heatmaps.

function lerp(a: string, b: string, t: number) {
  const ah = a.replace("#", ""), bh = b.replace("#", "");
  const ar = parseInt(ah.slice(0, 2), 16), ag = parseInt(ah.slice(2, 4), 16), ab = parseInt(ah.slice(4, 6), 16);
  const br = parseInt(bh.slice(0, 2), 16), bg = parseInt(bh.slice(2, 4), 16), bb = parseInt(bh.slice(4, 6), 16);
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
}

function ramp(stops: string[], t: number) {
  const x = Math.max(0, Math.min(1, t));
  const seg = x * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(seg));
  return lerp(stops[i], stops[i + 1], seg - i);
}

const WARM = ["#ffffff", "#fde68a", "#fb923c", "#dc2626", "#7f1d1d"];
const EMBER = ["#ffffff", "#fecaca", "#f87171", "#b91c1c", "#450a0a"];

export const heatWarm = (t: number) => ramp(WARM, t);
export const heatRed = (t: number) => ramp(EMBER, t);
