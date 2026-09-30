import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import { needsSetup } from "@/lib/setup";

// The public storefront will live here later. For now the root routes staff to the right place.
export default async function Home() {
  if (await needsSetup()) redirect("/setup");
  redirect((await getStaff()) ? "/app" : "/login");
}
