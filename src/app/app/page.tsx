import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { navFor } from "@/lib/nav";

export default async function StaffHome({ searchParams }: PageProps<"/app">) {
  const staff = await requireStaff();
  const { denied } = await searchParams;
  const sections = navFor(staff.role).filter((item) => item.href !== "/app");

  return (
    <div className="max-w-4xl">
      {denied && (
        <p role="alert" className="bg-danger/10 text-danger mb-4 rounded-md px-3 py-2 text-sm">
          You don&apos;t have access to that page.
        </p>
      )}
      <h1 className="text-2xl font-semibold">Welcome, {staff.fullName.split(" ")[0]}</h1>
      <p className="text-muted mt-1 text-sm">
        {staff.locationName ? `You're working at ${staff.locationName}.` : "You have access to all locations."}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {sections.map((item) =>
          item.soon ? (
            <div key={item.href} className="card text-muted p-4">
              <p className="font-medium">{item.label}</p>
              <p className="mt-1 text-sm">Coming in the next build step.</p>
            </div>
          ) : (
            <Link key={item.href} href={item.href} className="card hover:border-accent p-4">
              <p className="font-medium">{item.label}</p>
            </Link>
          ),
        )}
      </div>
    </div>
  );
}
