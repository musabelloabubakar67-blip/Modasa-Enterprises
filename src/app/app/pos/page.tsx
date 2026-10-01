import Link from "next/link";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getStaffNames } from "@/lib/staff-names";
import { createClient } from "@/lib/supabase/server";
import { getActiveLocations, isManager } from "../stock/data";
import { OpenTill } from "./open-till";
import { Till } from "./till";

export default async function PosPage({ searchParams }: PageProps<"/app/pos">) {
  const staff = await requireStaff(["owner", "manager", "cashier"]);
  const params = await searchParams;
  const shops = (await getActiveLocations()).filter((l) => l.kind === "shop");
  const manager = isManager(staff.role);

  // Cashiers use their own shop; managers pick one.
  const requested = z.uuid().safeParse(params.shop).data;
  const shop = manager
    ? (shops.find((s) => s.id === requested) ?? (shops.length === 1 ? shops[0] : undefined))
    : shops.find((s) => s.id === staff.locationId);

  if (!shop) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold">Point of sale</h1>
        {manager ? (
          <>
            <p className="text-muted text-sm">Which shop are you selling at?</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {shops.map((s) => (
                <Link key={s.id} href={`/app/pos?shop=${s.id}`} className="card hover:border-accent p-4 font-medium">
                  {s.name}
                </Link>
              ))}
            </div>
          </>
        ) : (
          <p className="card p-6 text-sm">You aren&apos;t assigned to a shop. Ask the owner to set your location.</p>
        )}
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: shift }, business] = await Promise.all([
    supabase
      .from("shifts")
      .select("id, opened_at, opened_by, opening_float_kobo")
      .eq("location_id", shop.id)
      .eq("status", "open")
      .maybeSingle(),
    getBusinessSettings(),
  ]);

  if (!shift) {
    return (
      <div className="max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">Open the till · {shop.name}</h1>
        <p className="text-muted text-sm">
          Count the cash in the drawer before the first sale. At the end of the day you&apos;ll count it again and the
          system will show whether it matches.
        </p>
        <OpenTill shopId={shop.id} currency={business.currency} />
        {manager && shops.length > 1 && (
          <Link href="/app/pos" className="text-muted text-sm hover:underline">
            Choose a different shop
          </Link>
        )}
      </div>
    );
  }

  const names = await getStaffNames([shift.opened_by]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted">
          <strong className="text-foreground">{shop.name}</strong> · till opened {formatDateTime(shift.opened_at)} by{" "}
          {(shift.opened_by && names.get(shift.opened_by)) ?? "—"} · float{" "}
          {formatMoney(shift.opening_float_kobo, business.currency)}
        </p>
        <div className="flex gap-2">
          <Link href={`/app/sales?shop=${shop.id}`} className="btn btn-secondary">
            Today&apos;s sales
          </Link>
          <Link href={`/app/pos/close?shop=${shop.id}`} className="btn btn-secondary">
            Close till
          </Link>
        </div>
      </div>
      <Till shop={{ id: shop.id, name: shop.name }} currency={business.currency} />
    </div>
  );
}
