/** Nigerian numbers typed locally (0803…) become international (234803…) for WhatsApp links. */
export function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11) return `234${digits.slice(1)}`;
  return digits;
}
