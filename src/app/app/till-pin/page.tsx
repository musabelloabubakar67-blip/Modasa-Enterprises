import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TILL_IDLE_MINUTES } from "@/components/till-idle-lock";
import { PinForm } from "./pin-form";

export const metadata = { title: "My till PIN" };

export default async function TillPinPage() {
  const staff = await requireStaff(["owner", "manager", "cashier"]);
  const supabase = await createClient();
  // Managers and the owner are listed at every shop, so any id finds them; a cashier needs their own shop.
  const { data: me } = await supabase.rpc("till_people", {
    p_location: staff.locationId ?? "00000000-0000-0000-0000-000000000000",
  });
  const mine = me?.find((p) => p.id === staff.id);

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">My till PIN</h1>
      <div className="card text-muted space-y-2 p-6 text-sm">
        <p>
          When several people share a till, tap <strong className="text-foreground">Switch cashier</strong>, then your
          name and this PIN. Your sales are recorded under your name. The till also locks itself after{" "}
          {TILL_IDLE_MINUTES} minutes without use.
        </p>
        <p>
          A PIN only opens the till. For anything else, sign in with your email and password. Keep your PIN to yourself:
          whoever knows it can sell under your name.
        </p>
      </div>
      <div className="card p-6">
        <h2 className="font-semibold">
          {mine?.pin_locked ? "Your PIN is locked: set a new one" : mine?.has_pin ? "Change your PIN" : "Set your PIN"}
        </h2>
        {staff.tillOnly ? (
          <p className="text-muted mt-2 text-sm">Sign in with your email and password to set or change your PIN.</p>
        ) : (
          <PinForm />
        )}
      </div>
    </div>
  );
}
