import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { config } from "./config.js";
import { db } from "./db.js";
import { hasAtLeast, type Role } from "./domain.js";
import { HttpError } from "./util.js";

export interface AuthUser {
  id: string;
  email: string | null;
  role: string;
  first_name: string;
  last_name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(user: AuthUser): string {
  const options = { expiresIn: config.jwtExpiresIn } as jwt.SignOptions;
  return jwt.sign(user, config.jwtSecret, options);
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new HttpError(401, "Authentication required"));
  }
  const token = header.slice("Bearer ".length);
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthUser & {
      iat: number;
      exp: number;
    };
    const row = db
      .prepare(
        "SELECT id, email, role, first_name, last_name, account_status FROM members WHERE id = ?",
      )
      .get(decoded.id) as (AuthUser & { account_status: string }) | undefined;
    if (!row || row.account_status !== "active") {
      return next(new HttpError(401, "Account is not active"));
    }
    req.user = {
      id: row.id,
      email: row.email,
      role: row.role,
      first_name: row.first_name,
      last_name: row.last_name,
    };
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired session"));
  }
}

export function requireRole(min: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new HttpError(401, "Authentication required"));
    if (!hasAtLeast(req.user.role, min)) {
      return next(new HttpError(403, "You do not have permission for this action"));
    }
    next();
  };
}
