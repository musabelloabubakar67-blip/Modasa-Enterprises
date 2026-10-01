import { requireStaff } from "@/lib/auth";
import { SectionTabs } from "@/components/section-tabs";

const TABS = [
  { href: "/app/settings", label: "Business", exact: true },
  { href: "/app/settings/locations", label: "Locations" },
  { href: "/app/settings/staff", label: "Staff" },
  { href: "/app/settings/website", label: "Website" },
];

export default async function SettingsLayout({ children }: LayoutProps<"/app/settings">) {
  await requireStaff(["owner"]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SectionTabs tabs={TABS} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
