"use client";

/** Ticks or unticks every product on the page (the boxes named "ids" in the same form). */
export function SelectAll() {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        onChange={(e) => {
          e.currentTarget.form
            ?.querySelectorAll<HTMLInputElement>("input[name=ids]")
            .forEach((box) => (box.checked = e.currentTarget.checked));
        }}
      />
      Select all on this page
    </label>
  );
}
