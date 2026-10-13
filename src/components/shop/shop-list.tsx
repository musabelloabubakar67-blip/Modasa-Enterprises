import type { Storefront } from "@/lib/shop/data";

/** Each shop's address, hours and a link to directions. */
export function ShopList({ shop }: { shop: Storefront }) {
  return (
    <ul className="grid gap-x-5 gap-y-10 md:grid-cols-3">
      {shop.shops.map((s, i) => (
        <li key={s.id} className="border-foreground border-t pt-5">
          <p className="caps text-muted">Shop {String(i + 1).padStart(2, "0")}</p>
          <h3 className="mt-2 font-serif text-2xl">{s.name}</h3>
          {s.address && <p className="mt-2 max-w-[32ch]">{s.address}</p>}
          <p className="text-muted mt-1 text-sm">{[shop.openingHours, s.phone].filter(Boolean).join(" · ")}</p>
          {s.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`}
              target="_blank"
              rel="noreferrer"
              className="shop-link mt-3 inline-block text-sm"
            >
              Get directions
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
