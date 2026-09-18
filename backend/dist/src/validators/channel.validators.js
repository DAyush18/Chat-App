"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeRoleSchema = exports.muteUserSchema = exports.sendMessageSchema = exports.updateChannelSchema = exports.createChannelSchema = void 0;
const zod_1 = require("zod");
//control Channel create , Updaate , Delete
exports.createChannelSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(60),
    description: zod_1.z.string().trim().max(300).optional(),
    isPrivate: zod_1.z.boolean().optional().default(false),
});
exports.updateChannelSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(60).optional(),
    description: zod_1.z.string().trim().max(300).optional(),
    isPrivate: zod_1.z.boolean().optional(),
});
exports.sendMessageSchema = zod_1.z.object({
    content: zod_1.z.string().trim().min(1, "Message cannot be empty").max(2000),
});
exports.muteUserSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1, "userId is required"),
});
exports.changeRoleSchema = zod_1.z.object({
    role: zod_1.z.enum(["ADMIN", "MODERATOR", "MEMBER"]),
});
