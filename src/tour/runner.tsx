"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mascot } from "./mascot";
import { pace, scenes } from "./script";
import type { Step } from "./steps";
import { demoFile, ensureTourUser } from "./actions";

/**
 * Plays the demo tour (script.ts) on the real app: Mo talks in a speech bubble, a fake cursor clicks and
 * types, and a spotlight shows where to look. Start with ?tour=1 (or ?tour=1&scene=<id>) and Enter;
 * Space pauses, Esc stops. The current step is kept in sessionStorage, so the tour carries on across page
 * loads.
 */

const KEY = "modasa-tour";
type Saved = { index: number; running: boolean };
const STEPS: { scene: string; step: Step }[] = scenes.flatMap((s) => s.steps.map((step) => ({ scene: s.id, step })));

function load(): Saved | null {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}
function save(value: Saved | null) {
  try {
    if (value) sessionStorage.setItem(KEY, JSON.stringify(value));
    else sessionStorage.removeItem(KEY);
  } catch {}
}

class Stopped extends Error {}

type Rect = { x: number; y: number; w: number; h: number };
const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};
const visible = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";

/** The element for a target, narrowed by `match`; null if it isn't on the page (yet). */
function locate(target: string, match?: string): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)].filter(visible);
  if (!match) return all[0] ?? null;
  const wanted = match.toLowerCase();
  const own = all.find((el) => el.textContent?.toLowerCase().includes(wanted));
  // Prefer the smallest clickable thing inside with those words, e.g. one result in a list.
  const inner = all
    .flatMap((el) => [...el.querySelectorAll<HTMLElement>("button, a, [role=option], li, tr, label")])
    .filter((el) => visible(el) && el.textContent?.toLowerCase().includes(wanted))
    // Shortest text first; on a tie, the link or button rather than the row around it.
    .sort(
      (a, b) =>
        (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0) ||
        Number(!a.matches("a, button")) - Number(!b.matches("a, button")),
    );
  return inner[0] ?? own ?? null;
}

/** Sets a field's value the way typing does, so React sees the change. */
function setValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

