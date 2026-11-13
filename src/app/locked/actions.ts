"use server";

import { redirect } from "next/navigation";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getLockedTill, getStaff, requireStaff } from "@/lib/auth";
import { env } from "@/lib/env";
import { formValues, type ActionState } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function currentSessionId() {
  const { data } = await (await createClient()).auth.getClaims();
  const id = data?.claims.session_id;
  return typeof id === "string" ? id : null;
}

/** Locks the till at this shop: the screen goes back to the list of names. */
export async function lockTill(locationId: string) {
  const staff = await requireStaff(["owner", "manager", "cashier"]);
  const shop = z.uuid().safeParse(locationId).data;
  // Cashiers (and PIN sign-ins) lock at their own shop; managers at the shop they are selling at.
  const location = staff.role === "cashier" ? staff.locationId : shop;
  const sessionId = await currentSessionId();
  if (!location || !sessionId) redirect("/app/pos");

  const admin = createAdminClient();
  const { data: place } = await admin.from("locations").select("kind, is_active").eq("id", location).maybeSingle();
  if (place?.kind !== "shop" || !place.is_active) redirect("/app/pos");

  const { data: existing } = await admin.from("till_sessions").select("session_id").eq("session_id", sessionId);
  const now = new Date().toISOString();
  const { error } = existing?.length
    ? await admin.from("till_sessions").update({ locked_at: now }).eq("session_id", sessionId)
    : await admin
        .from("till_sessions")
        .insert({ session_id: sessionId, user_id: staff.id, location_id: location, locked_at: now });
  if (error) throw error;
  redirect("/locked");
}

const switchSchema = z.object({ user_id: z.uuid(), pin: z.string().regex(/^\d{4}$/) });

/**
 * Unlocks the till for whoever entered their PIN. The same person carries on in their own sign-in; anyone
 * else gets a new PIN sign-in (till only) and the previous one is signed out.
 */
export async function switchCashier(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locked = await getLockedTill();
  if (!locked) redirect((await getStaff()) ? "/app/pos" : "/login");
  const location = locked.locationId;
  if (!location) redirect("/login");

  const parsed = switchSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: "Enter your 4-digit PIN." };
  const { user_id: userId, pin } = parsed.data;

  const supabase = await createClient();
  const { data: result, error } = await supabase.rpc("till_pin_check", {
    p_user: userId,
    p_pin: pin,
    p_location: location,
  });
  if (error) return { error: "Couldn't check the PIN. Try again." };
  if (result === "wrong") return { error: "Wrong PIN. Try again." };
  if (result === "locked") {
    return { error: "Too many wrong PINs. Sign in with your email and password and set a new PIN." };
  }
  if (result === "no_pin") return { error: "No PIN set yet. Sign in with your email and password to set one." };
  if (result !== "ok") return { error: "You can't use the till at this shop." };

  const done = `/app/pos?shop=${location}`;
  const sessionId = await currentSessionId();
  const admin = createAdminClient();

  if (userId === locked.staff.id) {
    if (sessionId) await admin.from("till_sessions").update({ locked_at: null }).eq("session_id", sessionId);
    redirect(done);
  }

  // A sign-in for the new person without their password: a one-time sign-in token made with the service key
  // (nothing is emailed), exchanged straight away for a session.
  const { data: person } = await admin.from("profiles").select("email").eq("id", userId).single();
  if (!person) return { error: "Staff member not found." };
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: person.email,
  });
  if (linkError) return { error: "Couldn't switch. Try again." };

  const plain = createPlainClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: verified, error: verifyError } = await plain.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  const session = verified?.session;
  if (verifyError || !session) return { error: "Couldn't switch. Try again." };

  // Mark it till-only BEFORE the browser gets it; if that fails the new session is thrown away, so a PIN can
  // never give a full sign-in.
  const claims = JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url").toString()) as {
    session_id?: string;
  };
  const { error: markError } = claims.session_id
    ? await admin
        .from("till_sessions")
        .insert({ session_id: claims.session_id, user_id: userId, location_id: location, pin: true })
    : { error: new Error("no session id") };
  if (markError) {
    await admin.auth.admin.signOut(session.access_token, "local");
    return { error: "Couldn't switch. Try again." };
  }

  // Hand over: end the previous person's sign-in on this device, then sign the new person in.
  await supabase.auth.signOut({ scope: "local" });
  const { error: setError } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (setError) redirect("/login");
  redirect(done);
}
