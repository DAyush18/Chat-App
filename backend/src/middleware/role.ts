import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";

/**
 * Restricts an endpoint to one or more roles. Must run after `authenticate`.
 * This is the backend enforcement layer — frontend button hiding is only cosmetic.
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    return next();
  };
}
