"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
const jwt_1 = require("../lib/jwt");
const prisma_1 = require("../lib/prisma");
async function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Missing or invalid authorization header" });
    }
    const token = header.slice("Bearer ".length);
    try {
        const payload = (0, jwt_1.verifyAccessToken)(token);
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, email: true, role: true },
        });
        if (!user) {
            return res.status(401).json({ message: "User no longer exists" });
        }
        req.user = user;
        return next();
    }
    catch (err) {
        return res.status(401).json({ message: "Invalid or expired access token" });
    }
}
