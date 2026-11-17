"use client";

import dynamic from "next/dynamic";

// The tour's code is only fetched when the demo tour is switched on (NEXT_PUBLIC_DEMO_TOUR=1).
const TourRunner = dynamic(() => import("./runner"), { ssr: false });

export function TourLoader() {
  return <TourRunner />;
}
