import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SectionTabs } from "@/components/section-tabs";
import { isManager } from "./data";

export default async function StockLayout({ children }: LayoutProps<"/app/stock">) {
  const staff = await requireStaff();
  const manager = isManager(staff.role);

  // Show managers how many adjustments are waiting for them.
  let pending = 0;
  if (manager) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("adjustments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    pending = count ?? 0;
  }

  const tabs = [
    { href: "/app/stock", label: "Overview", exact: true },
    ...(manager || staff.role === "warehouse" ? [{ href: "/app/stock/deliveries", label: "Deliveries" }] : []),
    { href: "/app/stock/adjustments", label: pending ? `Adjustments (${pending})` : "Adjustments" },
    { href: "/app/stock/history", label: "History" },
    ...(manager || staff.role === "warehouse" ? [{ href: "/app/stock/labels", label: "Labels" }] : []),
  ];

  return (
    <div className="max-w-6xl print:max-w-none">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold">Stock</h1>
        <SectionTabs tabs={tabs} />
      </div>
      <div className="mt-6 print:mt-0">{children}</div>
    </div>
  );
}
