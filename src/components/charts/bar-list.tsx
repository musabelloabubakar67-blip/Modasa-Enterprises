import { formatMoney } from "@/lib/money";

/**
 * Ranked horizontal bars (e.g. best sellers). Each row has its label and value in text, so the bar
 * is a visual aid and the numbers stay readable without it.
 */
export function BarList({
  rows,
  currency,
  color = "var(--series-1)",
  empty = "No data for this period.",
}: {
  rows: { key: string; label: string; detail?: string; value: number; href?: string }[];
  /** Values are money in minor units. */
  currency: string;
  color?: string;
  empty?: string;
}) {
  const formatValue = (n: number) => formatMoney(n, currency);
  const max = Math.max(0, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-muted text-sm">{empty}</p>;
  return (
    <ol className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1">
          <span className="min-w-0 truncate text-sm">
            {r.href ? (
              <a href={r.href} className="hover:underline">
                {r.label}
              </a>
            ) : (
              r.label
            )}
            {r.detail && <span className="text-muted ml-1.5 text-xs">{r.detail}</span>}
          </span>
          <span className="text-sm font-medium tabular-nums">{formatValue(r.value)}</span>
          <span className="bg-background col-span-2 block h-3 overflow-hidden rounded-r" aria-hidden="true">
            <span
              className="block h-full rounded-r"
              style={{ width: `${max > 0 ? Math.max(1, (r.value / max) * 100) : 0}%`, background: color }}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}
