import { redirect } from "next/navigation";

// The roll & tile calculator was taken off the website; old links go to the shop.
export default function CalculatorPage() {
  redirect("/shop");
}
