"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/forms";

const schema = z.object({
  id: z.uuid(),
  pct: z.coerce.number({ error: "Enter a percentage." }).min(0, "From 0 to 100.").max(100, "From 0 to 100."),
});

/** Sets how much discount one person may give. The database checks who may set whose (set_discount_limit). */
export async function saveDiscountLimit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(["owner", "manager"]);
  const parsed = schema.safeParse({ id: formData.get("id"), pct: formData.get("pct") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_discount_limit", { p_user: parsed.data.id, p_pct: parsed.data.pct });
  if (error) return { error: error.message };
  revalidatePath("/app/sales/discounts");
  return { success: "Saved." };
}
