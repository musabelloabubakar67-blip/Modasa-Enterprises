"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MenuLink } from "./mobile-menu";

const GAP = 32; // px between links, matches gap-x-8

/**
 * Desktop category row: one line, in the order set under Products → Categories & units. Whatever doesn't
 * fit the width goes under "More". Widths are measured from an invisible copy of the row, so labels never
 * wrap and the split adjusts as the window is resized.
 */
export function CategoryNav({ links }: { links: MenuLink[] }) {
  const navRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(links.length);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const measure = measureRef.current;
    if (!nav || !measure) return;
    const fit = () => {
      const widths = [...measure.children].map((el) => (el as HTMLElement).offsetWidth);
      const moreWidth = widths.pop() ?? 0;
      const available = nav.clientWidth;
      const total = widths.reduce((sum, w) => sum + w, 0) + GAP * (widths.length - 1);
      if (total <= available) return setVisible(widths.length);
      let used = moreWidth;
      let count = 0;
      while (count < widths.length && used + GAP + widths[count] <= available) used += GAP + widths[count++];
      setVisible(count);
    };
    fit();
    document.fonts?.ready.then(fit); // the web font changes the widths once it loads
    const observer = new ResizeObserver(fit);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [links]);

  // Close the menu on a click elsewhere or Escape (choosing a category closes it too, below).
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const linkClass = (link: MenuLink) =>
    `hover:text-accent whitespace-nowrap transition-colors ${link.sale ? "text-sale" : ""}`;
  const hidden = links.slice(visible);

  return (
    <nav
      ref={navRef}
      aria-label="Categories"
      // Clipped sideways so the row can't spill out before the split is measured; the menu still drops down.
      className="caps relative hidden justify-center gap-x-8 overflow-x-clip pb-4 lg:flex print:hidden"
    >
      {/* Invisible copy used only for measuring. */}
      <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute flex">
        {links.map((link) => (
          <span key={link.href} className="whitespace-nowrap">
            {link.label}
          </span>
        ))}
        <span className="whitespace-nowrap">More ▾</span>
      </div>

      {links.slice(0, visible).map((link) => (
        <Link key={link.href} href={link.href} className={linkClass(link)}>
          {link.label}
        </Link>
      ))}

      {hidden.length > 0 && (
        <div className="relative">
          <button
            type="button"
            className="caps hover:text-accent whitespace-nowrap transition-colors"
            aria-expanded={open}
            aria-controls="more-categories"
            onClick={() => setOpen(!open)}
          >
            More <span aria-hidden>▾</span>
          </button>
          {open && (
            <div
              id="more-categories"
              className="border-border bg-background absolute top-full right-0 z-50 mt-3 grid min-w-56 gap-3 border px-5 py-4 text-left shadow-[0_12px_24px_rgb(28_25_21/0.08)]"
            >
              {hidden.map((link) => (
                <Link key={link.href} href={link.href} className={linkClass(link)} onClick={() => setOpen(false)}>
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
