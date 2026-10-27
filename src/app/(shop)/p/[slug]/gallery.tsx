"use client";

import { useState } from "react";
import { photoUrl } from "@/lib/shop/images";
import { useSelectedSku } from "./selection";

export function Gallery({
  images,
  name,
  skuImages,
}: {
  images: string[];
  name: string;
  /** Each variant's own photos, so picking it shows its photo. */
  skuImages: Record<string, string[]>;
}) {
  const [skuId] = useSelectedSku();
  // The picked variant's own photo; for a variant without one, the first photo of the whole product, so the
  // picture never shows a different colour or design from the one picked.
  const photoFor = (id: string) => {
    const own = images.indexOf(skuImages[id]?.[0] ?? "");
    if (own >= 0) return own;
    const variantPhotos = new Set(Object.values(skuImages).flat());
    return images.findIndex((image) => !variantPhotos.has(image));
  };
  const [current, setCurrent] = useState(() => Math.max(0, photoFor(skuId)));
  const [shownFor, setShownFor] = useState(skuId);
  if (shownFor !== skuId) {
    setShownFor(skuId);
    const next = photoFor(skuId);
    if (next >= 0) setCurrent(next);
  }

  if (images.length === 0) {
    return (
      <div className="bg-tint text-muted flex aspect-square items-center justify-center px-6 text-center font-serif text-2xl italic">
        {name}
      </div>
    );
  }

  return (
    <div>
      <div className="bg-surface aspect-square overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl(images[current], 1200)} alt={name} className="size-full object-cover" fetchPriority="high" />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-3 overflow-x-auto">
          {images.map((image, i) => (
            <button
              key={image}
              type="button"
              aria-label={`Photo ${i + 1} of ${images.length}`}
              aria-pressed={i === current}
              onClick={() => setCurrent(i)}
              className={`size-20 shrink-0 overflow-hidden border ${i === current ? "border-foreground" : "border-transparent"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(image, 200)} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
