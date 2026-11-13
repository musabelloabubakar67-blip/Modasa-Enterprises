"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formValues, type ActionState } from "@/lib/forms";
import { logFailedSignIn } from "@/lib/security-log";

function safeNext(next: string | undefined) {
  // Only allow internal staff paths, never an external URL.
  return next && next.startsWith("/app") && !next.startsWith("//") ? next : "/app";
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { email, password, next } = formValues(formData);
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  // Signing in on a till that was locked or used with a PIN: the earlier sign-in is ended once this one works.
  const { data: previous } = await supabase.auth.getSession();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    await logFailedSignIn(email, "failed_sign_in");
    return { error: "Incorrect email or password." };
  }
  if (previous.session) await createAdminClient().auth.admin.signOut(previous.session.access_token, "local");

  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    await logFailedSignIn(email, "deactivated_sign_in");
    return { error: "This account has been deactivated. Ask the owner to reactivate it." };
  }

  redirect(safeNext(next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
