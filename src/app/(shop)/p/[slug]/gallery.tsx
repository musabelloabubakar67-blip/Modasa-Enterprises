"use client";

import { useState } from "react";
import { photoUrl } from "@/lib/shop/images";

export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [current, setCurrent] = useState(0);

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
