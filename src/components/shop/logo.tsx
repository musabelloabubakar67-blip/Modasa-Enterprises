import { LogoMark } from "@/components/logo-mark";

/** The shop's logo: the mark with the brand name set in the heading typeface. */
export function Logo({ brand, tagline, onDark = false }: { brand: string; tagline?: string | null; onDark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      <LogoMark className={`h-7 w-auto lg:h-9 ${onDark ? "text-on-dark" : "text-accent"}`} />
      <span className="flex flex-col leading-none">
        <span
          className={`font-serif text-xl tracking-[0.28em] uppercase lg:text-[28px] ${onDark ? "text-on-dark" : "text-navy"}`}
        >
          {brand}
        </span>
        {tagline && (
          <span
            className={`mt-1.5 hidden font-serif text-[13px] italic lg:block ${onDark ? "text-on-dark/70" : "text-muted"}`}
          >
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
}
