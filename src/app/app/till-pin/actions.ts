"use server";

import { createClient as createPlainClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { env } from "@/lib/env";
import { fieldErrorsFrom, formValues, type ActionState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const pinSchema = z
  .object({
    password: z.string({ error: "Enter your password." }),
    pin: z.string({ error: "Enter 4 digits." }).regex(/^\d{4}$/, "Enter 4 digits."),
    confirm: z.string({ error: "Enter the PIN again." }),
  })
  .refine((v) => v.pin === v.confirm, { path: ["confirm"], message: "The two PINs don't match." });

export async function setTillPin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff(["owner", "manager", "cashier"]);
  if (staff.tillOnly) return { error: "Sign in with your email and password to change your PIN." };
  const parsed = pinSchema.safeParse(formValues(formData));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);

  // The password again, so nobody can set a PIN on a sign-in someone walked away from.
  const check = createPlainClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: passwordError } = await check.auth.signInWithPassword({
    email: staff.email,
    password: parsed.data.password,
  });
  if (passwordError) return { error: "Incorrect password.", fieldErrors: { password: "Incorrect password." } };
  await check.auth.signOut({ scope: "local" }); // that check's own sign-in isn't needed

  const { error } = await (await createClient()).rpc("set_till_pin", { p_pin: parsed.data.pin });
  if (error) return { error: error.message, fieldErrors: { pin: error.message } };
  return { success: "PIN saved. Use it to switch in at the till." };
}
