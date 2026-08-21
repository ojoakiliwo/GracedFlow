export function fullName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(" ").trim() || "Unknown";
}

export function initials(first?: string | null, last?: string | null): string {
  return `${(first?.[0] ?? "").toUpperCase()}${(last?.[0] ?? "").toUpperCase()}` || "?";
}

export function naira(amount?: number | null): string {
  const value = amount ?? 0;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
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
  });
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
