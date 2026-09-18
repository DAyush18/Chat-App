"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const role_1 = require("../middleware/role");
const user_controller_1 = require("../controllers/user.controller");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Any authenticated user can view the user list (needed for chat participant display).
router.get("/", user_controller_1.listUsers);
// Only ADMIN can change roles.
router.patch("/:id/role", (0, role_1.requireRole)(client_1.Role.ADMIN), user_controller_1.changeUserRole);
exports.default = router;
