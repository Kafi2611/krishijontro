// The colours of the charts and the demand heatmap. They were checked with a colour palette
// test: the two-series pair stays apart for colour-blind readers, and the heatmap steps go
// from light to dark in one hue. Text never uses these colours (it stays black or grey).
export const CHART_COLORS = {
  brand: "#11813c", // a chart with one series: KrishiJontro green (the same as --primary)
  // Two series side by side: blue and orange. (Green and orange look the same to people with
  // red-green colour blindness, so green is NOT used next to orange.)
  first: "#2a78d6",
  second: "#eb6834",
  grid: "#e1e0d9", // thin background lines
  axis: "#c3c2b7", // the baseline
  label: "#52514e", // axis text (dark grey)
  // The demand heatmap: 5 steps of one orange hue, light (a little) to dark (the most).
  heat: ["#f89d79", "#e7784b", "#d05418", "#ad3b00", "#872800"],
};
