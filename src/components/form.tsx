"use client";

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { initialActionState, type ActionState } from "@/lib/forms";

type ServerAction<S extends ActionState> = (prev: S, formData: FormData) => Promise<S>;

const PendingContext = createContext(false);
const noopSubscribe = () => () => {};

/**
 * Form bound to a server action. Unlike a plain `<form action>`, it keeps what the user typed
 * when the action returns an error, and only clears itself on success if `resetOnSuccess` is set.
 */
export function ActionForm<S extends ActionState = ActionState>({
  action,
  resetOnSuccess = false,
  className,
  children,
}: {
  action: ServerAction<S>;
  resetOnSuccess?: boolean;
  className?: string;
  children: (state: S) => React.ReactNode;
}) {
  // useActionState can't infer through the generic; the action really does return S.
  const [rawState, dispatch, pending] = useActionState(
    action as unknown as ServerAction<ActionState>,
    initialActionState,
  );
  const state = rawState as S;
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.success) formRef.current?.reset();
    // On long forms the problem may be off-screen: bring the first field error (or the message) into view.
    if (state.error) {
      const target =
        formRef.current?.querySelector("[data-field-error]") ?? formRef.current?.querySelector("[role=alert]");
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      className={className}
      // Never GET: if submitted before the page has loaded, fields must not end up in the URL.
      method="post"
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
  // Disabled until the page is interactive, which also blocks submitting with Enter before then.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return (
    <button type="submit" className={className} disabled={pending || !hydrated}>
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
      {error && (
        <p data-field-error className="text-danger mt-1 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
