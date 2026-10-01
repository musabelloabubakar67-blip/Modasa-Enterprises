import { requireStaff } from "@/lib/auth";
import { SectionTabs } from "@/components/section-tabs";

const TABS = [
  { href: "/app/sales", label: "Sales", exact: true },
  { href: "/app/sales/pending", label: "Collection & delivery" },
  { href: "/app/sales/shifts", label: "Till sessions" },
];

export default async function SalesLayout({ children }: LayoutProps<"/app/sales">) {
  await requireStaff(["owner", "manager", "cashier"]);
  return (
    <div className="max-w-5xl print:max-w-none">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold">Sales</h1>
        <SectionTabs tabs={TABS} />
      </div>
      <div className="mt-6 print:mt-0">{children}</div>
    </div>
  );
}
