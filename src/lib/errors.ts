/**
 * What to show staff or customers when something fails. The database's own messages are written for people
 * ("That discount is more than your limit of 5%") and pass through; anything technical (a constraint name,
 * a column, a dropped connection) becomes a plain sentence instead.
 */
type ErrorLike = { code?: string; message?: string; details?: string | null } | null | undefined;

const TECHNICAL =
  /violates|constraint|duplicate key|relation "|column "|syntax|null value|invalid input|function |permission denied for|PGRST|JWT|schema|operator|cannot cast|out of range|deadlock|statement timeout|uuid|zip file|central directory|unexpected token|undefined|is not a function|cannot read prop/i;

export function friendlyError(
  error: ErrorLike,
  fallback = "That didn't save. Try again, and tell us if it keeps happening.",
) {
  if (!error) return fallback;
  const message = (error.message ?? "").trim();
  const text = `${message} ${error.details ?? ""}`;

  switch (error.code) {
    case "23505": // unique
      if (/email/i.test(text)) return "That email address is already used.";
      if (/barcode/i.test(text)) return "That barcode is already used by another item.";
      if (/code/i.test(text)) return "That code is already used. Choose another.";
      if (/name/i.test(text)) return "That name is already used. Choose another.";
      return "That already exists.";
    case "23503": // still referenced
      return "It's still used elsewhere, so it can't be changed or removed.";
    case "23514": // check
      return "One of the values isn't allowed. Check the numbers and try again.";
    case "23502": // not null
      return "Something required is missing. Fill in every required field.";
    case "22P02":
    case "22003":
    case "22007":
      return "One of the values isn't in the right format. Check the numbers and dates.";
    case "40P01":
    case "40001":
      return "The system was busy. Try again.";
    case "57014":
      return "That took too long. Try again.";
    case "PGRST116":
      return "That couldn't be found. It may have been removed.";
  }
  if (/fetch failed|failed to fetch|network|ECONNREFUSED|ETIMEDOUT/i.test(message)) {
    return "Couldn't reach the server. Check the internet connection and try again.";
  }
  if (/permission denied|row-level security/i.test(message)) return "You don't have permission to do that.";
  if (!message || TECHNICAL.test(message)) return fallback;
  return message;
}
