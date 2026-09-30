"use client";

import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/form";
import { signIn } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={signIn} className="mt-6 space-y-4">
      {(state) => (
        <>
          <FormMessage state={state} />
          {next && <input type="hidden" name="next" value={next} />}
          <Field label="Email" name="email">
            <input id="email" name="email" type="email" className="input" autoComplete="email" required />
          </Field>
          <Field label="Password" name="password">
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              autoComplete="current-password"
              required
            />
          </Field>
          <SubmitButton pendingText="Signing in…" className="btn btn-primary w-full">
            Sign in
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
