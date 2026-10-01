import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard, ProductGrid } from "@/components/shop/product-card";
import { ShopClosed } from "@/components/shop/shop-closed";
import { getProduct, getStorefront, listProducts } from "@/lib/shop/data";
import { photoUrl } from "@/lib/shop/images";
import { Gallery } from "./gallery";
import { ProductBuy } from "./product-buy";

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return { title: "Not found" };
  return {
    title: product.name,
    description: product.description ?? undefined,
    openGraph: product.images[0] ? { images: [photoUrl(product.images[0], 1200)] } : undefined,
  };
}

export default async function ProductPage({ params }: PageProps<"/p/[slug]">) {
  const shop = await getStorefront();
  if (!shop.enabled) return <ShopClosed shop={shop} />;
  const product = await getProduct((await params).slug);
  if (!product) notFound();

  const related = await listProducts({ categoryId: product.category.id, excludeId: product.id, limit: 4 });
  const { unit } = product;
  const sizes = [
    ...new Set(
      product.skus.map((s) =>
        s.rollWidthCm && s.rollLengthCm ? `${s.rollWidthCm} cm × ${s.rollLengthCm / 100} m` : null,
      ),
    ),
  ];
  const coverage = [...new Set(product.skus.map((s) => s.coverageM2))];

  return (
    <div className="shop-wrap py-8 md:py-12">
      <nav aria-label="Breadcrumb" className="text-muted mb-6 text-sm">
        <Link href="/shop" className="hover:text-foreground">
          Shop
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/shop?category=${product.category.slug}`} className="hover:text-foreground">
          {product.category.name}
        </Link>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12 lg:gap-20">
        <Gallery images={product.images} name={product.name} />
        <div className="md:max-w-md">
          <h1 className="font-serif text-[clamp(30px,3.6vw,44px)] leading-[1.1] text-balance">{product.name}</h1>
          <div className="mt-4">
            <ProductBuy product={product} shops={shop.shops} leadTime={shop.leadTime} currency={shop.currency} />
          </div>

          {product.description && <p className="mt-8 whitespace-pre-line">{product.description}</p>}

          <dl className="border-border mt-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t pt-6 text-sm">
            <dt className="text-muted">Sold by</dt>
            <dd>The {unit.name.toLowerCase()}</dd>
            {unit.coverage === "roll" && sizes.length === 1 && sizes[0] && (
              <>
                <dt className="text-muted">Roll size</dt>
                <dd>{sizes[0]}</dd>
              </>
            )}
            {unit.coverage === "area" && coverage.length === 1 && coverage[0] && (
              <>
                <dt className="text-muted">Covers</dt>
                <dd>
                  {coverage[0]} m² per {unit.name.toLowerCase()}
                </dd>
              </>
            )}
            <dt className="text-muted">{product.skus.length > 1 ? "Codes" : "Code"}</dt>
            <dd>{product.skus.map((s) => s.code).join(", ")}</dd>
            <dt className="text-muted">Collection</dt>
            <dd>Free from {shop.shops.length > 1 ? "the shop you choose" : "our shop"}</dd>
            <dt className="text-muted">Delivery</dt>
            <dd>
              Available at checkout.{" "}
              <Link href="/help#delivery" className="shop-link">
                See areas and fees
              </Link>
            </dd>
          </dl>
        </div>
      </div>

      {related.products.length > 0 && (
        <section className="shop-reveal border-border mt-16 border-t pt-12 md:mt-24">
          <h2 className="mb-7 font-serif text-[clamp(26px,3vw,34px)]">More {product.category.name.toLowerCase()}</h2>
          <ProductGrid>
            {related.products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                shops={shop.shops}
                leadTime={shop.leadTime}
                currency={shop.currency}
              />
            ))}
          </ProductGrid>
        </section>
      )}
    </div>
  );
}
