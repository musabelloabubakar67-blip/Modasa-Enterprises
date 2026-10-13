import type { Metadata } from "next";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { whatsappNumber } from "@/lib/phone";
import { deliveryAreas, getStorefront } from "@/lib/shop/data";

export const metadata: Metadata = { title: "Delivery, collection & returns" };

export default async function HelpPage() {
  const [shop, areas] = await Promise.all([getStorefront(), deliveryAreas()]);
  const whatsapp = shop.whatsapp ? `https://wa.me/${whatsappNumber(shop.whatsapp)}` : null;

  return (
    <div className="shop-wrap max-w-[860px] py-10 md:py-14">
      <h1 className="font-serif text-[clamp(32px,4vw,48px)] leading-[1.1]">Delivery, collection &amp; returns</h1>

      <section id="collection" className="border-border mt-10 scroll-mt-40 border-t pt-8">
        <h2 className="font-serif text-2xl">Collecting from a shop</h2>
        <p className="mt-3">
          Collection is free. At checkout you choose the shop, and we tell you whether your order is ready today or
          needs to come from our warehouse first (usually {shop.leadTime}). Bring your order number when you come;
          someone else can collect for you if they have it.
        </p>
        <Link href="/our-shops" className="shop-link mt-3 inline-block text-sm">
          Shop addresses and opening hours
        </Link>
      </section>

      <section id="delivery" className="border-border mt-10 scroll-mt-40 border-t pt-8">
        <h2 className="font-serif text-2xl">Delivery</h2>
        {areas.length === 0 ? (
          <p className="mt-3">We don&apos;t deliver at the moment. Please collect from a shop.</p>
        ) : (
          <>
            <p className="mt-3">We deliver to the areas below. After you order we call you to agree a day and time.</p>
            <table className="mt-5 w-full text-sm">
              <thead>
                <tr className="caps text-muted border-border border-b text-left">
                  <th className="py-2 font-normal">Area</th>
                  <th className="py-2 text-right font-normal">Fee</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {areas.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2.5">{a.name}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatMoney(a.fee, shop.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-muted mt-3 text-sm">Somewhere else? Message us and we will see what we can do.</p>
          </>
        )}
      </section>

      <section id="payment" className="border-border mt-10 scroll-mt-40 border-t pt-8">
        <h2 className="font-serif text-2xl">Paying</h2>
        <p className="mt-3">
          Orders are paid for online by card, bank transfer or USSD through Paystack. We hold your items for a short
          time while you pay, and you get a link to follow your order.
        </p>
      </section>

      <section id="returns" className="border-border mt-10 scroll-mt-40 border-t pt-8">
        <h2 className="font-serif text-2xl">Returns</h2>
        <p className="mt-3">
          {shop.returnsNote ?? "Please contact us if something isn't right with your order and we will put it right."}
        </p>
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noreferrer" className="shop-link mt-3 inline-block text-sm">
            Message us on WhatsApp
          </a>
        )}
      </section>
    </div>
  );
}
