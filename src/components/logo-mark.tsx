/**
 * The business's logo mark (the twin peaks). Takes the current text colour.
 * To change the mark everywhere — website, staff screens and receipts — replace the two paths.
 */
export function LogoMark({ className = "h-7 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 40" aria-hidden="true" className={`shrink-0 ${className}`} fill="currentColor">
      <path d="M0 40 17 10l8.9 15.8L19.2 40Z" opacity=".72" />
      <path d="M22 40 40 2l20 38Z" />
    </svg>
  );
}
