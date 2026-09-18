"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const role_1 = require("../middleware/role");
const channel_controller_1 = require("../controllers/channel.controller");
const message_controller_1 = require("../controllers/message.controller");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Channel CRUD — only ADMIN can create/update/delete.
router.get("/", channel_controller_1.listChannels);
router.get("/:id", channel_controller_1.getChannel);
router.post("/", (0, role_1.requireRole)(client_1.Role.ADMIN), channel_controller_1.createChannel);
router.patch("/:id", (0, role_1.requireRole)(client_1.Role.ADMIN), channel_controller_1.updateChannel);
router.delete("/:id", (0, role_1.requireRole)(client_1.Role.ADMIN), channel_controller_1.deleteChannel);
// Join / leave — any authenticated user (ADMIN, MODERATOR, MEMBER).
router.post("/:id/join", channel_controller_1.joinChannel);
router.post("/:id/leave", channel_controller_1.leaveChannel);
router.get("/:id/participants", channel_controller_1.listParticipants);
// Moderation — ADMIN and MODERATOR only.
router.post("/:id/mute", (0, role_1.requireRole)(client_1.Role.ADMIN, client_1.Role.MODERATOR), channel_controller_1.muteUser);
router.post("/:id/unmute", (0, role_1.requireRole)(client_1.Role.ADMIN, client_1.Role.MODERATOR), channel_controller_1.unmuteUser);
// Messages
router.get("/:id/messages", message_controller_1.listMessages);
router.post("/:id/messages", message_controller_1.sendMessage);
router.delete("/:channelId/messages/:messageId", message_controller_1.deleteMessage);
exports.default = router;
