import Link from "next/link";
import type { Storefront } from "@/lib/shop/data";
import { whatsappNumber } from "@/lib/phone";
import { CartLink } from "./cart-link";
import { SearchIcon } from "./icons";
import { Logo } from "./logo";
import { MobileMenu, type MenuLink } from "./mobile-menu";

export function Header({ shop }: { shop: Storefront }) {
  const links: MenuLink[] = [
    { href: "/shop?sort=new", label: "New in" },
    ...shop.categories.map((c) => ({ href: `/shop?category=${c.slug}`, label: c.name })),
    ...(shop.hasSale ? [{ href: "/shop?sale=1", label: "Sale", sale: true }] : []),
  ];
  const more: MenuLink[] = [
    { href: "/our-shops", label: "Our shops" },
    { href: "/calculator", label: "Roll & tile calculator" },
    { href: "/help", label: "Delivery & returns" },
  ];
  const whatsapp = shop.whatsapp ? `https://wa.me/${whatsappNumber(shop.whatsapp)}` : null;

  return (
    <>
      <p className="caps bg-navy text-on-dark px-4 py-2.5 text-center print:hidden">
        Pay online · Collect in store or have it delivered
      </p>
      <header className="border-border bg-background sticky top-0 z-40 border-b print:static">
        <div className="shop-wrap relative">
          <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4 lg:h-[84px]">
            <div className="flex items-center print:invisible">
              <MobileMenu links={links} more={more} />
              <form action="/shop" role="search" className="relative hidden w-72 lg:block">
                <label htmlFor="shop-search" className="sr-only">
                  Search the shop
                </label>
                <input
                  id="shop-search"
                  name="q"
                  type="search"
                  placeholder="Search rugs, wallpaper, furniture…"
                  className="shop-input pr-11 text-sm"
                />
                <button
                  type="submit"
                  aria-label="Search"
                  className="text-muted hover:text-foreground absolute inset-y-0 right-0 flex w-11 items-center justify-center"
                >
                  <SearchIcon />
                </button>
              </form>
            </div>
            <Link href="/" aria-label={`${shop.brand} home`}>
              <Logo brand={shop.brand} tagline={shop.tagline} />
            </Link>
            <div className="flex items-center justify-end gap-7 text-sm print:invisible">
              <Link href="/our-shops" className="hover:text-accent hidden transition-colors lg:inline">
                Our shops
              </Link>
              {whatsapp && (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-accent hidden transition-colors lg:inline"
                >
                  WhatsApp
                </a>
              )}
              <CartLink />
            </div>
          </div>
          <nav aria-label="Categories" className="caps hidden justify-center gap-x-10 pb-4 lg:flex print:hidden">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`hover:text-accent transition-colors ${link.sale ? "text-sale" : ""}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
    </>
  );
}
