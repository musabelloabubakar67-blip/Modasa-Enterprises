import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Footer } from "@/components/shop/footer";
import { Header } from "@/components/shop/header";
import { getStorefront } from "@/lib/shop/data";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], style: ["normal", "italic"] });

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getStorefront();
  return {
    title: { default: `${shop.brand} · ${shop.tagline ?? "Online shop"}`, template: `%s · ${shop.brand}` },
    description:
      shop.heroText ?? `Shop ${shop.businessName} online: pay securely, collect in store or have it delivered.`,
  };
}

// The public online shop. Its look is described in DESIGN.md.
export default async function ShopLayout({ children }: LayoutProps<"/">) {
  const shop = await getStorefront();
  return (
    <div className={`shop ${inter.variable} ${playfair.variable} flex min-h-full flex-1 flex-col`}>
      <Header shop={shop} />
      <main className="flex-1">{children}</main>
      <Footer shop={shop} />
    </div>
  );
}
