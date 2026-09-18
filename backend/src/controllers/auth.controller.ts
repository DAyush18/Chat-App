import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
} from "../validators/auth.validators";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  expiresInToDate,
} from "../lib/jwt";

function publicUser(user: { id: string; name: string; email: string; role: Role }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ message: "A user with this email already exists" });
  }

  const hashed = await bcrypt.hash(password, 12);

  // Role is always MEMBER on public registration. This is never
  // read from the request body — there is no role field accepted at all.
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: Role.MEMBER,
    },
  });

  return res.status(201).json({ user: publicUser(user) });
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id });

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: expiresInToDate(process.env.JWT_REFRESH_EXPIRES_IN || "7d"),
    },
  });

  return res.json({
    user: publicUser(user),
    accessToken,
    refreshToken,
  });
}

export async function refresh(req: Request, res: Response) {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }
  const { refreshToken } = parsed.data;

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    return res.status(401).json({ message: "Refresh token is no longer valid" });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    return res.status(401).json({ message: "User no longer exists" });
  }

  // Rotate refresh token: revoke old one, issue a new pair.
  const newRefreshToken = signRefreshToken({ sub: user.id });
  const newAccessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });

  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } }),
    prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: expiresInToDate(process.env.JWT_REFRESH_EXPIRES_IN || "7d"),
      },
    }),
  ]);

  return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
}

export async function logout(req: Request, res: Response) {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }
  const { refreshToken } = parsed.data;

  await prisma.refreshToken.updateMany({
    where: { token: refreshToken },
    data: { revoked: true },
  });

  return res.status(204).send();
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  return res.json({ user: publicUser(user) });
}
