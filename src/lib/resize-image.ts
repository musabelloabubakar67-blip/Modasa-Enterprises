const MAX_EDGE = 1600;

function encode(bitmap: ImageBitmap, maxEdge: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not process image"))),
      "image/webp",
      quality,
    ),
  );
}

/** Shrinks a photo to at most 1600px (by default) on its longest side and re-encodes it as WebP. */
export async function resizeImage(file: File, maxEdge = MAX_EDGE): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    return await encode(bitmap, maxEdge, 0.85);
  } finally {
    bitmap.close();
  }
}

/**
 * The same photo at several sizes (longest side), as WebP, so pages can load a small file for a small picture.
 * Small sizes are only ever shown small, so they can take a little more compression.
 */
export async function resizeImageSizes(file: File, edges: readonly number[]): Promise<Map<number, Blob>> {
  const bitmap = await createImageBitmap(file);
  try {
    const blobs = new Map<number, Blob>();
    for (const edge of edges) blobs.set(edge, await encode(bitmap, edge, edge <= 400 ? 0.8 : 0.85));
    return blobs;
  } finally {
    bitmap.close();
  }
}
