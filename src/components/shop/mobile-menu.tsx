"use client";

import Link from "next/link";
import { useState } from "react";
import { CloseIcon, MenuIcon } from "./icons";

export type MenuLink = { href: string; label: string; sale?: boolean };

/** Phone and tablet menu: search, categories and the secondary links in one panel under the header. */
export function MobileMenu({ links, more }: { links: MenuLink[]; more: MenuLink[] }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="-ml-2 inline-flex size-11 items-center justify-center"
        aria-expanded={open}
        aria-controls="shop-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen(!open)}
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>
      {open && (
        <div
          id="shop-menu"
          className="border-border bg-background absolute inset-x-0 top-full max-h-[calc(100dvh-64px)] overflow-y-auto border-t shadow-[0_12px_24px_rgb(28_25_21/0.08)]"
        >
          <div className="shop-wrap py-5">
            <form action="/shop" role="search" onSubmit={close}>
              <label htmlFor="menu-search" className="sr-only">
                Search the shop
              </label>
              <input id="menu-search" name="q" type="search" placeholder="Search the shop…" className="shop-input" />
            </form>
            <nav className="divide-border mt-3 flex flex-col divide-y">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={close}
                  className={`caps flex min-h-12 items-center ${link.sale ? "text-sale" : ""}`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="text-muted mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {more.map((link) => (
                <Link key={link.href} href={link.href} onClick={close} className="flex min-h-11 items-center">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
