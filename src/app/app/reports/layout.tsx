import { requireStaff } from "@/lib/auth";
import { SectionTabs } from "@/components/section-tabs";

const TABS = [
  { href: "/app/reports", label: "Sales", exact: true },
  { href: "/app/reports/products", label: "Products" },
  { href: "/app/reports/profit", label: "Profit" },
  { href: "/app/reports/staff", label: "Staff" },
  { href: "/app/reports/losses", label: "Stock losses" },
];

export default async function ReportsLayout({ children }: LayoutProps<"/app/reports">) {
  await requireStaff(["owner", "manager"]);
  return (
    <div className="max-w-6xl print:max-w-none">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <SectionTabs tabs={TABS} />
      </div>
      <div className="mt-6 space-y-6 print:mt-0">{children}</div>
    </div>
  );
}
