"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatMoney, formatMoneyShort } from "@/lib/money";

export type LineSeries = { key: string; label: string; color: string; values: number[] };

const M = { top: 12, right: 96, bottom: 28, left: 64 };

/** Rounds the axis maximum up to a friendly number and returns ~4 ticks. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}

/**
 * Multi-series line chart on one money axis, with a hover crosshair and tooltip, a legend, direct
 * labels at the line ends, and a table view for exact figures.
 */
export function LineChart({
  labels,
  series,
  currency,
  height = 260,
  title,
}: {
  /** One label per x position, e.g. dates. */
  labels: string[];
  series: LineSeries[];
  /** Values are money in minor units (kobo); formatted here so the chart can render on the client. */
  currency: string;
  height?: number;
  title: string;
}) {
  const formatValue = (n: number) => formatMoney(n, currency);
  const formatAxis = (n: number) => formatMoneyShort(n, currency);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const ticks = useMemo(() => niceTicks(max), [max]);
  const top = ticks[ticks.length - 1] || 1;
  const innerW = width - M.left - M.right;
  const innerH = height - M.top - M.bottom;
  const x = (i: number) => M.left + (labels.length <= 1 ? innerW / 2 : (i / (labels.length - 1)) * innerW);
  const y = (v: number) => M.top + innerH - (v / top) * innerH;
  const xTickEvery = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(innerW / 90))));

  // Direct labels at the line ends, nudged apart so they never overlap.
  const ends = series.map((s) => ({ s, y: y(s.values[s.values.length - 1] ?? 0) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 14);
  // If the stack runs past the bottom of the plot, shift it up as a block.
  const overflow = ends.length ? ends[ends.length - 1].y - (M.top + innerH) : 0;
  if (overflow > 0) for (const e of ends) e.y -= overflow;

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * innerW;
    const i = Math.round((px / innerW) * (labels.length - 1));
    setHover(Math.min(labels.length - 1, Math.max(0, i)));
  }

  return (
    <figure className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption className="font-semibold">{title}</figcaption>
        <div className="flex items-center gap-4 text-sm">
          {series.length > 1 && (
            <ul className="flex flex-wrap gap-3" aria-label="Legend">
              {series.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} aria-hidden="true" />
                  {s.label}
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="text-accent text-xs hover:underline" onClick={() => setTable((t) => !t)}>
            {table ? "Show chart" : "Show as table"}
          </button>
        </div>
      </div>

      {table ? (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-muted bg-surface sticky top-0 text-left">
              <tr>
                <th className="py-1 pr-3 font-medium">Date</th>
                {series.map((s) => (
                  <th key={s.key} className="py-1 pr-3 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {labels.map((l, i) => (
                <tr key={l}>
                  <td className="py-1 pr-3">{l}</td>
                  {series.map((s) => (
                    <td key={s.key} className="py-1 pr-3 text-right tabular-nums">
                      {formatValue(s.values[i] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative">
          <svg width={width} height={height} role="img" aria-label={`${title} chart`} className="block max-w-full">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={M.left + innerW} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
                <text
                  x={M.left - 8}
                  y={y(t)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-muted text-[11px]"
                >
                  {formatAxis(t)}
                </text>
              </g>
            ))}
            {labels.map((l, i) =>
              i % xTickEvery === 0 || i === labels.length - 1 ? (
                <text key={l} x={x(i)} y={height - 8} textAnchor="middle" className="fill-muted text-[11px]">
                  {l}
                </text>
              ) : null,
            )}
            {series.map((s) => (
              <polyline
                key={s.key}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              />
            ))}
            {ends.map(({ s, y: ly }) => (
              <g key={s.key}>
                <circle
                  cx={x(labels.length - 1)}
                  cy={y(s.values[s.values.length - 1] ?? 0)}
                  r={4}
                  fill={s.color}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
                <text
                  x={x(labels.length - 1) + 10}
                  y={ly}
                  dominantBaseline="middle"
                  className="fill-foreground text-[11px]"
                >
                  {s.label}
                </text>
              </g>
            ))}
            {hover !== null && (
              <g pointerEvents="none">
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1={M.top}
                  y2={M.top + innerH}
                  stroke="var(--muted)"
                  strokeWidth={1}
                />
                {series.map((s) => (
                  <circle
                    key={s.key}
                    cx={x(hover)}
                    cy={y(s.values[hover] ?? 0)}
                    r={4}
                    fill={s.color}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                ))}
              </g>
            )}
            <rect
              x={M.left}
              y={M.top}
              width={innerW}
              height={innerH}
              fill="transparent"
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
            />
          </svg>
          {hover !== null && (
            <div
              className="card pointer-events-none absolute z-10 min-w-40 p-2 text-xs shadow-md"
              style={{
                top: M.top,
                left: Math.min(x(hover) + 12, width - 180),
              }}
            >
              <p className="mb-1 font-semibold">{labels[hover]}</p>
              {series.map((s) => (
                <p key={s.key} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: s.color }}
                      aria-hidden="true"
                    />
                    {s.label}
                  </span>
                  <span className="font-medium tabular-nums">{formatValue(s.values[hover] ?? 0)}</span>
                </p>
              ))}
              {series.length > 1 && (
                <p className="border-border mt-1 flex justify-between border-t pt-1 font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {formatValue(series.reduce((sum, s) => sum + (s.values[hover] ?? 0), 0))}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
