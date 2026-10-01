import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductCard, ProductGrid } from "@/components/shop/product-card";
import { ShopClosed } from "@/components/shop/shop-closed";
import { ShopList } from "@/components/shop/shop-list";
import { categoryPhotos, getStorefront, listProducts, sellsByCoverage } from "@/lib/shop/data";
import { PLACEHOLDER, photoUrl } from "@/lib/shop/images";
import { needsSetup } from "@/lib/setup";

export default async function HomePage() {
  if (await needsSetup()) redirect("/setup");
  const shop = await getStorefront();
  if (!shop.enabled) return <ShopClosed shop={shop} />;

  const [featured, sale, photos, coverage] = await Promise.all([
    listProducts({ featured: true, limit: 8 }),
    shop.hasSale ? listProducts({ sale: true, limit: 4 }) : null,
    categoryPhotos(),
    sellsByCoverage(),
  ]);
  // With nothing marked as featured yet, show the newest items instead.
  const favourites =
    featured.products.length > 0 ? featured.products : (await listProducts({ sort: "new", limit: 8 })).products;
  const tiles = shop.categories.filter((c) => photos[c.id]).slice(0, 4);
  const card = { shops: shop.shops, leadTime: shop.leadTime, currency: shop.currency };

  return (
    <>
      <section className="relative flex h-[70vh] max-h-[620px] min-h-[420px] items-end justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl(shop.heroImage ?? PLACEHOLDER.hero, 1800)}
          alt=""
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[rgb(20_16_12/0.05)] to-[rgb(20_16_12/0.5)]" />
        <div className="text-on-dark relative px-5 pb-14 text-center md:pb-[72px]">
          <h1 className="shop-rise mx-auto max-w-[14ch] font-serif text-[clamp(40px,6vw,76px)] leading-[1.02] text-balance italic">
            {shop.heroTitle ?? shop.tagline ?? shop.brand}
          </h1>
          {shop.heroText && (
            <p
              className="shop-rise mx-auto mt-4 max-w-md text-base"
              style={{ "--delay": "80ms" } as React.CSSProperties}
            >
              {shop.heroText}
            </p>
          )}
          <Link
            href="/shop?sort=new"
            className="shop-btn shop-btn-light shop-rise mt-7"
            style={{ "--delay": "160ms" } as React.CSSProperties}
          >
            Shop new arrivals
          </Link>
        </div>
      </section>

      {tiles.length > 0 && (
        <section className="shop-wrap shop-reveal py-14 md:py-[84px]">
          <SectionHead title="Shop by category" href="/shop" link="View everything" />
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:gap-x-5 lg:grid-cols-4">
            {tiles.map((c) => (
              <Link key={c.id} href={`/shop?category=${c.slug}`} className="group block">
                <div className="bg-tint aspect-[4/5] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl(photos[c.id], 700)} alt="" loading="lazy" className="shop-photo" />
                </div>
                <h3 className="mt-3.5 font-serif text-xl">{c.name}</h3>
                <span className="shop-link mt-1 inline-block text-sm">Shop {c.name.toLowerCase()}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="border-border shop-reveal border-y px-5 py-14 text-center md:py-[76px]">
        <p className="mx-auto max-w-[1050px] font-serif text-[clamp(24px,3.2vw,38px)] leading-tight text-balance">
          Thoughtfully chosen pieces for every corner of your home, ready to collect from{" "}
          {shop.shops.length > 1 ? "a shop near you" : "our shop"} or delivered to your door.
        </p>
      </section>

      {favourites.length > 0 && (
        <section className="shop-wrap shop-reveal py-14 md:py-[84px]">
          <SectionHead title="Our favourites" href="/shop" link="Shop everything" />
          <ProductGrid>
            {favourites.map((p) => (
              <ProductCard key={p.id} product={p} {...card} />
            ))}
          </ProductGrid>
        </section>
      )}

      {(coverage.rolls || coverage.area) && (
        <section className="bg-tint shop-reveal grid md:grid-cols-2">
          <div className="min-h-[280px] md:min-h-[520px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl(PLACEHOLDER.calculator, 1200)}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          </div>
          <div className="self-center px-5 py-12 md:p-20">
            <p className="caps text-accent">{coverage.rolls ? "Wallpaper calculator" : "Flooring calculator"}</p>
            <h2 className="mt-3.5 mb-4 font-serif text-[clamp(30px,3.6vw,44px)] leading-[1.1] text-balance">
              {coverage.rolls ? "How many rolls do you need?" : "How many boxes do you need?"}
            </h2>
            <p className="text-muted mb-7 max-w-[420px]">
              {coverage.rolls
                ? "Enter your wall sizes and we will work out the rolls for you. We supply them from one batch wherever we can, so the shade matches."
                : "Enter the size of your floor and we will work out the boxes, with a little extra for cuts."}
            </p>
            <Link href="/calculator" className="shop-btn">
              Try the calculator
            </Link>
          </div>
        </section>
      )}

      {sale && sale.products.length > 1 && (
        <section className="shop-wrap shop-reveal py-14 md:py-[84px]">
          <SectionHead title="On sale now" href="/shop?sale=1" link="See all offers" />
          <ProductGrid>
            {sale.products.map((p) => (
              <ProductCard key={p.id} product={p} {...card} />
            ))}
          </ProductGrid>
        </section>
      )}

      {shop.shops.length > 0 && (
        <section className="shop-wrap shop-reveal border-border border-t py-14 md:py-[84px]">
          <SectionHead
            title={shop.shops.length > 1 ? "Our shops" : "Visit us"}
            href="/our-shops"
            link="Directions & opening hours"
          />
          <ShopList shop={shop} />
        </section>
      )}
    </>
  );
}

function SectionHead({ title, href, link }: { title: string; href: string; link: string }) {
  return (
    <div className="mb-7 flex items-baseline justify-between gap-4">
      <h2 className="font-serif text-[clamp(26px,3vw,34px)] leading-tight">{title}</h2>
      <Link href={href} className="shop-link shrink-0 text-sm">
        {link}
      </Link>
    </div>
  );
}
