"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fieldErrorsFrom, formValues, type ActionState } from "@/lib/forms";
import { parseMoney } from "@/lib/money";
import { LOCATION_KINDS, STAFF_ROLES, roleNeedsLocation } from "@/lib/roles";

const optionalText = (max: number) => z.string().max(max).optional();

// ---------- Business ----------

const businessSchema = z.object({
  name: z.string({ error: "Enter the business name." }).max(120),
  legal_name: optionalText(160),
  phone: optionalText(40),
  email: z.email({ error: "Enter a valid email address." }).optional(),
  address: optionalText(300),
  currency: z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. NGN."),
  receipt_footer: optionalText(500),
  vat_enabled: z.enum(["on"]).optional(),
  vat_rate: z.coerce
    .number({ error: "Enter a rate, e.g. 7.5." })
    .min(0, "Enter a rate between 0 and 99.")
    .max(99, "Enter a rate between 0 and 99.")
    .default(7.5),
  vat_number: optionalText(40),
});

export async function updateBusiness(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(["owner"]);
  const parsed = businessSchema.safeParse(formValues(formData));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("business_settings")
    .update({
      name: v.name,
      legal_name: v.legal_name ?? null,
      phone: v.phone ?? null,
      email: v.email ?? null,
      address: v.address ?? null,
      currency: v.currency,
      receipt_footer: v.receipt_footer ?? null,
      vat_enabled: v.vat_enabled === "on",
      vat_rate: v.vat_rate,
      vat_number: v.vat_number ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: "Business details saved." };
}

// ---------- Locations ----------

const locationSchema = z.object({
  id: z.uuid().optional(),
  name: z.string({ error: "Enter a name." }).max(80),
  code: z
    .string({ error: "Enter a short code." })
    .transform((s) => s.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9-]{2,10}$/, "2–10 letters, numbers or dashes, e.g. SH1.")),
  kind: z.enum(LOCATION_KINDS, { error: "Choose shop or warehouse." }),
  address: optionalText(300),
  phone: optionalText(40),
  public_name: optionalText(60),
  is_active: z.enum(["on"]).optional(),
});

export async function saveLocation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(["owner"]);
  const parsed = locationSchema.safeParse(formValues(formData));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const { id, is_active, ...v } = parsed.data;

  const row = { ...v, address: v.address ?? null, phone: v.phone ?? null, public_name: v.public_name ?? null };
  const supabase = await createClient();
  const { error } = id
    ? await supabase
        .from("locations")
        .update({ ...row, is_active: is_active === "on" })
        .eq("id", id)
    : await supabase.from("locations").insert(row);

  if (error) {
    if (error.code === "23505")
      return { error: "Another location already uses that code.", fieldErrors: { code: "Already in use." } };
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: id ? "Location updated." : "Location added." };
}

// ---------- Staff ----------

const staffSchema = z
  .object({
    id: z.uuid().optional(),
    full_name: z.string({ error: "Enter a name." }).max(120),
    email: z.email({ error: "Enter a valid email address." }).optional(),
    phone: optionalText(40),
    role: z.enum(STAFF_ROLES, { error: "Choose a role." }),
    location_id: z.uuid().optional(),
    password: z.string().min(8, "Use at least 8 characters.").optional(),
    is_active: z.enum(["on"]).optional(),
  })
  .refine((v) => !roleNeedsLocation(v.role) || v.location_id, {
    path: ["location_id"],
    message: "Cashiers and warehouse staff need a location.",
  })
  .refine((v) => v.id || v.email, { path: ["email"], message: "Enter an email address." })
  .refine((v) => v.id || v.password, { path: ["password"], message: "Set a starting password." });

