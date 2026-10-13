import Link from "next/link";
import type { Storefront } from "@/lib/shop/data";
import { whatsappNumber } from "@/lib/phone";
import { Logo } from "./logo";

export function Footer({ shop }: { shop: Storefront }) {
  const whatsapp = shop.whatsapp ? `https://wa.me/${whatsappNumber(shop.whatsapp)}` : null;
  const link = "hover:text-on-dark inline-flex min-h-9 items-center transition-colors";

  return (
    <footer className="bg-foreground text-on-dark/75 mt-auto pt-16 pb-10 text-sm print:hidden">
      <div className="shop-wrap">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <Logo brand={shop.brand} onDark />
            {shop.tagline && <p className="mt-4 font-serif text-base italic">{shop.tagline}</p>}
            <p className="mt-3 max-w-xs">
              {shop.shops.length > 1
                ? `Visit us at ${shop.shops.map((s) => s.name).join(", ")}, or order here and we will have it ready.`
                : "Visit us in store, or order here and we will have it ready."}
            </p>
          </div>
          <nav aria-label="Shop">
            <h2 className="caps text-on-dark mb-3">Shop</h2>
            <ul>
              {shop.categories.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <Link href={`/shop?category=${c.slug}`} className={link}>
                    {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/shop" className={link}>
                  Everything
                </Link>
              </li>
            </ul>
          </nav>
          <nav aria-label="Help">
            <h2 className="caps text-on-dark mb-3">Help</h2>
            <ul>
              <li>
                <Link href="/help#delivery" className={link}>
                  Delivery &amp; collection
                </Link>
              </li>
              <li>
                <Link href="/help#returns" className={link}>
                  Returns
                </Link>
              </li>
              <li>
                <Link href="/calculator" className={link}>
                  Roll &amp; tile calculator
                </Link>
              </li>
            </ul>
          </nav>
          <div>
            <h2 className="caps text-on-dark mb-3">Contact</h2>
            <ul>
              {whatsapp && (
                <li>
                  <a href={whatsapp} target="_blank" rel="noreferrer" className={link}>
                    WhatsApp us
                  </a>
                </li>
              )}
              <li>
                <Link href="/our-shops" className={link}>
                  Our shops
                </Link>
              </li>
              {shop.openingHours && <li className="flex min-h-9 items-center">{shop.openingHours}</li>}
            </ul>
          </div>
        </div>
        <div className="border-on-dark/15 mt-12 flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-xs">
          <p>
            © {new Date().getFullYear()} {shop.businessName}
          </p>
          <Link href="/login" className="hover:text-on-dark transition-colors">
            Staff sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
