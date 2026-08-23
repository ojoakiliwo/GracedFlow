import { HttpError } from "./util.js";

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

/**
 * Currencies Paystack can collect when the dashboard has “Accept international
 * payments” enabled. This church’s live Paystack account is Naira-only unless
 * `PAYSTACK_INTERNATIONAL=true` is set after that dashboard switch.
 */
export const PAYSTACK_INTERNATIONAL_CURRENCIES = new Set<string>([
  "NGN",
  "USD",
  "GHS",
  "KES",
  "ZAR",
]);

/** Default: NGN only — foreign cards otherwise hit “not enabled for international”. */
export const PAYSTACK_CURRENCIES = new Set<string>(["NGN"]);

export function paystackInternationalEnabled(): boolean {
  const value = (process.env.PAYSTACK_INTERNATIONAL ?? "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

export function isGivingCurrency(code: string): code is GivingCurrency {
  return GIVING_CURRENCIES.some((c) => c.code === code);
}

export function normalizeGivingCurrency(code?: string | null): GivingCurrency {
  const value = (code ?? DEFAULT_GIVING_CURRENCY).trim().toUpperCase();
  if (!isGivingCurrency(value)) {
    throw new HttpError(
      400,
      "Choose a supported currency: NGN, USD, GBP, EUR, CAD, GHS, KES or ZAR",
    );
  }
  return value;
}

export function toPaystackAmount(amountMajor: number, _currency: string): number {
  return Math.round(amountMajor * 100);
}

export function paystackSupportsCurrency(currency: string): boolean {
  if (currency === "NGN") return true;
  if (!paystackInternationalEnabled()) return false;
  return PAYSTACK_INTERNATIONAL_CURRENCIES.has(currency);
}

export function paystackCollectableCurrencies(): string[] {
  return GIVING_CURRENCIES.map((c) => c.code).filter((code) => paystackSupportsCurrency(code));
}
