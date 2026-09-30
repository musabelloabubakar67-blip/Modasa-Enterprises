// All dates are shown in the business's time zone, not the server's (which is UTC when deployed).
export const BUSINESS_TIME_ZONE = "Africa/Lagos";

export function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BUSINESS_TIME_ZONE,
  });
}

export function formatDate(value: string | Date) {
  // Plain dates ("2026-09-30") are calendar days; parse at noon so no time zone shifts the day.
  const date =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return date.toLocaleDateString("en-NG", { dateStyle: "medium", timeZone: BUSINESS_TIME_ZONE });
}

/** Today's date (YYYY-MM-DD) in the business time zone. */
export function todayInBusinessZone() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE }).format(new Date());
}
