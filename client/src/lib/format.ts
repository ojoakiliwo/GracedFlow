import { money } from "./currencies";

export function fullName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(" ").trim() || "Unknown";
}

export function initials(first?: string | null, last?: string | null): string {
  return `${(first?.[0] ?? "").toUpperCase()}${(last?.[0] ?? "").toUpperCase()}` || "?";
}

export function naira(amount?: number | null): string {
  return money(amount, "NGN");
}

export const CHURCH_TIME_ZONE = "Africa/Lagos";

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: CHURCH_TIME_ZONE,
  });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CHURCH_TIME_ZONE,
  });
}

export function formatDateRange(start?: string | null, end?: string | null): string {
  if (!start) return "—";
  const from = new Date(start);
  if (Number.isNaN(from.getTime())) return start;
  const to = end ? new Date(end) : null;
  const dayFmt: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: CHURCH_TIME_ZONE,
  };
  const fromDay = from.toLocaleDateString("en-GB", dayFmt);
  if (!to || Number.isNaN(to.getTime())) return fromDay;
  const toDay = to.toLocaleDateString("en-GB", dayFmt);
  if (fromDay === toDay) return fromDay;
  const sameMonth =
    from.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: CHURCH_TIME_ZONE }) ===
    to.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: CHURCH_TIME_ZONE });
  if (sameMonth) {
    const fromDate = from.toLocaleDateString("en-GB", { day: "numeric", timeZone: CHURCH_TIME_ZONE });
    return `${fromDate}–${toDay}`;
  }
  return `${from.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: CHURCH_TIME_ZONE,
  })} – ${toDay}`;
}

export const SPIRITUAL_CLASSES = [
  { value: "new_convert", label: "New Convert" },
  { value: "new_believer", label: "New Believer" },
  { value: "growing", label: "Growing" },
  { value: "established", label: "Established / Born Again" },
  { value: "worker", label: "General Worker" },
  { value: "choir", label: "Choir" },
  { value: "leader", label: "Leader" },
];

export function classLabel(value?: string | null): string {
  return SPIRITUAL_CLASSES.find((c) => c.value === value)?.label ?? value ?? "—";
}

export const ROLES = [
  { value: "member", label: "Member" },
  { value: "worker", label: "Worker" },
  { value: "pastor", label: "Pastor" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
];

export function roleLabel(value?: string | null): string {
  return ROLES.find((r) => r.value === value)?.label ?? value ?? "—";
}
