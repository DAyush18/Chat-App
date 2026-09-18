"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listChannels = listChannels;
exports.getChannel = getChannel;
exports.createChannel = createChannel;
exports.updateChannel = updateChannel;
exports.deleteChannel = deleteChannel;
exports.joinChannel = joinChannel;
exports.leaveChannel = leaveChannel;
exports.listParticipants = listParticipants;
exports.muteUser = muteUser;
exports.unmuteUser = unmuteUser;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const channel_validators_1 = require("../validators/channel.validators");
const socket_1 = require("../socket");
async function listChannels(req, res) {
    const channels = await prisma_1.prisma.channel.findMany({
        include: {
            creator: { select: { id: true, name: true, email: true } },
            _count: { select: { members: { where: { isActive: true } } } },
        },
        orderBy: { createdAt: "asc" },
    });
    // Also tell the current user whether they've joined each channel.
    const memberships = await prisma_1.prisma.channelMember.findMany({
        where: { userId: req.user.id, isActive: true },
        select: { channelId: true },
    });
    const joinedSet = new Set(memberships.map((m) => m.channelId));
    return res.json({
        channels: channels.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            isPrivate: c.isPrivate,
            createdAt: c.createdAt,
            creator: c.creator,
            memberCount: c._count.members,
            joined: joinedSet.has(c.id),
        })),
    });
}
async function getChannel(req, res) {
    const { id } = req.params;
    const channel = await prisma_1.prisma.channel.findUnique({
        where: { id },
        include: {
            creator: { select: { id: true, name: true, email: true } },
            members: {
                where: { isActive: true },
                include: { user: { select: { id: true, name: true, email: true, role: true } } },
            },
        },
    });
    if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
    }
    return res.json({ channel });
}
async function createChannel(req, res) {
    const parsed = channel_validators_1.createChannelSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
    }
    const { name, description, isPrivate } = parsed.data;
    const existing = await prisma_1.prisma.channel.findUnique({ where: { name } });
    if (existing) {
        return res.status(409).json({ message: "A channel with this name already exists" });
    }
    const channel = await prisma_1.prisma.channel.create({
        data: {
            name,
            description,
            isPrivate,
            creatorId: req.user.id,
        },
    });
    return res.status(201).json({ channel });
}
async function updateChannel(req, res) {
    const { id } = req.params;
    const parsed = channel_validators_1.updateChannelSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
    }
    const channel = await prisma_1.prisma.channel.findUnique({ where: { id } });
    if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
    }
    const updated = await prisma_1.prisma.channel.update({
        where: { id },
        data: parsed.data,
    });
    return res.json({ channel: updated });
}
async function deleteChannel(req, res) {
    const { id } = req.params;
    const channel = await prisma_1.prisma.channel.findUnique({ where: { id } });
    if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
    }
    await prisma_1.prisma.channel.delete({ where: { id } });
    (0, socket_1.getIO)().to(`channel:${id}`).emit("channel_deleted", { channelId: id });
    return res.status(204).send();
}
async function joinChannel(req, res) {
    const { id } = req.params;
    const userId = req.user.id;
    const channel = await prisma_1.prisma.channel.findUnique({ where: { id } });
    if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
    }
    let membership;
    try {
        membership = await prisma_1.prisma.channelMember.upsert({
            where: { userId_channelId: { userId, channelId: id } },
            update: { isActive: true, leftAt: null },
            create: { userId, channelId: id },
            include: { user: { select: { id: true, name: true, email: true, role: true } } },
        });
    }
    catch (error) {
        if (!(error instanceof client_1.Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
            throw error;
        }
        membership = await prisma_1.prisma.channelMember.update({
            where: { userId_channelId: { userId, channelId: id } },
            data: { isActive: true, leftAt: null },
            include: { user: { select: { id: true, name: true, email: true, role: true } } },
        });
    }
    (0, socket_1.getIO)().to(`channel:${id}`).emit("member_joined", {
        channelId: id,
        user: membership.user,
    });
    return res.json({ membership });
}
async function leaveChannel(req, res) {
    const { id } = req.params;
    const userId = req.user.id;
    const membership = await prisma_1.prisma.channelMember.findUnique({
        where: { userId_channelId: { userId, channelId: id } },
    });
    if (!membership || !membership.isActive) {
        return res.status(400).json({ message: "You are not a member of this channel" });
    }
    await prisma_1.prisma.channelMember.update({
        where: { id: membership.id },
        data: { isActive: false, leftAt: new Date() },
    });
    (0, socket_1.getIO)().to(`channel:${id}`).emit("member_left", { channelId: id, userId });
    return res.status(204).send();
}
async function listParticipants(req, res) {
    const { id } = req.params;
    const members = await prisma_1.prisma.channelMember.findMany({
        where: { channelId: id, isActive: true },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { joinedAt: "asc" },
    });
    return res.json({
        participants: members.map((m) => ({
            ...m.user,
            isMuted: m.isMuted,
            joinedAt: m.joinedAt,
        })),
    });
}
async function muteUser(req, res) {
    const { id } = req.params; // channel id
    const { userId } = req.body;
    if (!userId)
        return res.status(400).json({ message: "userId is required" });
    const membership = await prisma_1.prisma.channelMember.findUnique({
        where: { userId_channelId: { userId, channelId: id } },
    });
    if (!membership || !membership.isActive) {
        return res.status(404).json({ message: "User is not an active member of this channel" });
    }
    const updated = await prisma_1.prisma.channelMember.update({
        where: { id: membership.id },
        data: { isMuted: true },
    });
    (0, socket_1.getIO)().to(`channel:${id}`).emit("member_muted", { channelId: id, userId });
    return res.json({ membership: updated });
}
async function unmuteUser(req, res) {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId)
        return res.status(400).json({ message: "userId is required" });
    const membership = await prisma_1.prisma.channelMember.findUnique({
        where: { userId_channelId: { userId, channelId: id } },
    });
    if (!membership || !membership.isActive) {
        return res.status(404).json({ message: "User is not an active member of this channel" });
    }
    const updated = await prisma_1.prisma.channelMember.update({
        where: { id: membership.id },
        data: { isMuted: false },
    });
    (0, socket_1.getIO)().to(`channel:${id}`).emit("member_unmuted", { channelId: id, userId });
    return res.json({ membership: updated });
}
