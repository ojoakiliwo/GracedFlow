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

/** Paystack collections typically support these; others go through Flutterwave. */
export const PAYSTACK_CURRENCIES = new Set<string>(["NGN", "USD", "GHS", "KES", "ZAR"]);

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
  return PAYSTACK_CURRENCIES.has(currency);
}
