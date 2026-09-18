"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
//control reg8stration
exports.registerSchema = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    email: zod_1.z.string().trim().email("Invalid email address"),
    password: zod_1.z.string().min(8, "Password must be at least 8 characters").max(100),
    confirmPassword: zod_1.z.string().min(8).max(100),
})
    .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email("Invalid email address"),
    password: zod_1.z.string().min(1, "Password is required"),
});
exports.refreshSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, "refreshToken is required"),
});
