import type { NextFunction, Request, Response } from "express";
import { db } from "./db.js";
import { hasAtLeast } from "./domain.js";
import { HttpError } from "./util.js";
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

export function isChurchManager(role: string): boolean {
  return hasAtLeast(role, "pastor");
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
      "Only that department's leader, a pastor, or the super admin can do this",
    );
  }
}

export function requireChurchManager() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new HttpError(401, "Authentication required"));
    if (!isChurchManager(req.user.role)) {
      return next(
        new HttpError(403, "Only pastors and administrators can do this"),
      );
    }
    next();
  };
}
