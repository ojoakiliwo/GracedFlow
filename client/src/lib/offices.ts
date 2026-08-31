export type OfficeRole = "member" | "worker" | "pastor" | "admin" | "super_admin";

export type OfficeDefinition = {
  value: OfficeRole;
  label: string;
  summary: string;
  grants: string[];
};

export const OFFICES: OfficeDefinition[] = [
  {
    value: "member",
    label: "Member",
    summary: "A person in the congregation. They use their own dashboard only.",
    grants: [
      "Sign in to their own record",
      "See their own tasks and department rooms they belong to",
    ],
  },
  {
    value: "worker",
    label: "Worker",
    summary: "A serving member. Access stays in their assigned department unless they are also made its leader.",
    grants: [
      "Worker dashboard and assigned tasks",
      "Department rooms they belong to",
      "No church-wide member, finance, or settings access",
    ],
  },
  {
    value: "pastor",
    label: "Pastor",
    summary: "Shepherds the flock. Does not receive full system access and cannot grant offices.",
    grants: [
      "View and add members as Member or Worker",
      "Record spiritual growth and pastoral care",
      "Prayer requests, events, projects, and pastoral messages",
      "Read department meeting reviews",
      "Manage a department only if appointed its leader",
    ],
  },
  {
    value: "admin",
    label: "Admin",
    summary: "Church operations (records, giving, broadcasts, integrations). Cannot grant full access.",
    grants: [
      "Everything a pastor can do",
      "Church-wide department meetings and tasks",
      "Giving records, automations, and social broadcast",
      "Settings tests and integration status",
      "Cannot grant pastor, admin, or super admin access",
    ],
  },
  {
    value: "super_admin",
    label: "Super Admin",
    summary: "The only office with full access, and the only office that can change anyone’s position.",
    grants: [
      "Everything in the app",
      "Grant or revoke every office and department leadership",
      "Delete members",
      "Appoint department leaders",
    ],
  },
];

export const DEPARTMENT_POSITIONS = [
  { value: "none", label: "Not in this department" },
  { value: "member", label: "Department member" },
  { value: "worker", label: "Department worker" },
  { value: "leader", label: "Leader" },
  { value: "hod", label: "HOD" },
  { value: "head", label: "Head" },
  { value: "chairman", label: "Chairman" },
] as const;

export const ASSIGNABLE_BY_STAFF = ["member", "worker"] as const;

export function officeFor(role?: string | null): OfficeDefinition {
  return OFFICES.find((o) => o.value === role) ?? OFFICES[0];
}

export function assignableOffices(actorRole?: string | null): OfficeDefinition[] {
  if (actorRole === "super_admin") return OFFICES;
  return OFFICES.filter((o) => ASSIGNABLE_BY_STAFF.includes(o.value as "member" | "worker"));
}
