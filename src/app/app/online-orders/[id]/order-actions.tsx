"use client";

import { useState, useTransition } from "react";
import { ActionForm, FormMessage, SubmitButton } from "@/components/form";
import type { ActionState } from "@/lib/forms";
import { cancelOrder, markRefunded, retryOrder } from "../actions";

export function RetryButton({ orderId }: { orderId: string }) {
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={() => startTransition(async () => setState(await retryOrder(orderId)))}
      >
        {pending ? "Checking…" : "Stock has arrived — create the sale"}
      </button>
      <FormMessage state={state} />
    </div>
  );
}

export function CancelForm({ orderId, paid }: { orderId: string; paid: boolean }) {
  return (
    <ActionForm action={cancelOrder} className="space-y-2">
      {(state) => (
        <>
          <FormMessage state={state} />
          <input type="hidden" name="id" value={orderId} />
          <label htmlFor="reason" className="label">
            Cancel this order
          </label>
          <input
            id="reason"
            name="reason"
            className="input"
            placeholder="Reason, e.g. customer changed their mind"
            required
          />
          <p className="text-muted text-xs">
            Releases the held stock.{paid && " The customer has paid, so you must refund them afterwards."}
          </p>
          <SubmitButton className="btn btn-secondary" pendingText="Cancelling…">
            Cancel order
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function RefundForm({ orderId }: { orderId: string }) {
  return (
    <ActionForm action={markRefunded} className="space-y-2">
      {(state) => (
        <>
          <FormMessage state={state} />
          <input type="hidden" name="id" value={orderId} />
          <label htmlFor="note" className="label">
            Record the refund
          </label>
          <input
            id="note"
            name="note"
            className="input"
            placeholder="How it was returned, e.g. Paystack refund"
            required
          />
          <p className="text-muted text-xs">
            Send the money back first (from the Paystack dashboard, or by bank transfer), then record it here.
          </p>
          <SubmitButton>Mark as refunded</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
