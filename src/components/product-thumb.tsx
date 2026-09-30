import { productImageUrl } from "@/lib/products";

/** Square product photo, or the product's initials when it has none. */
export function ProductThumb({ path, name, size = 48 }: { path?: string | null; name: string; size?: number }) {
  const style = { width: size, height: size };
  if (!path) {
    const initials = name
      .split(/\s+/)
      .filter((w) => /^[a-z0-9]/i.test(w))
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");
    return (
      <div
        style={style}
        className="bg-accent/10 text-accent flex shrink-0 items-center justify-center rounded-md text-xs font-semibold"
        aria-hidden="true"
      >
        {initials}
      </div>
    );
  }
  return (
    // Plain <img>: photos come from Supabase Storage, and next/image blocks local IPs in development.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={productImageUrl(path)} alt="" style={style} className="shrink-0 rounded-md object-cover" loading="lazy" />
  );
}
