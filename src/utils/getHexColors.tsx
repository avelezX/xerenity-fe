// Ordered as matplotlib / D3 "Category10" (Tableau) — the industry-standard
// categorical palette designed for maximum perceptual distinction between
// adjacent colors. The first 10 entries cover the vast majority of chart
// overlays; the remainder of the Material Design palette follows for cases
// where users pin >10 series simultaneously.
//
// Prior ordering started with 5 consecutive red-pink-purple-indigo tones,
// making the first few series in a MarketDashboard chart look nearly
// identical. See PR: "fix(chart): reorder XerenityHexColors to Category10".
export const XerenityHexColors = [
  // ── Category10 (D3 / matplotlib "tab10") ──
  '#1f77b4', // blue
  '#ff7f0e', // orange
  '#2ca02c', // green
  '#d62728', // red
  '#9467bd', // purple
  '#8c564b', // brown
  '#e377c2', // pink
  '#7f7f7f', // grey
  '#bcbd22', // olive
  '#17becf', // cyan
  // ── Material Design overflow (for >10 series) ──
  '#f44336', // red 500
  '#e91e63', // pink 500
  '#9c27b0', // purple 500
  '#673ab7', // deep purple 500
  '#3f51b5', // indigo 500
  '#2196f3', // blue 500
  '#03a9f4', // light blue 500
  '#00bcd4', // cyan 500
  '#009688', // teal 500
  '#4caf50', // green 500
  '#8bc34a', // light green 500
  '#cddc39', // lime 500
  '#ffeb3b', // yellow 500
  '#ffc107', // amber 500
  '#ff9800', // orange 500
  '#ff5722', // deep orange 500
  '#795548', // brown 500
  '#607d8b', // blue grey 500
  '#101010',
  '#181818',
  '#202020',
];

export function getHexColor(index: number) {
  return XerenityHexColors[index % XerenityHexColors.length];
}
