"use client";

import { useState, useTransition } from "react";
import { updateFulfilment } from "./actions";

export function FulfilmentButtons({
  saleId,
  fulfilment,
  status,
}: {
  saleId: string;
  fulfilment: "taken" | "collect_later" | "delivery";
  status: "pending" | "out_for_delivery" | "completed";
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (fulfilment === "taken") return null;

  const update = (next: typeof status, question: string) => {
    if (!confirm(question)) return;
    setError(null);
    startTransition(async () => {
      const result = await updateFulfilment(saleId, next);
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {fulfilment === "delivery" && status === "pending" && (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending}
          onClick={() => update("out_for_delivery", "Mark as out for delivery?")}
        >
          Out for delivery
        </button>
      )}
      {status !== "completed" && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending}
          onClick={() =>
            update(
              "completed",
              fulfilment === "delivery"
                ? "Confirm the customer has received it?"
                : "Confirm the customer has collected it?",
            )
          }
        >
          {fulfilment === "delivery" ? "Delivered" : "Collected"}
        </button>
      )}
      {status === "completed" && (
        <button
          type="button"
          className="text-muted text-xs hover:underline"
          disabled={pending}
          onClick={() => update("pending", "Undo — mark as not yet handed over?")}
        >
          Undo handover
        </button>
      )}
      {error && <p className="text-danger text-xs">{error}</p>}
    </div>
  );
}
