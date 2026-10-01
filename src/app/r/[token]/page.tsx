import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBusinessSettings } from "@/lib/business";
import { ReceiptView } from "@/components/receipt-view";
import { PrintButton } from "@/components/print-button";
import { getReceiptByToken } from "@/app/app/sales/receipt-data";

// Customers' receipt links: private (unguessable token) and never indexed by search engines.
export const metadata: Metadata = { title: "Your receipt", robots: { index: false, follow: false } };

export default async function PublicReceiptPage({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  const [sale, business] = await Promise.all([getReceiptByToken(token), getBusinessSettings()]);
  if (!sale) notFound();

  return (
    <main className="flex-1 bg-white px-4 py-8">
      <style>{`@media print { @page { size: 80mm auto; margin: 4mm; } }`}</style>
      <ReceiptView sale={sale} business={business} />
      <div className="mt-6 text-center print:hidden">
        <PrintButton label="Print or save as PDF" />
      </div>
    </main>
  );
}
