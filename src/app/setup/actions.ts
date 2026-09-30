"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { needsSetup } from "@/lib/setup";
import { fieldErrorsFrom, formValues, type ActionState } from "@/lib/forms";

const schema = z.object({
  businessName: z.string({ error: "Enter the business name." }).max(120),
  fullName: z.string({ error: "Enter your name." }).max(120),
  email: z.email({ error: "Enter a valid email address." }),
  password: z.string({ error: "Choose a password." }).min(8, "Use at least 8 characters."),
});

export async function completeSetup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Setup can only ever run once: refuse if an owner already exists.
  if (!(await needsSetup())) redirect("/login");

  const parsed = schema.safeParse(formValues(formData));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const { businessName, fullName, email, password } = parsed.data;

  const admin = createAdminClient();

  const { error: settingsError } = await admin
    .from("business_settings")
    .update({ name: businessName, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (settingsError) return { error: settingsError.message };

  const { error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: "owner" },
  });
  if (userError) return { error: userError.message };

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { error: signInError.message };

  redirect("/app");
}
