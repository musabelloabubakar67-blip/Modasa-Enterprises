"use client";

import { useEffect } from "react";

/**
 * Marks the page as interactive. Until then, CSS in globals.css makes buttons unclickable, so a
 * click on a slow till PC is never silently lost before the page has finished loading.
 */
export function HydrationMarker() {
  useEffect(() => {
    document.body.dataset.hydrated = "true";
  }, []);
  return null;
}
