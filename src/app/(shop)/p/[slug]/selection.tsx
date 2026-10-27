"use client";

import { createContext, useContext, useState } from "react";

// The variant the customer has picked, shared by the photos and the buy panel so picking a colour or
// design also shows its photo.
const Selection = createContext<[string, (id: string) => void] | null>(null);

export function SelectionProvider({ initialSkuId, children }: { initialSkuId: string; children: React.ReactNode }) {
  const state = useState(initialSkuId);
  return <Selection value={state}>{children}</Selection>;
}

export function useSelectedSku() {
  const state = useContext(Selection);
  if (!state) throw new Error("useSelectedSku needs a SelectionProvider");
  return state;
}
