import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { canEditProducts } from "@/lib/products";
import { ProductThumb } from "@/components/product-thumb";
import { getCatalogueOptions } from "../data";
import { ProductForm } from "../product-form";
import { ProductImages } from "./product-images";

export default async function ProductPage({ params, searchParams }: PageProps<"/app/products/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  const { created, saved } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .select(
      `id, name, slug, category_id, unit_id, description, is_active, track_batches, show_online, is_featured,
       categories(name), units(name, abbreviation),
       skus(id, code, variant_label, price_kobo, promo_price_kobo, barcode, roll_width_cm, roll_length_cm,
            coverage_m2, is_active, sort_order, sku_costs(cost_kobo)),
       product_images(id, storage_path, sort_order)`,
    )
    .eq("id", id)
    .order("sort_order", { referencedTable: "skus" })
    .order("sort_order", { referencedTable: "product_images" })
    .maybeSingle();
  if (error) throw error;
  if (!product) notFound();

  const { currency } = await getBusinessSettings();
  const skus = product.skus.map(({ sku_costs, ...s }) => ({ ...s, cost_kobo: sku_costs?.cost_kobo ?? null }));

  if (!canEditProducts(staff.role)) {
    return (
      <div className="max-w-3xl">
        <Link href="/app/products" className="text-muted text-sm hover:underline">
          ← Products
        </Link>
        <div className="mt-2 flex items-center gap-4">
          <ProductThumb path={product.product_images[0]?.storage_path} name={product.name} size={72} />
          <div>
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            <p className="text-muted text-sm">
              {product.categories.name} · sold per {product.units.name.toLowerCase()}
            </p>
          </div>
        </div>
        {product.description && <p className="mt-4 text-sm">{product.description}</p>}
        <table className="card mt-6 w-full text-sm">
          <thead className="text-muted text-left">
            <tr>
              <th className="p-3 font-medium">Code</th>
              <th className="p-3 font-medium">Variant</th>
              <th className="p-3 text-right font-medium">Price</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {skus
              .filter((s) => s.is_active)
              .map((s) => (
                <tr key={s.id}>
                  <td className="p-3 font-mono">{s.code}</td>
                  <td className="p-3">{s.variant_label ?? "—"}</td>
                  <td className="p-3 text-right tabular-nums">
                    {s.promo_price_kobo !== null ? (
                      <>
                        <span className="text-muted mr-2 line-through">{formatMoney(s.price_kobo, currency)}</span>
                        <span className="text-success font-medium">{formatMoney(s.promo_price_kobo, currency)}</span>
                      </>
                    ) : (
                      formatMoney(s.price_kobo, currency)
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
  }

  const { categories, units } = await getCatalogueOptions();

  return (
    <div className="max-w-3xl">
      <Link href="/app/products" className="text-muted text-sm hover:underline">
        ← Products
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold">{product.name}</h1>
      {(created || saved) && (
        <p role="status" className="bg-success/10 text-success mb-4 rounded-md px-3 py-2 text-sm">
          {created ? "Product created. You can add photos below." : "Changes saved."}
        </p>
      )}
      {product.show_online && product.is_active && (
        <p className="text-muted mb-4 text-sm">
          On the website:{" "}
          <Link href={`/p/${product.slug}`} target="_blank" className="text-accent hover:underline">
            view as a customer
          </Link>
        </p>
      )}
      <ProductImages productId={product.id} productName={product.name} images={product.product_images} />
      <div className="mt-6">
        <ProductForm
          key={JSON.stringify(skus.map((s) => s.id))}
          product={{ ...product, skus }}
          categories={categories}
          units={units}
          currency={currency}
        />
      </div>
    </div>
  );
}
