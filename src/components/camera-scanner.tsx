"use client";

import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";

/** The same code read again within this time is ignored, so holding an item still adds it once. */
const REPEAT_MS = 2500;

type Status = { kind: "starting" } | { kind: "scanning" } | { kind: "error"; message: string };

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1200;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
    osc.onended = () => ctx.close();
  } catch {
    // No sound available; the on-screen confirmation is enough.
  }
  navigator.vibrate?.(60);
}

function cameraError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError")
    return "Camera access was blocked. Allow the camera for this site in the browser settings, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device.";
  if (name === "NotReadableError") return "The camera is being used by another app. Close it and try again.";
  if (typeof window !== "undefined" && !window.isSecureContext)
    return "The camera only works on a secure (https://) address.";
  return "Couldn't start the camera.";
}

/**
 * Full-screen camera view that reads barcodes and passes each one to `onCode`. Stays open so several
 * items can be scanned in a row; `lastResult` shows what the last scan did.
 */
export function CameraScanner({
  onCode,
  onClose,
  lastResult,
}: {
  onCode: (code: string) => void;
  onClose: () => void;
  lastResult: { text: string; ok: boolean } | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastCode = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const handler = useRef(onCode);
  const [status, setStatus] = useState<Status>({ kind: "starting" });
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraIndex, setCameraIndex] = useState(-1); // -1 = let the browser pick the back camera
  const [torch, setTorch] = useState<boolean | null>(null); // null = not supported

  useEffect(() => {
    handler.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("", "NotFoundError");
        // Loaded only when the camera is opened, to keep the till fast.
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128, // our own labels
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_39,
          BarcodeFormat.ITF,
          BarcodeFormat.QR_CODE,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });

        const device = cameraIndex >= 0 ? cameras[cameraIndex]?.deviceId : undefined;
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: device
            ? { deviceId: { exact: device }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        };
        const controls = await reader.decodeFromConstraints(constraints, videoRef.current!, (result) => {
          if (!result) return;
          const code = result.getText().trim();
          const now = Date.now();
          if (code === lastCode.current.code && now - lastCode.current.at < REPEAT_MS) return;
          lastCode.current = { code, at: now };
          beep();
          handler.current(code);
        });
        if (cancelled) return controls.stop();
        controlsRef.current = controls;
        setStatus({ kind: "scanning" });
        setTorch(controls.switchTorch ? false : null);
        if (cameras.length === 0)
          setCameras((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput"));
      } catch (e) {
        if (!cancelled) setStatus({ kind: "error", message: cameraError(e) });
      }
    })();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
    // Restart only when the chosen camera changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Scan with camera"
    >
      <div className="flex items-center justify-between gap-2 p-3">
        <p className="text-sm font-medium">Point the camera at a barcode</p>
        <div className="flex gap-2">
          {cameras.length > 1 && (
            <button
              type="button"
              className="rounded-md bg-white/15 px-3 py-2 text-sm"
              onClick={() => setCameraIndex((i) => (i + 1) % cameras.length)}
            >
              Switch camera
            </button>
          )}
          {torch !== null && (
            <button
              type="button"
              className="rounded-md bg-white/15 px-3 py-2 text-sm"
              onClick={async () => {
                await controlsRef.current?.switchTorch?.(!torch).catch(() => {});
                setTorch(!torch);
              }}
            >
              Light {torch ? "off" : "on"}
            </button>
          )}
          <button
            type="button"
            className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {/* Aiming box: barcodes read best held flat, filling most of its width. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <div className="h-40 w-4/5 max-w-xl rounded-lg border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
        {status.kind === "starting" && (
          <p className="absolute inset-x-0 top-1/2 text-center text-sm">Starting camera…</p>
        )}
        {status.kind === "error" && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <p role="alert" className="max-w-sm rounded-md bg-white p-4 text-center text-sm text-black">
              {status.message}
            </p>
          </div>
        )}
      </div>

      <div className="min-h-16 p-3 text-center text-sm" role="status" aria-live="polite">
        {lastResult ? (
          <span className={lastResult.ok ? "text-green-300" : "text-amber-300"}>{lastResult.text}</span>
        ) : (
          <span className="text-white/70">Scanned items are added straight away. Tap Done when finished.</span>
        )}
      </div>
    </div>
  );
}
