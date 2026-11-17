/**
 * The building blocks of the demo tour script (script.ts). Each function returns one step; the runner plays
 * them in order. A target is the name in a `data-tour="…"` attribute on the page; `match` narrows it to the
 * one whose text contains those words (or to a button or link inside it with those words).
 */

export type Target = string;
type Match = { match?: string };

export type Step =
  | { kind: "say"; text: string; spotlight?: Target; match?: string; hold?: number }
  | { kind: "click"; target: Target; match?: string }
  | { kind: "type"; target: Target; text: string; match?: string; clear?: boolean }
  | { kind: "choose"; target: Target; option: string }
  | { kind: "press"; target: Target; key: string }
  | { kind: "goto"; path: string }
  | { kind: "wait"; ms: number }
  | { kind: "waitFor"; target: Target; match?: string }
  | { kind: "wave" }
  | { kind: "signInAs"; who: string };

export type Scene = { id: string; title: string; steps: Step[] };

/** Mo says a line. `spotlight` highlights that part of the screen while the line is up. */
export const say = (text: string, opts: { spotlight?: Target; hold?: number } & Match = {}): Step => ({
  kind: "say",
  text,
  ...opts,
});
/** The cursor moves to it and clicks. */
export const click = (target: Target, opts: Match = {}): Step => ({ kind: "click", target, ...opts });
/** Types into a field, letter by letter. `clear` empties it first. */
export const type = (target: Target, text: string, opts: Match & { clear?: boolean } = {}): Step => ({
  kind: "type",
  target,
  text,
  ...opts,
});
/** Picks an option in a dropdown, by its label. */
export const choose = (target: Target, option: string): Step => ({ kind: "choose", target, option });
/** Presses a key in a field (Enter also sends the form). */
export const press = (target: Target, key = "Enter"): Step => ({ kind: "press", target, key });
/** Opens a page of the app. */
export const goto = (path: string): Step => ({ kind: "goto", path });
/** Pauses for a moment. */
export const wait = (ms: number): Step => ({ kind: "wait", ms });
/** Waits until something appears (pages and results that take a moment). */
export const waitFor = (target: Target, opts: Match = {}): Step => ({ kind: "waitFor", target, ...opts });
/** Mo waves. */
export const wave = (): Step => ({ kind: "wave" });
/** Off camera: makes sure this demo person is signed in (by password; reloads the page if it changes). */
export const signInAs = (who: string): Step => ({ kind: "signInAs", who });

export const scene = (id: string, title: string, steps: Step[]): Scene => ({ id, title, steps });

export type Pace = {
  /** How fast Mo's words appear. */
  charsPerSecond: number;
  /** Reading time after a line has appeared: at least minReadMs, plus readMsPerChar for each letter. */
  minReadMs: number;
  readMsPerChar: number;
  /** How long the cursor takes to glide to its target. */
  cursorMs: number;
  /** Delay between typed letters. */
  typingMs: number;
  /** Pause after each click or typed field, so the screen can settle. */
  afterActionMs: number;
};
