import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/business";
import { formatDateTime } from "@/lib/dates";
import { formatQty } from "@/lib/quantity";
import { getStaffNames } from "@/lib/staff-names";
import { getTransfer, itemLabel } from "../data";
import { PrintButton } from "@/components/print-button";

export default async function DispatchNotePage({ params }: PageProps<"/app/transfers/[id]/note">) {
  await requireStaff();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [t, business] = await Promise.all([getTransfer(id), getBusinessSettings()]);
  if (!t || !t.dispatched_at) notFound();
  const names = await getStaffNames([t.dispatched_by]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/app/transfers/${t.id}`} className="text-muted text-sm hover:underline">
          ← Back to transfer
        </Link>
        <PrintButton />
      </div>

      <article className="bg-white p-8 text-sm text-black shadow print:p-0 print:shadow-none">
        <style>{`@media print { @page { size: A4; margin: 15mm; } html, body { background: white !important; } }`}</style>
        <header className="flex items-start justify-between gap-4 border-b border-black pb-4">
          <div>
            <p className="text-lg font-bold">{business.name}</p>
            {business.address && <p>{business.address}</p>}
            {business.phone && <p>{business.phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">DISPATCH NOTE</p>
            <p className="font-mono">{t.number}</p>
            <p>{formatDateTime(t.dispatched_at)}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 py-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-600 uppercase">From</p>
            <p className="font-semibold">{t.from.name}</p>
            {t.from.address && <p>{t.from.address}</p>}
            {t.from.phone && <p>{t.from.phone}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-600 uppercase">To</p>
            <p className="font-semibold">{t.to.name}</p>
            {t.to.address && <p>{t.to.address}</p>}
            {t.to.phone && <p>{t.to.phone}</p>}
          </div>
        </section>
        {(t.note || t.dispatch_note) && (
          <p className="pb-4">Note: {[t.note, t.dispatch_note].filter(Boolean).join(" · ")}</p>
        )}

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-black text-left">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Code</th>
              <th className="py-2 pr-2">Item</th>
              <th className="py-2 pr-2">Batch</th>
              <th className="py-2 pr-2 text-right">Qty sent</th>
              <th className="py-2 text-right">Qty received</th>
            </tr>
          </thead>
          <tbody>
            {t.transfer_items.map((item, i) => (
              <tr key={item.id} className="border-b border-gray-300">
                <td className="py-2 pr-2">{i + 1}</td>
                <td className="py-2 pr-2 font-mono">{item.skus.code}</td>
                <td className="py-2 pr-2">{itemLabel(item.skus)}</td>
                <td className="py-2 pr-2">{item.batch || "—"}</td>
                <td className="py-2 pr-2 text-right tabular-nums">
                  {formatQty(Number(item.dispatched_quantity))} {item.skus.products.units.abbreviation}
                </td>
                <td className="py-2 text-right">
                  {item.received_quantity !== null ? formatQty(Number(item.received_quantity)) : "________"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td colSpan={4} className="py-2">
                Total quantity
              </td>
              <td className="py-2 pr-2 text-right tabular-nums">
                {formatQty(t.transfer_items.reduce((s, i) => s + Number(i.dispatched_quantity), 0))}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>

        <section className="mt-12 grid grid-cols-3 gap-6">
          {[
            ["Dispatched by", names.get(t.dispatched_by ?? "") ?? ""],
            ["Driver", ""],
            ["Received by", ""],
          ].map(([role, name]) => (
            <div key={role}>
              <p className="text-xs font-semibold tracking-wide text-gray-600 uppercase">{role}</p>
              <p className="mt-6 border-b border-black pb-1">{name || " "}</p>
              <p className="text-xs text-gray-600">Name</p>
              <p className="mt-6 border-b border-black"> </p>
              <p className="text-xs text-gray-600">Signature &amp; date</p>
            </div>
          ))}
        </section>
        <p className="mt-8 text-xs text-gray-600">
          Receiver: check every item before signing. Record anything missing or damaged when confirming the transfer in
          the system.
        </p>
      </article>
    </div>
  );
}
