import type { Role } from "./domain.js";

export type OfficeDefinition = {
  value: Role;
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
  {
    value: "none",
    label: "Not in this department",
    summary: "Removed from the department. Department access is taken away.",
  },
  {
    value: "member",
    label: "Department member",
    summary: "Listed in the department room only.",
  },
  {
    value: "worker",
    label: "Department worker",
    summary: "Serves in the department. Does not manage meetings or tasks.",
  },
  {
    value: "leader",
    label: "Leader",
    summary: "Manages that department’s meetings, tasks, attendance reviews, and room.",
  },
  {
    value: "hod",
    label: "HOD",
    summary: "Same department-leader access as Leader.",
  },
  {
    value: "head",
    label: "Head",
    summary: "Same department-leader access as Leader.",
  },
  {
    value: "chairman",
    label: "Chairman",
    summary: "Same department-leader access as Leader.",
  },
] as const;

export const PRIVILEGED_ROLES: Role[] = ["pastor", "admin", "super_admin"];
export const NON_PRIVILEGED_ROLES: Role[] = ["member", "worker"];

export function officeFor(role: string): OfficeDefinition {
  return OFFICES.find((o) => o.value === role) ?? OFFICES[0];
}

export function isPrivilegedRole(role: string): boolean {
  return PRIVILEGED_ROLES.includes(role as Role);
}
