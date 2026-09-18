import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { listUsers, changeUserRole } from "../controllers/user.controller";

const router = Router();

router.use(authenticate);

// Any authenticated user can view the user list (needed for chat participant display).
router.get("/", listUsers);

// Only ADMIN can change roles.
router.patch("/:id/role", requireRole(Role.ADMIN), changeUserRole);

export default router;
