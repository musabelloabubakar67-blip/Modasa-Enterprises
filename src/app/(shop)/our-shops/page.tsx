import type { Metadata } from "next";
import { ShopList } from "@/components/shop/shop-list";
import { whatsappNumber } from "@/lib/phone";
import { getStorefront } from "@/lib/shop/data";

export const metadata: Metadata = { title: "Our shops" };

export default async function OurShopsPage() {
  const shop = await getStorefront();
  const whatsapp = shop.whatsapp ? `https://wa.me/${whatsappNumber(shop.whatsapp)}` : null;

  return (
    <div className="shop-wrap py-10 md:py-14">
      <h1 className="font-serif text-[clamp(32px,4vw,48px)] leading-[1.1]">
        {shop.shops.length > 1 ? "Our shops" : "Visit us"}
      </h1>
      <p className="text-muted mt-3 max-w-xl">
        See and feel everything in person, or order online and collect from the shop that suits you.
        {shop.openingHours && ` We are open ${shop.openingHours}.`}
      </p>
      <div className="mt-10">
        <ShopList shop={shop} />
      </div>

      <section className="border-border mt-16 grid gap-8 border-t pt-10 md:grid-cols-3">
        <h2 className="font-serif text-2xl">Get in touch</h2>
        <dl className="grid gap-5 text-sm sm:grid-cols-3 md:col-span-2">
          {whatsapp && (
            <div>
              <dt className="caps text-muted mb-1">WhatsApp</dt>
              <dd>
                <a href={whatsapp} target="_blank" rel="noreferrer" className="shop-link">
                  Message us
                </a>
              </dd>
            </div>
          )}
          {shop.phone && (
            <div>
              <dt className="caps text-muted mb-1">Phone</dt>
              <dd>
                <a href={`tel:${shop.phone.replace(/\s/g, "")}`} className="shop-link">
                  {shop.phone}
                </a>
              </dd>
            </div>
          )}
          {shop.email && (
            <div>
              <dt className="caps text-muted mb-1">Email</dt>
              <dd>
                <a href={`mailto:${shop.email}`} className="shop-link">
                  {shop.email}
                </a>
              </dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}
