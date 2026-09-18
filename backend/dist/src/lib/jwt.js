"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.expiresInToDate = expiresInToDate;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN ||
    "15m");
const REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN ||
    "7d");
if (!ACCESS_SECRET || !REFRESH_SECRET) {
    throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in the environment");
}
function signAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
}
function signRefreshToken(payload) {
    return jsonwebtoken_1.default.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}
function verifyAccessToken(token) {
    return jsonwebtoken_1.default.verify(token, ACCESS_SECRET);
}
function verifyRefreshToken(token) {
    return jsonwebtoken_1.default.verify(token, REFRESH_SECRET);
}
// Converts "7d" / "15m" style strings into a millisecond duration,
// used to compute the RefreshToken row's expiresAt.
function expiresInToDate(expiresIn) {
    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    const now = Date.now();
    if (!match) {
        // fallback: treat as seconds
        return new Date(now + Number(expiresIn || 604800) * 1000);
    }
    const value = Number(match[1]);
    const unit = match[2];
    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
    };
    return new Date(now + value * multipliers[unit]);
}
