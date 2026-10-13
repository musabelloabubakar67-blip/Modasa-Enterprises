"use client";

import { useState } from "react";
import { tileBoxes, wallpaperRolls } from "@/lib/calculators";

function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        className="shop-input"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      {hint && <p className="text-muted mt-1 text-xs">{hint}</p>}
    </div>
  );
}

const num = (value: string) => Number(value.replace(",", ".")) || 0;

function Result({
  quantity,
  unit,
  detail,
  problem,
  onUse,
}: {
  quantity: number | null;
  unit: [string, string];
  detail?: string;
  problem?: string;
  onUse?: (quantity: number) => void;
}) {
  if (problem) return <p className="text-muted text-sm">{problem}</p>;
  if (quantity === null) return null;
  return (
    <div
      className="bg-tint border-accent flex flex-wrap items-center justify-between gap-3 border-l-2 px-4 py-3"
      role="status"
    >
      <p>
        You need{" "}
        <strong className="font-medium">
          {quantity} {quantity === 1 ? unit[0] : unit[1]}
        </strong>
        {detail && <span className="text-muted block text-xs">{detail}</span>}
      </p>
      {onUse && (
        <button type="button" className="shop-link text-sm" onClick={() => onUse(quantity)}>
          Use this quantity
        </button>
      )}
    </div>
  );
}

/** Rolls of wallpaper for a room, counted the way installers do: by full-height strips. */
export function RollCalculator({
  rollWidthCm,
  rollLengthCm,
  fixedRoll = false,
  onUse,
}: {
  rollWidthCm?: number | null;
  rollLengthCm?: number | null;
  /** The roll size comes from the product and can't be changed. */
  fixedRoll?: boolean;
  onUse?: (quantity: number) => void;
}) {
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [openings, setOpenings] = useState("");
  const [repeat, setRepeat] = useState("");
  const [rollW, setRollW] = useState(String(rollWidthCm ?? 53));
  const [rollL, setRollL] = useState(String((rollLengthCm ?? 1000) / 100));

  const started = width !== "" && height !== "";
  const result = started
    ? wallpaperRolls({
        wallWidthM: num(width),
        heightM: num(height),
        openingsWidthM: num(openings),
        patternRepeatCm: num(repeat),
        rollWidthCm: num(rollW),
        rollLengthCm: num(rollL) * 100,
      })
    : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <NumberField
          id="calc-width"
          label="Total wall width (m)"
          hint="Add up every wall."
          value={width}
          onChange={setWidth}
        />
        <NumberField id="calc-height" label="Wall height (m)" value={height} onChange={setHeight} />
        <NumberField
          id="calc-openings"
          label="Doors & windows (m)"
          hint="Total width, optional."
          value={openings}
          onChange={setOpenings}
        />
        <NumberField
          id="calc-repeat"
          label="Pattern repeat (cm)"
          hint="0 for plain designs."
          value={repeat}
          onChange={setRepeat}
        />
        {!fixedRoll && (
          <>
            <NumberField id="calc-roll-w" label="Roll width (cm)" value={rollW} onChange={setRollW} />
            <NumberField id="calc-roll-l" label="Roll length (m)" value={rollL} onChange={setRollL} />
          </>
        )}
      </div>
      {result &&
        (result.ok ? (
          <Result
            quantity={result.rolls}
            unit={["roll", "rolls"]}
            detail={`${result.strips} strips, ${result.stripsPerRoll} from each roll`}
            onUse={onUse}
          />
        ) : (
          <Result quantity={null} unit={["roll", "rolls"]} problem={result.reason} />
        ))}
    </div>
  );
}

/** Boxes of tiles or flooring for a floor, with 10% extra for cuts. */
export function AreaCalculator({
  coverageM2,
  fixedCoverage = false,
  onUse,
}: {
  coverageM2?: number | null;
  fixedCoverage?: boolean;
  onUse?: (quantity: number) => void;
}) {
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [coverage, setCoverage] = useState(coverageM2 ? String(coverageM2) : "");

  const started = length !== "" && width !== "";
  const result = started ? tileBoxes({ areaM2: num(length) * num(width), coverageM2PerBox: num(coverage) }) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <NumberField id="calc-floor-l" label="Floor length (m)" value={length} onChange={setLength} />
        <NumberField id="calc-floor-w" label="Floor width (m)" value={width} onChange={setWidth} />
        {!fixedCoverage && (
          <NumberField
            id="calc-coverage"
            label="One box covers (m²)"
            hint="Shown on the product page."
            value={coverage}
            onChange={setCoverage}
          />
        )}
      </div>
      {result &&
        (result.ok ? (
          <Result
            quantity={result.boxes}
            unit={["box", "boxes"]}
            detail={`Covers ${result.coveredM2} m², including 10% extra for cuts`}
            onUse={onUse}
          />
        ) : (
          <Result
            quantity={null}
            unit={["box", "boxes"]}
            problem={fixedCoverage ? result.reason : coverage === "" ? "Enter how much one box covers." : result.reason}
          />
        ))}
    </div>
  );
}
