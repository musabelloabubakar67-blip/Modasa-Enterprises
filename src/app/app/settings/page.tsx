import { getBusinessSettings } from "@/lib/business";
import { BusinessForm } from "./business-form";

export default async function BusinessSettingsPage() {
  const business = await getBusinessSettings();
  return <BusinessForm business={business} />;
}
