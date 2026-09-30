import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { getCatalogueOptions } from "../data";
import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  await requireStaff(["owner", "manager"]);
  const [{ categories, units }, { currency }] = await Promise.all([getCatalogueOptions(), getBusinessSettings()]);

  return (
    <div className="max-w-3xl">
      <Link href="/app/products" className="text-muted text-sm hover:underline">
        ← Products
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold">New product</h1>
      {categories.length === 0 ? (
        <p className="card p-6 text-sm">
          Add a category first in{" "}
          <Link href="/app/products/setup" className="text-accent underline">
            Categories &amp; units
          </Link>
          .
        </p>
      ) : (
        <ProductForm categories={categories} units={units} currency={currency} />
      )}
      <p className="text-muted mt-6 text-sm">Photos can be added after the product is created.</p>
    </div>
  );
}
