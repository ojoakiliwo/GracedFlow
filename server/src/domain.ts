export const ROLES = [
  "super_admin",
  "admin",
  "pastor",
  "worker",
  "member",
] as const;
export type Role = (typeof ROLES)[number];

// Higher number = more privilege.
export const ROLE_RANK: Record<Role, number> = {
  member: 1,
  worker: 2,
  pastor: 3,
  admin: 4,
  super_admin: 5,
};

export const SPIRITUAL_CLASSES = [
  { value: "new_convert", label: "New Convert" },
  { value: "new_believer", label: "New Believer" },
  { value: "growing", label: "Growing" },
  { value: "established", label: "Established / Born Again" },
  { value: "worker", label: "General Worker" },
  { value: "choir", label: "Choir" },
  { value: "leader", label: "Leader" },
] as const;

export const MEMBERSHIP_STATUSES = ["visitor", "new", "active", "inactive"] as const;

export const DONATION_TYPES = [
  "tithe",
  "offering",
  "donation",
  "seed",
  "building",
  "missions",
  "welfare",
] as const;

export const PROJECT_STATUSES = ["vision", "ongoing", "done"] as const;

export const SOCIAL_PLATFORMS = [
  "facebook",
  "twitter",
  "instagram",
  "youtube",
  "telegram",
  "whatsapp",
] as const;

export function hasAtLeast(role: string, min: Role): boolean {
  const r = ROLE_RANK[role as Role] ?? 0;
  return r >= ROLE_RANK[min];
}
