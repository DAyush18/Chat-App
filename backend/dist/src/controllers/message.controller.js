"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMessages = listMessages;
exports.sendMessage = sendMessage;
exports.deleteMessage = deleteMessage;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const channel_validators_1 = require("../validators/channel.validators");
const socket_1 = require("../socket");
async function listMessages(req, res) {
    const { id } = req.params; // channelId
    const channel = await prisma_1.prisma.channel.findUnique({ where: { id } });
    if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
    }
    const messages = await prisma_1.prisma.message.findMany({
        where: { channelId: id, deleted: false },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: "asc" },
        take: 200,
    });
    return res.json({ messages });
}
async function sendMessage(req, res) {
    const { id } = req.params; // channelId
    const userId = req.user.id;
    const parsed = channel_validators_1.sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
    }
    const channel = await prisma_1.prisma.channel.findUnique({ where: { id } });
    if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
    }
    const membership = await prisma_1.prisma.channelMember.findUnique({
        where: { userId_channelId: { userId, channelId: id } },
    });
    // Must have joined the channel to send messages.
    if (!membership || !membership.isActive) {
        return res.status(403).json({ message: "You must join this channel before sending messages" });
    }
    if (membership.isMuted) {
        return res.status(403).json({ message: "You are muted in this channel" });
    }
    const message = await prisma_1.prisma.message.create({
        data: {
            content: parsed.data.content,
            userId,
            channelId: id,
        },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    (0, socket_1.getIO)().to(`channel:${id}`).emit("new_message", { message });
    return res.status(201).json({ message });
}
async function deleteMessage(req, res) {
    const { channelId, messageId } = req.params;
    const requester = req.user;
    const message = await prisma_1.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.channelId !== channelId) {
        return res.status(404).json({ message: "Message not found" });
    }
    // ADMIN and MODERATOR can delete any message; MEMBER can delete only their own.
    const isOwner = message.userId === requester.id;
    const isModeratorOrAdmin = requester.role === client_1.Role.ADMIN || requester.role === client_1.Role.MODERATOR;
    if (!isOwner && !isModeratorOrAdmin) {
        return res.status(403).json({ message: "You cannot delete this message" });
    }
    await prisma_1.prisma.message.update({
        where: { id: messageId },
        data: { deleted: true, deletedAt: new Date() },
    });
    (0, socket_1.getIO)().to(`channel:${channelId}`).emit("message_deleted", { channelId, messageId });
    return res.status(204).send();
}
