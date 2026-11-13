"use client";

import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/form";
import { setTillPin } from "./actions";

const pinInput = {
  type: "password",
  inputMode: "numeric",
  pattern: "[0-9]{4}",
  maxLength: 4,
  autoComplete: "off",
  className: "input w-32 tracking-[0.5em]",
  required: true,
} as const;

export function PinForm() {
  return (
    <ActionForm action={setTillPin} resetOnSuccess className="mt-4 space-y-4">
      {(state) => (
        <>
          <FormMessage state={state} />
          <Field label="Your password" name="password">
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              autoComplete="current-password"
              required
            />
          </Field>
          <Field label="New PIN (4 digits)" name="pin">
            <input id="pin" name="pin" {...pinInput} />
          </Field>
          <Field label="PIN again" name="confirm">
            <input id="confirm" name="confirm" {...pinInput} />
          </Field>
          <SubmitButton>Save PIN</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
