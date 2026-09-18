"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
/**
 * Restricts an endpoint to one or more roles. Must run after `authenticate`.
 * This is the backend enforcement layer — frontend button hiding is only cosmetic.
 */
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: "Forbidden: insufficient role" });
        }
        return next();
    };
}
