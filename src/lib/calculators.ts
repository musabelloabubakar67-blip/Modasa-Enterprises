// Quantity calculators used at the till. Pure functions so they can be checked in isolation.

export type WallpaperInput = {
  /** Total width of the walls to paper, in metres (sum of each wall). */
  wallWidthM: number;
  /** Wall height in metres. */
  heightM: number;
  /** Total width of doors/windows/wardrobes that won't be papered, in metres. */
  openingsWidthM?: number;
  rollWidthCm: number;
  rollLengthCm: number;
  /** Pattern repeat in cm (0 for plain or random-match papers). */
  patternRepeatCm?: number;
};

export type WallpaperResult =
  { ok: true; strips: number; stripsPerRoll: number; rolls: number } | { ok: false; reason: string };

/** Extra length per strip for trimming at the ceiling and skirting. */
const TRIM_CM = 10;

/**
 * Rolls are worked out by strips (drops): how many full-height strips cover the wall width, and how
 * many strips fit in one roll once the pattern is matched. This is how installers count, and it's
 * more reliable than dividing areas.
 */
export function wallpaperRolls(input: WallpaperInput): WallpaperResult {
  const width = input.wallWidthM - (input.openingsWidthM ?? 0);
  if (!(input.wallWidthM > 0) || !(input.heightM > 0)) return { ok: false, reason: "Enter the wall width and height." };
  if (!(input.rollWidthCm > 0) || !(input.rollLengthCm > 0))
    return { ok: false, reason: "This wallpaper has no roll size set. Add it on the product." };
  if (width <= 0) return { ok: false, reason: "Doors and windows are wider than the walls." };

  const strips = Math.ceil((width * 100) / input.rollWidthCm);
  const stripLengthCm = input.heightM * 100 + (input.patternRepeatCm ?? 0) + TRIM_CM;
  const stripsPerRoll = Math.floor(input.rollLengthCm / stripLengthCm);
  if (stripsPerRoll < 1) return { ok: false, reason: "The wall is taller than one roll." };
  return { ok: true, strips, stripsPerRoll, rolls: Math.ceil(strips / stripsPerRoll) };
}

export type TileInput = { areaM2: number; coverageM2PerBox: number; wastePercent?: number };
export type TileResult = { ok: true; boxes: number; coveredM2: number } | { ok: false; reason: string };

/** Boxes needed for a floor area, with an allowance for cuts and breakage (10% by default). */
export function tileBoxes(input: TileInput): TileResult {
  if (!(input.areaM2 > 0)) return { ok: false, reason: "Enter the floor size." };
  if (!(input.coverageM2PerBox > 0))
    return { ok: false, reason: "This item has no coverage per box set. Add it on the product." };
  const needed = input.areaM2 * (1 + (input.wastePercent ?? 10) / 100);
  // Round before ceil so floating-point noise (e.g. 3.0000000004) doesn't add a box.
  const boxes = Math.ceil(Math.round((needed / input.coverageM2PerBox) * 1000) / 1000);
  return { ok: true, boxes, coveredM2: Math.round(boxes * input.coverageM2PerBox * 100) / 100 };
}
