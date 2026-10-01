// Bridge to the desktop till app (Tauri). In a normal browser none of this is available and the
// till falls back to browser printing, so every caller must check isDesktop() first.

export type DesktopConfig = {
  server_url: string;
  receipt_printer: string | null;
  paper_width: 48 | 32;
  cash_drawer: boolean;
  kiosk: boolean;
  has_exit_pin: boolean;
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

/** Opens the till's own settings screen (printer, server, PIN), asking for the manager PIN if set. */
export async function openTillSettings() {
  const t = tauri();
  const config = await desktopConfig();
  if (!t || !config) return;
  let pin: string | null = null;
  if (config.kiosk && config.has_exit_pin) {
    pin = window.prompt("Manager PIN");
    if (pin === null) return;
  }
  await t.invoke("open_settings", { pin });
}
