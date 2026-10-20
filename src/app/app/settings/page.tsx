import { getBusinessSettings } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import { BusinessForm } from "./business-form";
import { TrainingReset } from "./training-reset";

export default async function BusinessSettingsPage() {
  const supabase = await createClient();
  const [business, { data: trainingCopy }] = await Promise.all([
    getBusinessSettings(),
    supabase.rpc("is_training_copy"),
  ]);
  return (
    <div className="space-y-6">
      <BusinessForm business={business} />
      {trainingCopy && <TrainingReset />}
    </div>
  );
}
