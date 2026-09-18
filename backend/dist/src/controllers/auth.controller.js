"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.refresh = refresh;
exports.logout = logout;
exports.me = me;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const auth_validators_1 = require("../validators/auth.validators");
const jwt_1 = require("../lib/jwt");
function publicUser(user) {
    return { id: user.id, name: user.name, email: user.email, role: user.role };
}
async function register(req, res) {
    const parsed = auth_validators_1.registerSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
    }
    const { name, email, password } = parsed.data;
    const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (existing) {
        return res.status(409).json({ message: "A user with this email already exists" });
    }
    const hashed = await bcryptjs_1.default.hash(password, 12);
    // Role is always MEMBER on public registration. This is never
    // read from the request body — there is no role field accepted at all.
    const user = await prisma_1.prisma.user.create({
        data: {
            name,
            email,
            password: hashed,
            role: client_1.Role.MEMBER,
        },
    });
    return res.status(201).json({ user: publicUser(user) });
}
async function login(req, res) {
    const parsed = auth_validators_1.loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;
    const user = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
    }
    const valid = await bcryptjs_1.default.compare(password, user.password);
    if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
    }
    const accessToken = (0, jwt_1.signAccessToken)({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = (0, jwt_1.signRefreshToken)({ sub: user.id });
    await prisma_1.prisma.refreshToken.create({
        data: {
            token: refreshToken,
            userId: user.id,
            expiresAt: (0, jwt_1.expiresInToDate)(process.env.JWT_REFRESH_EXPIRES_IN || "7d"),
        },
    });
    return res.json({
        user: publicUser(user),
        accessToken,
        refreshToken,
    });
}
async function refresh(req, res) {
    const parsed = auth_validators_1.refreshSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
    }
    const { refreshToken } = parsed.data;
    let payload;
    try {
        payload = (0, jwt_1.verifyRefreshToken)(refreshToken);
    }
    catch {
        return res.status(401).json({ message: "Invalid or expired refresh token" });
    }
    const stored = await prisma_1.prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
        return res.status(401).json({ message: "Refresh token is no longer valid" });
    }
    const user = await prisma_1.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
        return res.status(401).json({ message: "User no longer exists" });
    }
    // Rotate refresh token: revoke old one, issue a new pair.
    const newRefreshToken = (0, jwt_1.signRefreshToken)({ sub: user.id });
    const newAccessToken = (0, jwt_1.signAccessToken)({ sub: user.id, email: user.email, role: user.role });
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } }),
        prisma_1.prisma.refreshToken.create({
            data: {
                token: newRefreshToken,
                userId: user.id,
                expiresAt: (0, jwt_1.expiresInToDate)(process.env.JWT_REFRESH_EXPIRES_IN || "7d"),
            },
        }),
    ]);
    return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
}
async function logout(req, res) {
    const parsed = auth_validators_1.refreshSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
    }
    const { refreshToken } = parsed.data;
    await prisma_1.prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revoked: true },
    });
    return res.status(204).send();
}
async function me(req, res) {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }
    return res.json({ user: publicUser(user) });
}
