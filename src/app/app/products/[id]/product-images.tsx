"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/products";
import { ProductThumb } from "@/components/product-thumb";

const MAX_EDGE = 1600;

/** Shrinks a photo to at most 1600px on its longest side and re-encodes it as WebP. */
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not process image"))), "image/webp", 0.85),
  );
}

type Image = { id: string; storage_path: string; sort_order: number };

export function ProductImages({
  productId,
  productName,
  images,
}: {
  productId: string;
  productName: string;
  images: Image[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const refresh = () => startTransition(() => router.refresh());

  async function upload(files: FileList) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    let order = images.reduce((max, img) => Math.max(max, img.sort_order), 0);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);
        const blob = await resizeImage(file);
        const path = `${productId}/${crypto.randomUUID()}.webp`;
        const { error: uploadError } = await supabase.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .upload(path, blob, { contentType: "image/webp" });
        if (uploadError) throw uploadError;
        const { error: rowError } = await supabase
          .from("product_images")
          .insert({ product_id: productId, storage_path: path, sort_order: ++order });
        if (rowError) {
          await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
          throw rowError;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
      refresh();
    }
  }

  async function remove(image: Image) {
    if (!confirm("Remove this photo?")) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: rowError } = await supabase.from("product_images").delete().eq("id", image.id);
    if (rowError) setError(rowError.message);
    else await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([image.storage_path]);
    setBusy(false);
    refresh();
  }

  async function makeMain(image: Image) {
    setBusy(true);
    setError(null);
    const first = images.reduce((min, img) => Math.min(min, img.sort_order), 0);
    const { error: updateError } = await createClient()
      .from("product_images")
      .update({ sort_order: first - 1 })
      .eq("id", image.id);
    if (updateError) setError(updateError.message);
    setBusy(false);
    refresh();
  }

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Photos</h2>
        <label className={`btn btn-secondary ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? "Working…" : "Add photos"}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={busy}
            onChange={(e) => e.target.files?.length && upload(e.target.files)}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="bg-danger/10 text-danger mt-3 rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}
      {images.length === 0 ? (
        <p className="text-muted mt-3 text-sm">No photos yet. The first photo is shown in lists and at the till.</p>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-3">
          {images.map((image, i) => (
            <li key={image.id} className="w-28 text-xs">
              <ProductThumb path={image.storage_path} name={productName} size={112} />
              <div className="mt-1 flex justify-between">
                {i === 0 ? (
                  <span className="text-muted">Main</span>
                ) : (
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => makeMain(image)}
                    disabled={busy}
                  >
                    Make main
                  </button>
                )}
                <button
                  type="button"
                  className="text-danger hover:underline"
                  onClick={() => remove(image)}
                  disabled={busy}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
