import type { Metadata } from "next";
import Link from "next/link";
import { AreaCalculator, RollCalculator } from "@/components/shop/calculators";
import { getStorefront } from "@/lib/shop/data";

export const metadata: Metadata = {
  title: "Roll & tile calculator",
  description: "Work out how many rolls of wallpaper or boxes of flooring a room needs.",
};

export default async function CalculatorPage() {
  const shop = await getStorefront();
  const wallpaper = shop.categories.find((c) => /wallpaper|wall/i.test(c.name));
  const flooring = shop.categories.find((c) => /floor|tile/i.test(c.name));

  return (
    <div className="shop-wrap max-w-[1040px] py-10 md:py-14">
      <h1 className="font-serif text-[clamp(32px,4vw,48px)] leading-[1.1]">How much do you need?</h1>
      <p className="text-muted mt-3 max-w-xl">
        Measure in metres. If you are unsure, round up: it is easier to return an unopened roll or box than to find a
        matching one later.
      </p>

      <div className="mt-10 grid gap-12 md:grid-cols-2 md:gap-16">
        <section>
          <h2 className="font-serif text-2xl">Wallpaper</h2>
          <p className="text-muted mt-1 mb-5 text-sm">
            Counted in full-height strips, the way installers do. Most rolls are 53 cm wide and 10 m long.
          </p>
          <RollCalculator />
          {wallpaper && (
            <Link href={`/shop?category=${wallpaper.slug}`} className="shop-link mt-6 inline-block text-sm">
              Shop {wallpaper.name.toLowerCase()}
            </Link>
          )}
        </section>
        <section>
          <h2 className="font-serif text-2xl">Tiles &amp; flooring</h2>
          <p className="text-muted mt-1 mb-5 text-sm">
            Includes 10% extra for cuts and breakages. Each product page says how much one box covers.
          </p>
          <AreaCalculator />
          {flooring && (
            <Link href={`/shop?category=${flooring.slug}`} className="shop-link mt-6 inline-block text-sm">
              Shop {flooring.name.toLowerCase()}
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
