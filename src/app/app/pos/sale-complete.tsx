"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { getSaleShare, type SaleShare } from "../sales/actions";

export function SaleComplete({
  saleId,
  currency,
  onNewSale,
}: {
  saleId: string;
  currency: string;
  onNewSale: () => void;
}) {
  const [share, setShare] = useState<SaleShare | null>(null);

  useEffect(() => {
    getSaleShare(saleId).then(setShare);
  }, [saleId]);

  return (
    <div className="mx-auto max-w-md space-y-4 py-8 text-center">
      <p className="text-success text-5xl" aria-hidden="true">
        ✓
      </p>
      <h2 className="text-2xl font-semibold">Sale complete</h2>
      {share && (
        <p className="text-muted">
          {share.number} · {formatMoney(share.total_kobo, currency)}
          {share.change_kobo > 0 && (
            <strong className="text-foreground block text-lg">
              Change: {formatMoney(share.change_kobo, currency)}
            </strong>
          )}
        </p>
      )}
      <div className="grid gap-2">
        <a
          href={`/app/sales/${saleId}/receipt?print=1`}
          target="_blank"
          rel="noopener"
          className="btn btn-secondary py-3"
        >
          Print receipt
        </a>
        {share?.whatsapp_url && (
          <a href={share.whatsapp_url} target="_blank" rel="noopener" className="btn btn-secondary py-3">
            Send receipt on WhatsApp
          </a>
        )}
        <button type="button" className="btn btn-primary py-3 text-base" onClick={onNewSale} autoFocus>
          New sale
        </button>
        <Link href={`/app/sales/${saleId}`} className="text-muted text-sm hover:underline">
          View sale
        </Link>
      </div>
    </div>
  );
}
