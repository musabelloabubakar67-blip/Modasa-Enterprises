"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/form";
import { toMoneyInput } from "@/lib/money";
import { PRODUCT_IMAGES_BUCKET, productImageUrl } from "@/lib/products";
import { resizeImage } from "@/lib/resize-image";
import { createClient } from "@/lib/supabase/client";
import { saveDeliveryArea, setHeroImage, updateWebsite } from "../actions";

type WebsiteSettings = {
  storefront_enabled: boolean;
  storefront_name: string | null;
  tagline: string | null;
  hero_title: string | null;
  hero_text: string | null;
  whatsapp_number: string | null;
  opening_hours: string | null;
  order_lead_time: string;
  order_hold_minutes: number;
};

export function WebsiteForm({ settings }: { settings: WebsiteSettings }) {
  return (
    <ActionForm action={updateWebsite} className="card space-y-4 p-6">
      {(state) => {
        const errors = state.fieldErrors ?? {};
        return (
          <>
            <FormMessage state={state} />
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="storefront_enabled"
                className="mt-1"
                defaultChecked={settings.storefront_enabled}
              />
              <span>
                Online shop is open
                <span className="text-muted block text-xs">
                  Untick to stop taking online orders (for example over a holiday). Customers see a closed notice;
                  existing orders can still be followed.
                </span>
              </span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Shop name on the website"
                name="storefront_name"
                error={errors.storefront_name}
                hint="Short brand name shown beside the logo. Leave empty to use the business name."
              >
                <input
                  id="storefront_name"
                  name="storefront_name"
                  className="input"
                  defaultValue={settings.storefront_name ?? ""}
                />
              </Field>
              <Field label="Tagline" name="tagline" error={errors.tagline} hint="Shown under the name.">
                <input id="tagline" name="tagline" className="input" defaultValue={settings.tagline ?? ""} />
              </Field>
              <Field
                label="Home page headline"
                name="hero_title"
                error={errors.hero_title}
                hint="A few words, over the main photo."
              >
                <input id="hero_title" name="hero_title" className="input" defaultValue={settings.hero_title ?? ""} />
              </Field>
              <Field label="Line under the headline" name="hero_text" error={errors.hero_text}>
                <input id="hero_text" name="hero_text" className="input" defaultValue={settings.hero_text ?? ""} />
              </Field>
              <Field
                label="WhatsApp number"
                name="whatsapp_number"
                error={errors.whatsapp_number}
                hint="Customers message this number with questions."
              >
                <input
                  id="whatsapp_number"
                  name="whatsapp_number"
                  className="input"
                  inputMode="tel"
                  defaultValue={settings.whatsapp_number ?? ""}
                />
              </Field>
              <Field
                label="Opening hours"
                name="opening_hours"
                error={errors.opening_hours}
                hint="e.g. Mon–Sat 9am–7pm."
              >
                <input
                  id="opening_hours"
                  name="opening_hours"
                  className="input"
                  defaultValue={settings.opening_hours ?? ""}
                />
              </Field>
              <Field
                label="Time to bring items from a warehouse"
                name="order_lead_time"
                error={errors.order_lead_time}
                hint="Shown as “Available to order · …” on items no shop has."
              >
                <input
                  id="order_lead_time"
                  name="order_lead_time"
                  className="input"
                  defaultValue={settings.order_lead_time}
                  required
                />
              </Field>
              <Field
                label="Minutes to hold items while a customer pays"
                name="order_hold_minutes"
                error={errors.order_hold_minutes}
                hint="Unpaid orders release their stock after this."
              >
                <input
                  id="order_hold_minutes"
                  name="order_hold_minutes"
                  className="input"
                  inputMode="numeric"
                  defaultValue={String(settings.order_hold_minutes)}
                  required
                />
              </Field>
            </div>
            <SubmitButton>Save website settings</SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}

/** The large photo behind the home page headline. */
export function HeroPhoto({ image }: { image: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      if (!file.type.startsWith("image/")) throw new Error("Choose a photo.");
      const blob = await resizeImage(file, 2400);
      const path = `site/hero-${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await createClient()
        .storage.from(PRODUCT_IMAGES_BUCKET)
        .upload(path, blob, { contentType: "image/webp" });
      if (uploadError) throw uploadError;
      const result = await setHeroImage(path);
      if (result.error) throw new Error(result.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
      startTransition(() => router.refresh());
    }
  }

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Home page photo</h2>
          <p className="text-muted mt-1 text-sm">A wide, bright photo of a finished room works best.</p>
        </div>
        <label className={`btn btn-secondary shrink-0 ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? "Working…" : image ? "Replace photo" : "Add photo"}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="bg-danger/10 text-danger mt-3 rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={productImageUrl(image)} alt="" className="mt-4 aspect-[5/2] w-full rounded-md object-cover" />
      )}
    </section>
  );
}

type Area = { id: string; name: string; fee_kobo: number; sort_order: number; is_active: boolean };

export function DeliveryAreaForm({ area, currency }: { area?: Area; currency: string }) {
  const prefix = area?.id ?? "new-area";
  return (
    <ActionForm action={saveDeliveryArea} resetOnSuccess={!area} className="space-y-3">
      {(state) => {
        const errors = state.fieldErrors ?? {};
        return (
          <>
            <FormMessage state={state} />
            {area && <input type="hidden" name="id" value={area.id} />}
            <div className="grid items-start gap-3 sm:grid-cols-[2fr_1fr_90px_auto]">
              <Field label="Area" name={`${prefix}-name`} error={errors.name}>
                <input id={`${prefix}-name`} name="name" className="input" defaultValue={area?.name} required />
              </Field>
              <Field label={`Fee (${currency})`} name={`${prefix}-fee`} error={errors.fee}>
                <input
                  id={`${prefix}-fee`}
                  name="fee"
                  className="input"
                  inputMode="decimal"
                  defaultValue={area ? toMoneyInput(area.fee_kobo) : ""}
                  required
                />
              </Field>
              <Field label="Order" name={`${prefix}-sort`} error={errors.sort_order}>
                <input
                  id={`${prefix}-sort`}
                  name="sort_order"
                  className="input"
                  inputMode="numeric"
                  defaultValue={String(area?.sort_order ?? 0)}
                />
              </Field>
              <div className="flex items-center gap-3 sm:pt-6">
                {area && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="is_active" defaultChecked={area.is_active} />
                    Active
                  </label>
                )}
                <SubmitButton className="btn btn-secondary">{area ? "Save" : "Add"}</SubmitButton>
              </div>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
