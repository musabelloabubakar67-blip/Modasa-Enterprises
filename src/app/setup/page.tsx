import { redirect } from "next/navigation";
import { needsSetup } from "@/lib/setup";
import { SetupForm } from "./setup-form";

export default async function SetupPage() {
  if (!(await needsSetup())) redirect("/login");

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-xl font-semibold">Set up your business</h1>
        <p className="text-muted mt-1 text-sm">
          Create the owner account. You can add locations and staff once you&apos;re in.
        </p>
        <SetupForm />
      </div>
    </main>
  );
}
