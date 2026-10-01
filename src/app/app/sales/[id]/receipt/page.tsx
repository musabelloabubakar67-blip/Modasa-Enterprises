import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { getStaffNames } from "@/lib/staff-names";
import { ReceiptView } from "@/components/receipt-view";
import { PrintButton } from "@/components/print-button";
import { AutoPrint } from "./auto-print";
import { getReceiptById } from "../../receipt-data";

export default async function ReceiptPage({ params, searchParams }: PageProps<"/app/sales/[id]/receipt">) {
  await requireStaff(["owner", "manager", "cashier"]);
  const { id } = await params;
  const { print } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const [sale, business] = await Promise.all([getReceiptById(id), getBusinessSettings()]);
  if (!sale) notFound();
  const names = await getStaffNames([sale.cashier_id]);
  const cashier = sale.cashier_id ? names.get(sale.cashier_id)?.split(" ")[0] : undefined;

  return (
    <div className="space-y-4">
      <style>{`@media print { @page { size: 80mm auto; margin: 4mm; } html, body { background: white !important; } }`}</style>
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/app/sales/${id}`} className="text-muted text-sm hover:underline">
          ← Sale {sale.number}
        </Link>
        <PrintButton />
      </div>
      <div className="bg-white py-4 shadow print:py-0 print:shadow-none">
        <ReceiptView sale={sale} business={business} cashierName={cashier} />
      </div>
      {print && <AutoPrint />}
    </div>
  );
}
