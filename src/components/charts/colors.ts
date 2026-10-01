const SERIES_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];

/**
 * Series colour by fixed position (never by rank, so a shop keeps its colour when others are
 * filtered out). Three series keep colour-blind-safe separation; more must be folded or split.
 */
export const seriesColor = (i: number) => SERIES_COLORS[i] ?? "var(--muted)";
