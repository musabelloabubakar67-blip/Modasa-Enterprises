"use client";

import { useState, useTransition } from "react";
import { reviewAdjustment } from "../../actions";

export function ReviewPanel({ id }: { id: string }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function review(approve: boolean) {
    if (!approve && !note.trim()) return setError("Say why you're rejecting it, so the staff member knows.");
    setError(null);
    startTransition(async () => {
      const result = await reviewAdjustment(id, approve, note);
      if (result.error) setError(result.error);
    });
  }

  return (
    <section className="card space-y-3 p-4">
      <h3 className="font-semibold">Review</h3>
      {error && (
        <p role="alert" className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <input
        className="input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (required if rejecting)"
        aria-label="Review note"
      />
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" disabled={pending} onClick={() => review(true)}>
          {pending ? "Working…" : "Approve and update stock"}
        </button>
        <button
          type="button"
          className="btn btn-secondary text-danger"
          disabled={pending}
          onClick={() => review(false)}
        >
          Reject
        </button>
      </div>
    </section>
  );
}
