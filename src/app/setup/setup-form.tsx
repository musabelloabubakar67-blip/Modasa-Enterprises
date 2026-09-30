"use client";

import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/form";
import { completeSetup } from "./actions";

export function SetupForm() {
  return (
    <ActionForm action={completeSetup} className="mt-6 space-y-4">
      {(state) => {
        const errors = state.fieldErrors ?? {};
        return (
          <>
            <FormMessage state={state} />
            <Field label="Business name" name="businessName" error={errors.businessName}>
              <input id="businessName" name="businessName" className="input" required />
            </Field>
            <Field label="Your full name" name="fullName" error={errors.fullName}>
              <input id="fullName" name="fullName" className="input" autoComplete="name" required />
            </Field>
            <Field label="Email" name="email" error={errors.email}>
              <input id="email" name="email" type="email" className="input" autoComplete="email" required />
            </Field>
            <Field label="Password" name="password" error={errors.password} hint="At least 8 characters.">
              <input
                id="password"
                name="password"
                type="password"
                className="input"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
            <SubmitButton pendingText="Setting up…">Create owner account</SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}
