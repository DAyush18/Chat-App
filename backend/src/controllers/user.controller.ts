import { Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { changeRoleSchema } from "../validators/channel.validators";

export async function listUsers(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return res.json({ users });
}

export async function changeUserRole(req: Request, res: Response) {
  const { id } = req.params;
  const requester = req.user!;

  const parsed = changeRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  if (id === requester.id) {
    return res.status(400).json({ message: "You cannot change your own role" });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return res.status(404).json({ message: "User not found" });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: parsed.data.role as Role },
    select: { id: true, name: true, email: true, role: true },
  });

  return res.json({ user: updated });
}
