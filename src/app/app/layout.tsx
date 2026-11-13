import { requireStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { navFor } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/roles";
import { signOut } from "@/app/login/actions";
import { LogoMark } from "@/components/logo-mark";
import { SwitchCashierButton, TillIdleLock } from "@/components/till-idle-lock";
import Link from "next/link";
import { NavLinks } from "./nav-links";
import { getNavBadges } from "./nav-badges";

export default async function StaffLayout({ children }: LayoutProps<"/app">) {
  const staff = await requireStaff();
  const business = await getBusinessSettings();
  // Not awaited: the counts stream into the menu once ready, so the page doesn't wait for them.
  const badges = getNavBadges(staff);
  const items = navFor(staff.role);

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="border-border bg-surface border-b md:w-60 md:shrink-0 md:border-r md:border-b-0 print:hidden">
        <div className="flex items-start justify-between gap-2 px-4 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold">
              <LogoMark className="text-accent h-5 w-auto" />
              <span className="truncate">{business.name}</span>
            </p>
            <p className="text-muted truncate text-xs md:mt-1">
              {staff.fullName} · {ROLE_LABELS[staff.realRole]}
              {staff.tillOnly ? " (PIN)" : ""}
              {staff.locationName ? ` · ${staff.locationName}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 gap-3 md:hidden">
            {!staff.tillOnly && staff.role !== "warehouse" && (
              <Link href="/app/till-pin" className="text-muted hover:text-foreground text-sm">
                Till PIN
              </Link>
            )}
            <form action={signOut}>
              <button type="submit" className="text-muted hover:text-foreground text-sm">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <NavLinks items={items} badges={badges} />
        <div className="hidden space-y-2 px-4 py-4 md:block">
          {staff.tillOnly && staff.locationId && (
            <SwitchCashierButton locationId={staff.locationId} className="btn btn-secondary w-full" />
          )}
          {!staff.tillOnly && staff.role !== "warehouse" && (
            <Link href="/app/till-pin" className="text-muted hover:text-foreground block text-sm">
              Till PIN
            </Link>
          )}
          <form action={signOut}>
            <button type="submit" className="text-muted hover:text-foreground text-sm">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      {staff.tillOnly && staff.locationId && <TillIdleLock locationId={staff.locationId} />}
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 print:p-0">{children}</main>
    </div>
  );
}
