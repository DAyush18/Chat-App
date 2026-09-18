import { Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendMessageSchema } from "../validators/channel.validators";
import { getIO } from "../socket";

export async function listMessages(req: Request, res: Response) {
  const { id } = req.params; // channelId

  const channel = await prisma.channel.findUnique({ where: { id } });
  if (!channel) {
    return res.status(404).json({ message: "Channel not found" });
  }

  const messages = await prisma.message.findMany({
    where: { channelId: id, deleted: false },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return res.json({ messages });
}

export async function sendMessage(req: Request, res: Response) {
  const { id } = req.params; // channelId
  const userId = req.user!.id;

  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const channel = await prisma.channel.findUnique({ where: { id } });
  if (!channel) {
    return res.status(404).json({ message: "Channel not found" });
  }

  const membership = await prisma.channelMember.findUnique({
    where: { userId_channelId: { userId, channelId: id } },
  });

  // Must have joined the channel to send messages.
  if (!membership || !membership.isActive) {
    return res.status(403).json({ message: "You must join this channel before sending messages" });
  }
  if (membership.isMuted) {
    return res.status(403).json({ message: "You are muted in this channel" });
  }

  const message = await prisma.message.create({
    data: {
      content: parsed.data.content,
      userId,
      channelId: id,
    },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });

  getIO().to(`channel:${id}`).emit("new_message", { message });

  return res.status(201).json({ message });
}

export async function deleteMessage(req: Request, res: Response) {
  const { channelId, messageId } = req.params;
  const requester = req.user!;

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.channelId !== channelId) {
    return res.status(404).json({ message: "Message not found" });
  }

  // ADMIN and MODERATOR can delete any message; MEMBER can delete only their own.
  const isOwner = message.userId === requester.id;
  const isModeratorOrAdmin = requester.role === Role.ADMIN || requester.role === Role.MODERATOR;
  if (!isOwner && !isModeratorOrAdmin) {
    return res.status(403).json({ message: "You cannot delete this message" });
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { deleted: true, deletedAt: new Date() },
  });

  getIO().to(`channel:${channelId}`).emit("message_deleted", { channelId, messageId });

  return res.status(204).send();
}
