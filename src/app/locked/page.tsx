import { redirect } from "next/navigation";
import { getLockedTill, getStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { LogoMark } from "@/components/logo-mark";
import { LockScreen } from "./lock-screen";

export const metadata = { title: "Till locked" };

export default async function LockedPage() {
  const locked = await getLockedTill();
  if (!locked) redirect((await getStaff()) ? "/app/pos" : "/login");
  if (!locked.locationId) redirect("/login");

  const supabase = await createClient();
  const [{ data: people }, { data: shop }, business] = await Promise.all([
    supabase.rpc("till_people", { p_location: locked.locationId }),
    supabase.from("locations").select("name").eq("id", locked.locationId).maybeSingle(),
    getBusinessSettings(),
  ]);

  return (
    <main className="flex flex-1 items-start justify-center p-4 sm:items-center">
      <div className="card w-full max-w-2xl p-6 sm:p-8">
        <p className="text-accent flex items-center gap-2 text-sm font-medium">
          <LogoMark className="h-6 w-auto" />
          {business.name}
          {shop ? ` · ${shop.name}` : ""}
        </p>
        <h1 className="mt-1 text-xl font-semibold">Who&apos;s selling?</h1>
        <p className="text-muted mt-1 text-sm">Tap your name and enter your PIN.</p>
        <LockScreen
          people={(people ?? []).map((p) => ({
            id: p.id,
            name: p.full_name,
            role: p.role,
            hasPin: p.has_pin,
            pinLocked: p.pin_locked,
          }))}
          current={locked.staff.id}
        />
        <div className="border-border text-muted mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-sm">
          <span>No PIN yet? Sign in with your email and password, then set one under Till PIN.</span>
          <form action={signOut}>
            <button type="submit" className="text-accent hover:underline">
              Sign in with email
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
