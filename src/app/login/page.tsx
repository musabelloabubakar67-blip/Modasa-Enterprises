import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { needsSetup } from "@/lib/setup";
import { LogoMark } from "@/components/logo-mark";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await needsSetup()) redirect("/setup");
  if (await getStaff()) redirect("/app");

  const { next } = await searchParams;
  const business = await getBusinessSettings();

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6 sm:p-8">
        <p className="text-accent flex items-center gap-2 text-sm font-medium">
          <LogoMark className="h-6 w-auto" />
          {business.name}
        </p>
        <h1 className="mt-1 text-xl font-semibold">Staff sign in</h1>
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </div>
    </main>
  );
}