export async function saveStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireStaff(["owner"]);
  const parsed = staffSchema.safeParse(formValues(formData));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const v = parsed.data;

  // Owners and managers may optionally have a home location; floor staff must, of the right kind.
  const locationId = v.location_id ?? null;
  if (locationId && roleNeedsLocation(v.role)) {
    const { data: location } = await createAdminClient().from("locations").select("kind").eq("id", locationId).single();
    const expected = v.role === "cashier" ? "shop" : "warehouse";
    if (location?.kind !== expected) {
      return {
        error: `A ${v.role} must be assigned to a ${expected}.`,
        fieldErrors: { location_id: `Choose a ${expected}.` },
      };
    }
  }

  if (!v.id) {
    // Creating a login requires the service role; the caller is verified as owner above.
    const { error } = await createAdminClient().auth.admin.createUser({
      email: v.email!,
      password: v.password!,
      email_confirm: true,
      user_metadata: { full_name: v.full_name, phone: v.phone, role: v.role, location_id: locationId },
    });
    if (error) {
      const taken = /already.*registered|already exists/i.test(error.message);
      return taken
        ? { error: "A staff member with that email already exists.", fieldErrors: { email: "Already in use." } }
        : { error: error.message };
    }
    revalidatePath("/app/settings/staff");
    return { success: `${v.full_name} can now sign in with ${v.email}.` };
  }

  const isSelf = v.id === owner.id;
  if (isSelf && (v.role !== "owner" || v.is_active !== "on")) {
    return { error: "You can't remove your own owner access or deactivate yourself." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: v.full_name,
      phone: v.phone ?? null,
      role: v.role,
      location_id: locationId,
      is_active: v.is_active === "on",
    })
    .eq("id", v.id);
  if (error) return { error: error.message };

  if (v.password) {
    const { error: pwError } = await createAdminClient().auth.admin.updateUserById(v.id, { password: v.password });
    if (pwError) return { error: pwError.message };
  }

  revalidatePath("/app", "layout");
  return { success: "Staff member updated." };
}

// ---------- Website ----------

const websiteSchema = z.object({
  storefront_enabled: z.enum(["on"]).optional(),
  storefront_name: optionalText(40),
  tagline: optionalText(120),
  hero_title: optionalText(80),
  hero_text: optionalText(200),
  whatsapp_number: z
    .string()
    .regex(/^[+\d\s-]{7,20}$/, "Enter a phone number, e.g. 0803 000 0000.")
    .optional(),
  opening_hours: optionalText(120),
  order_lead_time: z.string({ error: "Say how long, e.g. 2–3 days." }).max(40),
  order_hold_minutes: z.coerce
    .number({ error: "Enter a number of minutes." })
    .int("Whole minutes only.")
    .min(5, "Between 5 and 120 minutes.")
    .max(120, "Between 5 and 120 minutes."),
});

export async function updateWebsite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(["owner"]);
  const parsed = websiteSchema.safeParse(formValues(formData));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("business_settings")
    .update({
      storefront_enabled: v.storefront_enabled === "on",
      storefront_name: v.storefront_name ?? null,
      tagline: v.tagline ?? null,
      hero_title: v.hero_title ?? null,
      hero_text: v.hero_text ?? null,
      whatsapp_number: v.whatsapp_number ?? null,
      opening_hours: v.opening_hours ?? null,
      order_lead_time: v.order_lead_time,
      order_hold_minutes: v.order_hold_minutes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: "Website settings saved." };
}

/** Sets (or clears) the photo behind the home page headline, after it has been uploaded. */
export async function setHeroImage(path: string | null): Promise<ActionState> {
  await requireStaff(["owner"]);
  if (path !== null && !/^site\/[\w-]+\.webp$/.test(path)) return { error: "Invalid image." };
  const supabase = await createClient();
  const { error } = await supabase.from("business_settings").update({ hero_image: path }).eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { success: path ? "Photo updated." : "Photo removed." };
}

const deliveryAreaSchema = z.object({
  id: z.uuid().optional(),
  name: z.string({ error: "Enter the area name." }).max(80),
  fee: z.string({ error: "Enter the delivery fee (0 for free)." }),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
  is_active: z.enum(["on"]).optional(),
});

export async function saveDeliveryArea(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(["owner"]);
  const parsed = deliveryAreaSchema.safeParse(formValues(formData));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const { id, name, sort_order, is_active } = parsed.data;
  const fee = parseMoney(parsed.data.fee);
  if (fee === null || Number.isNaN(fee))
    return { error: "Check the fee.", fieldErrors: { fee: "Enter an amount, e.g. 3,000." } };

  const supabase = await createClient();
  const { error } = id
    ? await supabase
        .from("delivery_areas")
        .update({ name, fee_kobo: fee, sort_order, is_active: is_active === "on" })
        .eq("id", id)
    : await supabase.from("delivery_areas").insert({ name, fee_kobo: fee, sort_order });
  if (error) return { error: error.code === "23505" ? "There is already an area with that name." : error.message };

  revalidatePath("/", "layout");
  return { success: id ? "Area saved." : `Added ${name}.` };
}
