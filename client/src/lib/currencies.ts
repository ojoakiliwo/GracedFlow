export const DEFAULT_GIVING_CURRENCY = "NGN";

export const GIVING_CURRENCIES = [
  { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$" },
  { code: "GHS", name: "Ghana Cedi", symbol: "GH₵" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
] as const;

export type GivingCurrency = (typeof GIVING_CURRENCIES)[number]["code"];

export function money(amount?: number | null, currency = DEFAULT_GIVING_CURRENCY): string {
  const value = amount ?? 0;
  const code = (currency || DEFAULT_GIVING_CURRENCY).toUpperCase();
  try {
    return new Intl.NumberFormat(code === "NGN" ? "en-NG" : "en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: code === "NGN" ? 0 : 2,
      minimumFractionDigits: code === "NGN" ? 0 : 2,
    }).format(value);
  } catch {
    return `${code} ${value}`;
  }
}