export default function TourRunner() {
  const router = useRouter();
  const [phase, setPhase] = useState<"off" | "ready" | "running" | "paused">("off");
  const [line, setLine] = useState("");
  const [shown, setShown] = useState(0);
  const [talking, setTalking] = useState(false);
  const [waving, setWaving] = useState(false);
  const [spot, setSpot] = useState<Rect | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number; pressed: boolean } | null>(null);
  const [side, setSide] = useState<"left" | "right">("left");
  const [problem, setProblem] = useState<string | null>(null);

  const paused = useRef(false);
  const stopped = useRef(false);
  const spotEl = useRef<HTMLElement | null>(null);
  const runId = useRef(0);
  const sideRef = useRef<"left" | "right">("left");

  // ---------- Timing that respects pause and stop ----------
  async function sleep(ms: number, id: number) {
    let left = ms;
    while (left > 0) {
      if (stopped.current || id !== runId.current) throw new Stopped();
      await new Promise((r) => setTimeout(r, 40));
      if (!paused.current) left -= 40;
    }
  }

  async function find(target: string, match: string | undefined, id: number) {
    for (let waited = 0; waited < 15000; waited += 150) {
      const el = locate(target, match);
      if (el) return el;
      await sleep(150, id);
    }
    throw new Error(`Can't find "${target}"${match ? ` with "${match}"` : ""} on this page.`);
  }

  /** Keeps Mo and the bubble out of the way of what is being shown. */
  function avoid(el: HTMLElement) {
    const r = rectOf(el);
    const zoneTop = window.innerHeight - 260;
    const overlapsLeft = r.y + r.h > zoneTop && r.x < 620;
    const overlapsRight = r.y + r.h > zoneTop && r.x + r.w > window.innerWidth - 620;
    const next =
      sideRef.current === "left" && overlapsLeft && !overlapsRight
        ? "right"
        : sideRef.current === "right" && overlapsRight && !overlapsLeft
          ? "left"
          : sideRef.current;
    sideRef.current = next;
    setSide(next);
  }

  async function moveCursorTo(el: HTMLElement, id: number) {
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    await sleep(450, id);
    avoid(el);
    const r = rectOf(el);
    setCursor({ x: r.x + Math.min(r.w / 2, 60), y: r.y + r.h / 2, pressed: false });
    await sleep(pace.cursorMs, id);
  }

  async function runStep(step: Step, index: number, id: number) {
    switch (step.kind) {
      case "say": {
        if (step.spotlight) {
          const found = await find(step.spotlight, step.match, id);
          // Narrowed to one entry: light up its whole row, not just the words.
          const el = step.match ? (found.closest<HTMLElement>("tr, li") ?? found) : found;
          el.scrollIntoView({ block: "center", behavior: "smooth" });
          await sleep(350, id);
          avoid(el);
          spotEl.current = el;
          // Don't let the cursor sit on top of what Mo is pointing at.
          const r = rectOf(el);
          setCursor((c) =>
            c && c.x > r.x - 30 && c.x < r.x + r.w + 30 && c.y > r.y - 40 && c.y < r.y + r.h + 30
              ? { ...c, x: Math.min(r.x + r.w + 24, window.innerWidth - 40), y: r.y + r.h / 2 }
              : c,
          );
        } else spotEl.current = null;
        setLine(step.text);
        setShown(0);
        setTalking(true);
        for (let i = 1; i <= step.text.length; i++) {
          setShown(i);
          await sleep(1000 / pace.charsPerSecond, id);
        }
        setTalking(false);
        await sleep(step.hold ?? Math.max(pace.minReadMs, step.text.length * pace.readMsPerChar), id);
        spotEl.current = null;
        return;
      }
      case "click": {
        const found = await find(step.target, step.match, id);
        // A row or card with one link or button in it: click that.
        const el = found.matches("a, button, input, select, textarea, [role]")
          ? found
          : (found.querySelector<HTMLElement>("a, button") ?? found);
        await moveCursorTo(el, id);
        setCursor((c) => c && { ...c, pressed: true });
        await sleep(140, id);
        save({ index: index + 1, running: true }); // a click may reload the page: don't repeat it
        for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
          el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
        }
        el.focus({ preventScroll: true });
        el.click();
        setCursor((c) => c && { ...c, pressed: false });
        await sleep(pace.afterActionMs, id);
        return;
      }
      case "type": {
        const el = (await find(step.target, step.match, id)) as HTMLInputElement;
        await moveCursorTo(el, id);
        el.focus({ preventScroll: true });
        // Built from what's been typed, not the field's current value: some fields put a 0 back when emptied.
        const start = step.clear ? "" : el.value;
        if (step.clear) setValue(el, "");
        let typed = "";
        for (const ch of step.text) {
          typed += ch;
          setValue(el, start + typed);
          await sleep(pace.typingMs, id);
        }
        await sleep(pace.afterActionMs, id);
        return;
      }
      case "choose": {
        const el = (await find(step.target, undefined, id)) as HTMLSelectElement;
        await moveCursorTo(el, id);
        const option =
          [...el.options].find((o) => o.text.trim() === step.option || o.value === step.option) ??
          [...el.options].find((o) => o.text.trim().startsWith(step.option));
        if (!option) throw new Error(`"${step.target}" has no option "${step.option}".`);
        setValue(el, option.value);
        await sleep(pace.afterActionMs, id);
        return;
      }
      case "press": {
        const el = (await find(step.target, undefined, id)) as HTMLInputElement;
        const event = new KeyboardEvent("keydown", { key: step.key, bubbles: true, cancelable: true });
        save({ index: index + 1, running: true });
        el.dispatchEvent(event);
        if (step.key === "Enter" && !event.defaultPrevented) el.form?.requestSubmit();
        await sleep(pace.afterActionMs, id);
        return;
      }
      case "goto":
        save({ index: index + 1, running: true });
        router.push(step.path);
        await sleep(600, id);
        return;
      case "wait":
        await sleep(step.ms, id);
        return;
      case "waitFor":
        await find(step.target, step.match, id);
        return;
      case "wave":
        setWaving(true);
        await sleep(2100, id);
        setWaving(false);
        return;
      case "when": {
        let present = false;
        for (let waited = 0; waited < 2000 && !present; waited += 150) {
          present = !!locate(step.target);
          if (!present) await sleep(150, id);
        }
        if (present) for (const sub of step.steps) await runStep(sub, index, id);
        return;
      }
      case "upload": {
        const el = await find(step.target, undefined, id);
        const input =
          el instanceof HTMLInputElement && el.type === "file"
            ? el
            : el.querySelector<HTMLInputElement>('input[type="file"]');
        if (!input) throw new Error(`"${step.target}" has no file picker.`);
        await moveCursorTo(el, id);
        setCursor((c) => c && { ...c, pressed: true });
        const file = await demoFile(step.file);
        if (!file) throw new Error(`The demo file "${step.file}" isn't available.`);
        const bytes = Uint8Array.from(atob(file.base64), (ch) => ch.charCodeAt(0));
        const transfer = new DataTransfer();
        transfer.items.add(new File([bytes], file.name, { type: file.type }));
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        setCursor((c) => c && { ...c, pressed: false });
        await sleep(pace.afterActionMs, id);
        return;
      }
      case "typeFrom": {
        const source = await find(step.source, undefined, id);
        const shown = Number((source.textContent ?? "").replace(/[^\d.]/g, ""));
        if (!Number.isFinite(shown)) throw new Error(`"${step.source}" doesn't show an amount.`);
        const amount = Math.round((shown + (step.adjust ?? 0)) * 100) / 100;
        await runStep({ kind: "type", target: step.target, text: String(amount), clear: true }, index, id);
        return;
      }
      case "signInAs": {
        const result = await ensureTourUser(step.who);
        if (result.error) throw new Error(result.error);
        if (result.changed) {
          save({ index: index + 1, running: true });
          window.location.replace(window.location.pathname); // fresh page as the new person
          throw new Stopped();
        }
        return;
      }
    }
  }

  async function run(from: number) {
    const id = ++runId.current;
    stopped.current = false;
    paused.current = false;
    setProblem(null);
    setPhase("running");
    try {
      for (let i = from; i < STEPS.length; i++) {
        save({ index: i, running: true });
        document.documentElement.dataset.tourScene = STEPS[i].scene; // for checking a recording setup
        await runStep(STEPS[i].step, i, id);
      }
      save(null);
      document.documentElement.dataset.tourScene = "done";
      setPhase("off");
    } catch (e) {
      if (e instanceof Stopped) return;
      paused.current = true;
      setPhase("paused");
      setProblem(e instanceof Error ? e.message : String(e));
      document.documentElement.dataset.tourProblem = e instanceof Error ? e.message : String(e);
    }
  }

  // Keep the spotlight on its element as the page scrolls or changes.
  useEffect(() => {
    let frame = 0;
    const track = () => {
      const el = spotEl.current;
      const next = el && el.isConnected ? rectOf(el) : null;
      setSpot((prev) =>
        prev && next && Math.abs(prev.x - next.x) + Math.abs(prev.y - next.y) + Math.abs(prev.w - next.w) < 1
          ? prev
          : next,
      );
      frame = requestAnimationFrame(track);
    };
    frame = requestAnimationFrame(track);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Start-up: ?tour=1 gets it ready; a tour already under way carries on after a page load.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let startAt: number | null = null;
    if (params.get("tour") === "1") {
      const sceneId = params.get("scene");
      const first = sceneId ? STEPS.findIndex((s) => s.scene === sceneId) : 0;
      save({ index: Math.max(first, 0), running: false });
      params.delete("tour");
      params.delete("scene");
      const rest = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
    }
    const saved = load();
    if (saved?.running) startAt = saved.index;
    const timer = setTimeout(() => {
      if (startAt !== null) void run(startAt);
      else if (saved) setPhase("ready");
    }, 700);
    return () => clearTimeout(timer);
    // run() is stable enough for start-up; the tour never restarts from a re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keys for whoever is recording.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === "off") return;
      if (e.key === "Enter" && phase === "ready") {
        e.preventDefault();
        void run(load()?.index ?? 0);
      } else if (e.key === " " && (phase === "running" || phase === "paused")) {
        e.preventDefault();
        e.stopPropagation();
        if (problem) return;
        paused.current = !paused.current;
        setPhase(paused.current ? "paused" : "running");
      } else if (e.key === "Escape") {
        e.stopPropagation();
        stopped.current = true;
        spotEl.current = null;
        save(null);
        setPhase("off");
        setCursor(null);
      } else return;
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  });

  // While the tour runs, "Are you sure?" questions are answered yes so it doesn't stall, and Print does nothing.
  useEffect(() => {
    if (phase !== "running" && phase !== "paused") return;
    // Printing would open the browser's print dialog over the recording and freeze the tour.
    const original = { confirm: window.confirm, print: window.print };
    window.confirm = () => true;
    window.print = () => {};
    return () => {
      window.confirm = original.confirm;
      window.print = original.print;
    };
  }, [phase]);

  if (phase === "off") return null;

  if (phase === "ready") {
    return (
      <div className="fixed top-3 left-1/2 z-[10000] -translate-x-1/2 rounded-full bg-[#16335f] px-4 py-2 text-sm text-white shadow-lg">
        Demo tour ready · <b>Enter</b> start · <b>Space</b> pause · <b>Esc</b> stop
      </div>
    );
  }

  const PAD = 8;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9998]">
      {spot && (
        <div
          className="absolute rounded-xl transition-all duration-500 ease-out"
          style={{
            left: spot.x - PAD,
            top: spot.y - PAD,
            width: spot.w + PAD * 2,
            height: spot.h + PAD * 2,
            boxShadow: "0 0 0 4px rgba(255,255,255,.9), 0 0 0 9999px rgba(18,24,38,.5)",
          }}
        />
      )}

      <div
        className="absolute bottom-4 flex items-end gap-3 transition-all duration-700 ease-in-out"
        style={side === "left" ? { left: 16 } : { right: 16, flexDirection: "row-reverse" }}
      >
        <Mascot talking={talking} waving={waving} />
        {line && (
          <div className="relative mb-24 max-w-[440px] rounded-2xl border border-[#e4e1da] bg-white px-5 py-4 text-[19px] leading-snug text-[#1c1b19] shadow-[0_12px_32px_rgba(22,51,95,.18)]">
            <span className="mb-1 block text-xs font-semibold tracking-wide text-[#1d4fa3] uppercase">Mo</span>
            {line.slice(0, shown)}
            {/* Reserve the full line's space so the bubble doesn't grow as the words appear. */}
            <span className="invisible">{line.slice(shown)}</span>
            <span
              className="absolute bottom-5 h-4 w-4 rotate-45 border-[#e4e1da] bg-white"
              style={
                side === "left"
                  ? { left: -8, borderLeftWidth: 1, borderBottomWidth: 1 }
                  : { right: -8, borderRightWidth: 1, borderTopWidth: 1 }
              }
            />
          </div>
        )}
      </div>

      {cursor && (
        <div
          className="absolute top-0 left-0 transition-transform ease-in-out"
          style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)`, transitionDuration: `${pace.cursorMs}ms` }}
        >
          {cursor.pressed && (
            <span className="absolute -top-4 -left-4 h-8 w-8 animate-ping rounded-full bg-[#1d4fa3]/40" />
          )}
          <svg
            width="26"
            height="30"
            viewBox="0 0 26 30"
            style={{ transform: cursor.pressed ? "scale(.85)" : "none", transition: "transform .12s" }}
          >
            <path
              d="M2 2 L2 24 L8 18.5 L12.5 28 L16.5 26.2 L12 17 L20 17 Z"
              fill="#1c1b19"
              stroke="#fff"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      {phase === "paused" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#16335f] px-4 py-2 text-sm text-white shadow-lg">
          {problem ? `Tour stopped: ${problem} Press Esc.` : "Paused · Space to carry on"}
        </div>
      )}
    </div>
  );
}
