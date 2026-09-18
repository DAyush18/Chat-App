"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsers = listUsers;
exports.changeUserRole = changeUserRole;
const prisma_1 = require("../lib/prisma");
const channel_validators_1 = require("../validators/channel.validators");
async function listUsers(_req, res) {
    const users = await prisma_1.prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: "asc" },
    });
    return res.json({ users });
}
async function changeUserRole(req, res) {
    const { id } = req.params;
    const requester = req.user;
    const parsed = channel_validators_1.changeRoleSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
    }
    if (id === requester.id) {
        return res.status(400).json({ message: "You cannot change your own role" });
    }
    const target = await prisma_1.prisma.user.findUnique({ where: { id } });
    if (!target) {
        return res.status(404).json({ message: "User not found" });
    }
    const updated = await prisma_1.prisma.user.update({
        where: { id },
        data: { role: parsed.data.role },
        select: { id: true, name: true, email: true, role: true },
    });
    return res.json({ user: updated });
}
