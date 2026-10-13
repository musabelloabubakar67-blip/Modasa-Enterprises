import { requireStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { navFor } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/roles";
import { signOut } from "@/app/login/actions";
import { LogoMark } from "@/components/logo-mark";
import { NavLinks } from "./nav-links";
import { getNavBadges } from "./nav-badges";

export default async function StaffLayout({ children }: LayoutProps<"/app">) {
  const staff = await requireStaff();
  const business = await getBusinessSettings();
  const badges = await getNavBadges(staff);
  const items = navFor(staff.role).map((item) => ({ ...item, badge: badges[item.href] }));

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
              {staff.fullName} · {ROLE_LABELS[staff.role]}
              {staff.locationName ? ` · ${staff.locationName}` : ""}
            </p>
          </div>
          <form action={signOut} className="md:hidden">
            <button type="submit" className="text-muted hover:text-foreground text-sm">
              Sign out
            </button>
          </form>
        </div>
        <NavLinks items={items} />
        <form action={signOut} className="hidden px-4 py-4 md:block">
          <button type="submit" className="text-muted hover:text-foreground text-sm">
            Sign out
          </button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 print:p-0">{children}</main>
    </div>
  );
}
