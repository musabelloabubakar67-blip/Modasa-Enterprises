import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { paymentMode } from "@/lib/shop/paystack";
import { DeliveryAreaForm, HeroPhoto, WebsiteForm } from "./forms";

export default async function WebsiteSettingsPage() {
  const supabase = await createClient();
  const [settings, areas] = await Promise.all([
    supabase
      .from("business_settings")
      .select(
        "storefront_enabled, storefront_name, tagline, hero_title, hero_text, hero_image, whatsapp_number, opening_hours, order_lead_time, order_hold_minutes, currency",
      )
      .eq("id", 1)
      .single(),
    supabase
      .from("delivery_areas")
      .select("id, name, fee_kobo, sort_order, is_active")
      .order("sort_order")
      .order("name"),
  ]);
  if (settings.error) throw settings.error;
  if (areas.error) throw areas.error;
  const mode = paymentMode();

  return (
    <div className="space-y-6">
      <p className="text-muted text-sm">
        The online shop customers see at{" "}
        <Link href="/" target="_blank" className="text-accent hover:underline">
          the front of this site
        </Link>
        . Choose which products appear there on each product&apos;s page; shop addresses come from Locations.
      </p>

      <div
        className={`rounded-md px-3 py-2 text-sm ${mode === "paystack" ? "bg-success/10 text-success" : "bg-amber-100 text-amber-900"}`}
      >
        {mode === "paystack"
          ? "Online payment is connected to Paystack."
          : mode === "test"
            ? "Online payment is in test mode on this computer: no real money is taken. Add the Paystack keys to go live."
            : "Online payment is not set up, so customers can't check out. Add the Paystack keys to the site's settings."}
      </div>

      <WebsiteForm settings={settings.data} />
      <HeroPhoto image={settings.data.hero_image} />

      <section className="card p-6">
        <h2 className="font-semibold">Delivery areas</h2>
        <p className="text-muted mt-1 text-sm">
          Where you deliver and what it costs. Customers choose one at checkout. With no active areas, orders are
          collection only.
        </p>
        <div className="divide-border mt-4 divide-y">
          {areas.data.map((area) => (
            <div key={area.id} className="py-4 first:pt-0">
              <DeliveryAreaForm area={area} currency={settings.data.currency} />
            </div>
          ))}
          <div className="pt-4">
            <p className="mb-2 text-sm font-medium">Add an area</p>
            <DeliveryAreaForm currency={settings.data.currency} />
          </div>
        </div>
      </section>
    </div>
  );
}
