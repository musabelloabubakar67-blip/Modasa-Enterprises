import { requireStaff } from "@/lib/auth";
import { SectionTabs } from "@/components/section-tabs";

const TABS = [
  { href: "/app/sales", label: "Sales", exact: true },
  { href: "/app/sales/pending", label: "Collection & delivery" },
  { href: "/app/sales/shifts", label: "Till sessions" },
];

export default async function SalesLayout({ children }: LayoutProps<"/app/sales">) {
  const staff = await requireStaff(["owner", "manager", "cashier"]);
  const tabs = staff.role === "cashier" ? TABS : [...TABS, { href: "/app/sales/discounts", label: "Discount limits" }];
  return (
    <div className="max-w-5xl print:max-w-none">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold">Sales</h1>
        <SectionTabs tabs={tabs} />
      </div>
      <div className="mt-6 print:mt-0">{children}</div>
    </div>
  );
}
