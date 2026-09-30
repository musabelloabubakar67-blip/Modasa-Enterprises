"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formValues, type ActionState } from "@/lib/forms";

function safeNext(next: string | undefined) {
  // Only allow internal staff paths, never an external URL.
  return next && next.startsWith("/app") && !next.startsWith("//") ? next : "/app";
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { email, password, next } = formValues(formData);
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Incorrect email or password." };

  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return { error: "This account has been deactivated. Ask the owner to reactivate it." };
  }

  redirect(safeNext(next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
