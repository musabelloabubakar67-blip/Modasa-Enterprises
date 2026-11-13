"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { initialActionState } from "@/lib/forms";
import { ROLE_LABELS, type StaffRole } from "@/lib/roles";
import { switchCashier } from "./actions";

type Person = { id: string; name: string; role: StaffRole; hasPin: boolean; pinLocked: boolean };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export function LockScreen({ people, current }: { people: Person[]; current: string }) {
  const [chosen, setChosen] = useState<Person | null>(null);
  const [pin, setPin] = useState("");
  const [state, dispatch, pending] = useActionState(switchCashier, initialActionState);

  // The fourth digit sends the PIN straight away, like a card machine; the dots clear for a retry.
  const press = (key: string) => {
    if (pending || !chosen) return;
    if (key === "⌫" || key === "Backspace") return setPin(pin.slice(0, -1));
    if (!/^\d$/.test(key)) return;
    const next = pin + key;
    if (next.length < 4) return setPin(next);
    setPin("");
    const data = new FormData();
    data.set("user_id", chosen.id);
    data.set("pin", next);
    startTransition(() => dispatch(data));
  };

  // Typing on a keyboard works too.
  const pressRef = useRef(press);
  useEffect(() => {
    pressRef.current = press;
  });
  useEffect(() => {
    if (!chosen) return;
    const onKey = (e: KeyboardEvent) => (e.key === "Escape" ? setChosen(null) : pressRef.current(e.key));
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [chosen]);

  if (!chosen) {
    if (people.length === 0) return <p className="mt-6 text-sm">Nobody can use this till yet.</p>;
    return (
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {people.map((p) => {
          const usable = p.hasPin && !p.pinLocked;
          return (
            <button
              key={p.id}
              type="button"
              disabled={!usable}
              onClick={() => {
                setChosen(p);
                setPin("");
              }}
              className="card hover:border-accent p-4 text-left disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="block font-medium">{p.name}</span>
              <span className="text-muted block text-xs">
                {ROLE_LABELS[p.role]}
                {p.id === current && " · signed in"}
                {!p.hasPin && " · no PIN yet"}
                {p.pinLocked && " · PIN locked"}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mx-auto mt-6 max-w-xs">
      <p className="text-center font-medium">{chosen.name}</p>
      <div className="mt-3 flex justify-center gap-3" aria-label={`${pin.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full border-2 ${i < (pending ? 4 : pin.length) ? "border-accent bg-accent" : "border-border"}`}
          />
        ))}
      </div>
      <p role="alert" className="text-danger mt-3 min-h-5 text-center text-sm">
        {pending ? "" : state.error}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {KEYS.map((key, i) =>
          key ? (
            <button
              key={i}
              type="button"
              onClick={() => press(key)}
              disabled={pending}
              aria-label={key === "⌫" ? "Delete" : key}
              className="btn btn-secondary h-14 text-xl"
            >
              {key}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
      <button
        type="button"
        onClick={() => setChosen(null)}
        className="text-muted mt-4 w-full text-center text-sm hover:underline"
      >
        {pending ? "Checking…" : "← Not you?"}
      </button>
    </div>
  );
}
