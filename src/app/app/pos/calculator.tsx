"use client";

import { useState } from "react";
import { skuLabel } from "@/components/sku-picker";
import { tileBoxes, wallpaperRolls } from "@/lib/calculators";
import type { TillItem } from "./actions";

const num = (v: string) => Number(v.replace(",", "."));

export function Calculator({
  item,
  onApply,
  onClose,
}: {
  item: TillItem;
  onApply: (quantity: number) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Quantity calculator"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-md space-y-4 p-5 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold">{item.coverage === "roll" ? "How many rolls?" : "How many boxes?"}</h2>
            <p className="text-muted text-sm">{skuLabel(item)}</p>
          </div>
          <button type="button" className="text-muted text-sm hover:underline" onClick={onClose}>
            Close
          </button>
        </div>
        {item.coverage === "roll" ? (
          <Wallpaper item={item} onApply={onApply} />
        ) : (
          <Tiles item={item} onApply={onApply} />
        )}
      </div>
    </div>
  );
}

function Wallpaper({ item, onApply }: { item: TillItem; onApply: (q: number) => void }) {
  const [walls, setWalls] = useState("");
  const [height, setHeight] = useState("2.7");
  const [openings, setOpenings] = useState("");
  const [repeat, setRepeat] = useState("");
  const [spare, setSpare] = useState(true);

  // Walls can be typed as "4 + 3.5 + 4 + 3.5" or a single total.
  const wallWidth = walls
    .split("+")
    .map((w) => num(w.trim()))
    .reduce((s, w) => s + (Number.isFinite(w) ? w : NaN), 0);
  const result = wallpaperRolls({
    wallWidthM: wallWidth,
    heightM: num(height),
    openingsWidthM: openings ? num(openings) : 0,
    rollWidthCm: Number(item.roll_width_cm ?? 0),
    rollLengthCm: Number(item.roll_length_cm ?? 0),
    patternRepeatCm: repeat ? num(repeat) : 0,
  });
  const rolls = result.ok ? result.rolls + (spare ? 1 : 0) : 0;

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label">Width of each wall (m)</span>
        <input
          className="input"
          value={walls}
          onChange={(e) => setWalls(e.target.value)}
          placeholder="e.g. 4 + 3.5 + 4 + 3.5"
          autoFocus
          inputMode="decimal"
        />
        <span className="text-muted text-xs">Add walls with +. For one feature wall, just its width.</span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Wall height (m)</span>
          <input className="input" value={height} onChange={(e) => setHeight(e.target.value)} inputMode="decimal" />
        </label>
        <label className="block">
          <span className="label">Doors & windows (m)</span>
          <input
            className="input"
            value={openings}
            onChange={(e) => setOpenings(e.target.value)}
            placeholder="Total width"
            inputMode="decimal"
          />
        </label>
      </div>
      <label className="block">
        <span className="label">Pattern repeat (cm)</span>
        <input
          className="input"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          placeholder="0 for plain — see the roll label"
          inputMode="decimal"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={spare} onChange={(e) => setSpare(e.target.checked)} />
        Add 1 spare roll (recommended — same batch, for repairs)
      </label>
      <p className="text-muted text-xs">
        Roll: {item.roll_width_cm ?? "?"} cm × {item.roll_length_cm ? Number(item.roll_length_cm) / 100 : "?"} m
      </p>
      {walls && (
        <div className="bg-background rounded-md p-3 text-sm">
          {result.ok ? (
            <>
              <p className="text-lg font-semibold">
                {rolls} roll{rolls === 1 ? "" : "s"}
              </p>
              <p className="text-muted">
                {result.strips} strips needed · {result.stripsPerRoll} per roll{spare && " · includes 1 spare"}
              </p>
            </>
          ) : (
            <p className="text-danger">{result.reason}</p>
          )}
        </div>
      )}
      <button type="button" className="btn btn-primary w-full" disabled={!result.ok} onClick={() => onApply(rolls)}>
        Use {result.ok ? rolls : ""} rolls
      </button>
    </div>
  );
}

function Tiles({ item, onApply }: { item: TillItem; onApply: (q: number) => void }) {
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [waste, setWaste] = useState("10");
  const result = tileBoxes({
    areaM2: num(length) * num(width),
    coverageM2PerBox: Number(item.coverage_m2 ?? 0),
    wastePercent: num(waste) || 0,
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Room length (m)</span>
          <input
            className="input"
            value={length}
            onChange={(e) => setLength(e.target.value)}
            autoFocus
            inputMode="decimal"
          />
        </label>
        <label className="block">
          <span className="label">Room width (m)</span>
          <input className="input" value={width} onChange={(e) => setWidth(e.target.value)} inputMode="decimal" />
        </label>
      </div>
      <label className="block">
        <span className="label">Extra for cuts & breakage (%)</span>
        <input className="input" value={waste} onChange={(e) => setWaste(e.target.value)} inputMode="decimal" />
      </label>
      <p className="text-muted text-xs">
        One {item.unit} covers {item.coverage_m2 ?? "?"} m².
      </p>
      {length && width && (
        <div className="bg-background rounded-md p-3 text-sm">
          {result.ok ? (
            <>
              <p className="text-lg font-semibold">
                {result.boxes} {item.unit}
              </p>
              <p className="text-muted">
                Floor {Math.round(num(length) * num(width) * 100) / 100} m² · covers {result.coveredM2} m²
              </p>
            </>
          ) : (
            <p className="text-danger">{result.reason}</p>
          )}
        </div>
      )}
      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={!result.ok}
        onClick={() => result.ok && onApply(result.boxes)}
      >
        Use {result.ok ? result.boxes : ""} {item.unit}
      </button>
    </div>
  );
}
