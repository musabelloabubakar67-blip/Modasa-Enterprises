import "server-only";
import { headers } from "next/headers";

/**
 * The public address of this site, for links sent to customers (e.g. receipts on WhatsApp).
 * Uses NEXT_PUBLIC_SITE_URL when set (recommended in production), otherwise the current request's host.
 */
export async function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Nigerian numbers typed locally (0803…) become international (234803…) for WhatsApp links. */
export function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11) return `234${digits.slice(1)}`;
  return digits;
}
