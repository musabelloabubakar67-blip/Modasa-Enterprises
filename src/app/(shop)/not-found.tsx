import Link from "next/link";

export default function ShopNotFound() {
  return (
    <div className="shop-wrap py-24 text-center">
      <h1 className="font-serif text-4xl">We can&apos;t find that page</h1>
      <p className="text-muted mt-3">It may have moved, or the item is no longer sold online.</p>
      <Link href="/shop" className="shop-btn mt-8">
        Browse the shop
      </Link>
    </div>
  );
}
