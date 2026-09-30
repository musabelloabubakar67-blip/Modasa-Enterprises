"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import { initialActionState, type ActionState } from "@/lib/forms";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const PendingContext = createContext(false);

/**
 * Form bound to a server action. Unlike a plain `<form action>`, it keeps what the user typed
 * when the action returns an error, and only clears itself on success if `resetOnSuccess` is set.
 */
export function ActionForm({
  action,
  resetOnSuccess = false,
  className,
  children,
}: {
  action: ServerAction;
  resetOnSuccess?: boolean;
  className?: string;
  children: (state: ActionState) => React.ReactNode;
}) {
  const [state, dispatch, pending] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.success) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => dispatch(formData));
      }}
    >
      <PendingContext value={pending}>{children(state)}</PendingContext>
    </form>
  );
}

export function SubmitButton({
  children,
  pendingText = "Saving…",
  className = "btn btn-primary",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const pending = useContext(PendingContext);
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="bg-success/10 text-success rounded-md px-3 py-2 text-sm">
        {state.success}
      </p>
    );
  }
  return null;
}

export function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-muted mt-1 text-xs">{hint}</p>}
      {error && <p className="text-danger mt-1 text-xs">{error}</p>}
    </div>
  );
}
