import type { NextFunction, Request, Response } from "express";
import { db } from "./db.js";
import { hasAtLeast, type Role } from "./domain.js";
import { HttpError, newId } from "./util.js";
import { isPrivilegedRole, NON_PRIVILEGED_ROLES } from "./offices.js";
import type { AuthUser } from "./auth.js";

export const LEADER_POSITIONS = new Set(["leader", "hod", "head", "chairman"]);

export type LedDepartment = {
  id: string;
  name: string;
  slug: string;
  position: string;
};

export function isLeaderPosition(position?: string | null): boolean {
  return LEADER_POSITIONS.has((position ?? "").trim().toLowerCase());
}

export function configuredAdminEmail(): string {
  return (process.env.ADMIN_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL || "").toLowerCase();
}

export function isSuperAdmin(role: string): boolean {
  return role === "super_admin";
}

/** Church-wide operations. Pastors are shepherds, not system managers. */
export function isChurchManager(role: string): boolean {
  return hasAtLeast(role, "admin");
}

export function isShepherd(role: string): boolean {
  return hasAtLeast(role, "pastor");
}

export function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (isSuperAdmin(actorRole)) return true;
  return NON_PRIVILEGED_ROLES.includes(targetRole as Role);
}

export function assertCanAssignRole(actorRole: string, targetRole: string): void {
  if (!canAssignRole(actorRole, targetRole)) {
    throw new HttpError(
      403,
      "Only the super admin can grant pastor, admin, or super admin access",
    );
  }
}

export function assertCanChangeMemberRole(
  actorRole: string,
  currentRole: string,
  nextRole: string,
): void {
  if (isSuperAdmin(actorRole)) return;
  if (isPrivilegedRole(currentRole) || isPrivilegedRole(nextRole)) {
    throw new HttpError(
      403,
      "Only the super admin can grant or change pastor, admin, or super admin access",
    );
  }
  assertCanAssignRole(actorRole, nextRole);
}

export function canAppointDepartmentLeader(role: string): boolean {
  return isSuperAdmin(role);
}

export function assertCanAppointDepartmentLeader(role: string): void {
  if (!canAppointDepartmentLeader(role)) {
    throw new HttpError(403, "Only the super admin can appoint a department leader");
  }
}

export async function assertNotLastSuperAdmin(
  memberId: string,
  nextRole: string,
): Promise<void> {
  if (nextRole === "super_admin") return;
  const row = (await db.prepare("SELECT role FROM members WHERE id = ?").get(memberId)) as
    | { role: string }
    | undefined;
  if (row?.role !== "super_admin") return;
  const count = (await db
    .prepare("SELECT COUNT(*)::int AS c FROM members WHERE role = 'super_admin'")
    .get()) as { c: number };
  if (count.c <= 1) {
    throw new HttpError(400, "Cannot remove the last super admin");
  }
}

export async function getLedDepartments(memberId: string): Promise<LedDepartment[]> {
  const rows = (await db
    .prepare(
      `SELECT d.id, d.name, d.slug, dm.position
       FROM department_members dm
       JOIN departments d ON d.id = dm.department_id
       WHERE dm.member_id = ?`,
    )
    .all(memberId)) as LedDepartment[];
  return rows.filter((row) => isLeaderPosition(row.position));
}

export async function canViewMemberDirectory(user: AuthUser): Promise<boolean> {
  if (isShepherd(user.role)) return true;
  const led = await getLedDepartments(user.id);
  return led.length > 0;
}

export async function canManageDepartment(
  user: AuthUser,
  departmentId: string | null | undefined,
): Promise<boolean> {
  if (isChurchManager(user.role)) return true;
  const led = await getLedDepartments(user.id);
  if (!departmentId) return led.some((d) => d.slug === "all-workers");
  return led.some((d) => d.id === departmentId);
}

export async function assertCanManageDepartment(
  user: AuthUser,
  departmentId: string | null | undefined,
): Promise<void> {
  if (!(await canManageDepartment(user, departmentId))) {
    throw new HttpError(
      403,
      "Only that department's leader, an administrator, or the super admin can do this",
    );
  }
}

export async function syncDepartmentMembership(
  departmentId: string,
  memberId: string,
  position: string | null,
): Promise<void> {
  const pos = (position ?? "").trim().toLowerCase();
  if (!pos || pos === "none") {
    await db
      .prepare("DELETE FROM department_members WHERE department_id = ? AND member_id = ?")
      .run(departmentId, memberId);
    return;
  }
  if (isLeaderPosition(pos)) {
    await db
      .prepare(
        `UPDATE department_members SET position = 'member'
         WHERE department_id = ?
           AND lower(position) IN ('leader','hod','head','chairman')
           AND member_id != ?`,
      )
      .run(departmentId, memberId);
  }
  const existing = (await db
    .prepare("SELECT id FROM department_members WHERE department_id = ? AND member_id = ?")
    .get(departmentId, memberId)) as { id: string } | undefined;
  if (existing) {
    await db.prepare("UPDATE department_members SET position = ? WHERE id = ?").run(pos, existing.id);
  } else {
    await db
      .prepare(
        "INSERT INTO department_members (id, department_id, member_id, position) VALUES (?, ?, ?, ?)",
      )
      .run(newId("dmb"), departmentId, memberId, pos);
  }
}

export function requireChurchManager() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new HttpError(401, "Authentication required"));
    if (!isChurchManager(req.user.role)) {
      return next(new HttpError(403, "Only administrators can do this"));
    }
    next();
  };
}

export function requireSuperAdmin() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new HttpError(401, "Authentication required"));
    if (!isSuperAdmin(req.user.role)) {
      return next(new HttpError(403, "Only the super admin can do this"));
    }
    next();
  };
}
