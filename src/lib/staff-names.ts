import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Maps staff ids to names via the names-only directory (floor staff can't read full profiles). */
export async function getStaffNames(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Map<string, string>();
  const supabase = await createClient();
  const { data, error } = await supabase.from("staff_directory").select("id, full_name").in("id", unique);
  if (error) throw error;
  return new Map(data.map((s) => [s.id!, s.full_name!]));
}
