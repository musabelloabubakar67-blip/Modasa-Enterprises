import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export type BusinessSettings = {
  name: string;
  legal_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
  currency: string;
  receipt_footer: string | null;
  vat_enabled: boolean;
  vat_rate: number;
  vat_number: string | null;
};

/**
 * Business name, contact details and currency. Read with the service role because the login
 * page shows the business name before anyone is signed in; contains nothing sensitive.
 */
export const getBusinessSettings = cache(async (): Promise<BusinessSettings> => {
  const { data, error } = await createAdminClient()
    .from("business_settings")
    .select(
      "name, legal_name, phone, email, address, logo_url, currency, receipt_footer, vat_enabled, vat_rate, vat_number",
    )
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data;
});
