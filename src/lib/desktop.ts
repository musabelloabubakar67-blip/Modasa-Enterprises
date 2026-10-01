// Bridge to the desktop till app (Tauri). In a normal browser none of this is available and the
// till falls back to browser printing, so every caller must check isDesktop() first.

export type DesktopConfig = {
  server_url: string;
  receipt_printer: string | null;
  paper_width: 48 | 32;
  cash_drawer: boolean;
};

type TauriInternals = { invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T> };

function tauri(): TauriInternals | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__ ?? null;
}

export function isDesktop() {
  return tauri() !== null;
}

export async function desktopConfig(): Promise<DesktopConfig | null> {
  const t = tauri();
  return t ? t.invoke<DesktopConfig>("get_config") : null;
}

/** Sends raw ESC/POS bytes to the configured receipt printer. */
export async function printRaw(bytes: Uint8Array) {
  const t = tauri();
  if (!t) throw new Error("Not running in the desktop till app.");
  await t.invoke("print_raw", { data: Array.from(bytes) });
}
