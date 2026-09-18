import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import {
  listChannels,
  getChannel,
  createChannel,
  updateChannel,
  deleteChannel,
  joinChannel,
  leaveChannel,
  listParticipants,
  muteUser,
  unmuteUser,
} from "../controllers/channel.controller";
import {
  listMessages,
  sendMessage,
  deleteMessage,
} from "../controllers/message.controller";

const router = Router();

router.use(authenticate);

// Channel CRUD — only ADMIN can create/update/delete.
router.get("/", listChannels);
router.get("/:id", getChannel);
router.post("/", requireRole(Role.ADMIN), createChannel);
router.patch("/:id", requireRole(Role.ADMIN), updateChannel);
router.delete("/:id", requireRole(Role.ADMIN), deleteChannel);

// Join / leave — any authenticated user (ADMIN, MODERATOR, MEMBER).
router.post("/:id/join", joinChannel);
router.post("/:id/leave", leaveChannel);
router.get("/:id/participants", listParticipants);

// Moderation — ADMIN and MODERATOR only.
router.post("/:id/mute", requireRole(Role.ADMIN, Role.MODERATOR), muteUser);
router.post("/:id/unmute", requireRole(Role.ADMIN, Role.MODERATOR), unmuteUser);

// Messages
router.get("/:id/messages", listMessages);
router.post("/:id/messages", sendMessage);
router.delete("/:channelId/messages/:messageId", deleteMessage);

export default router;
