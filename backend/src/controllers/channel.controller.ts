import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  createChannelSchema,
  updateChannelSchema,
} from "../validators/channel.validators";
import { getIO } from "../socket";

export async function listChannels(req: Request, res: Response) {
  const channels = await prisma.channel.findMany({
    include: {
      creator: { select: { id: true, name: true, email: true } },
      _count: { select: { members: { where: { isActive: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Also tell the current user whether they've joined each channel.
  const memberships = await prisma.channelMember.findMany({
    where: { userId: req.user!.id, isActive: true },
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

export async function getChannel(req: Request, res: Response) {
  const { id } = req.params;
  const channel = await prisma.channel.findUnique({
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

export async function createChannel(req: Request, res: Response) {
  const parsed = createChannelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }
  const { name, description, isPrivate } = parsed.data;

  const existing = await prisma.channel.findUnique({ where: { name } });
  if (existing) {
    return res.status(409).json({ message: "A channel with this name already exists" });
  }

  const channel = await prisma.channel.create({
    data: {
      name,
      description,
      isPrivate,
      creatorId: req.user!.id,
    },
  });

  return res.status(201).json({ channel });
}

export async function updateChannel(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = updateChannelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
  }

  const channel = await prisma.channel.findUnique({ where: { id } });
  if (!channel) {
    return res.status(404).json({ message: "Channel not found" });
  }

  const updated = await prisma.channel.update({
    where: { id },
    data: parsed.data,
  });

  return res.json({ channel: updated });
}

export async function deleteChannel(req: Request, res: Response) {
  const { id } = req.params;
  const channel = await prisma.channel.findUnique({ where: { id } });
  if (!channel) {
    return res.status(404).json({ message: "Channel not found" });
  }

  await prisma.channel.delete({ where: { id } });

  getIO().to(`channel:${id}`).emit("channel_deleted", { channelId: id });

  return res.status(204).send();
}

export async function joinChannel(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.id;

  const channel = await prisma.channel.findUnique({ where: { id } });
  if (!channel) {
    return res.status(404).json({ message: "Channel not found" });
  }

  let membership;
  try {
    membership = await prisma.channelMember.upsert({
      where: { userId_channelId: { userId, channelId: id } },
      update: { isActive: true, leftAt: null },
      create: { userId, channelId: id },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }

    membership = await prisma.channelMember.update({
      where: { userId_channelId: { userId, channelId: id } },
      data: { isActive: true, leftAt: null },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
  }

  getIO().to(`channel:${id}`).emit("member_joined", {
    channelId: id,
    user: membership.user,
  });

  return res.json({ membership });
}

export async function leaveChannel(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.id;

  const membership = await prisma.channelMember.findUnique({
    where: { userId_channelId: { userId, channelId: id } },
  });
  if (!membership || !membership.isActive) {
    return res.status(400).json({ message: "You are not a member of this channel" });
  }

  await prisma.channelMember.update({
    where: { id: membership.id },
    data: { isActive: false, leftAt: new Date() },
  });

  getIO().to(`channel:${id}`).emit("member_left", { channelId: id, userId });

  return res.status(204).send();
}

export async function listParticipants(req: Request, res: Response) {
  const { id } = req.params;
  const members = await prisma.channelMember.findMany({
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

export async function muteUser(req: Request, res: Response) {
  const { id } = req.params; // channel id
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "userId is required" });

  const membership = await prisma.channelMember.findUnique({
    where: { userId_channelId: { userId, channelId: id } },
  });
  if (!membership || !membership.isActive) {
    return res.status(404).json({ message: "User is not an active member of this channel" });
  }

  const updated = await prisma.channelMember.update({
    where: { id: membership.id },
    data: { isMuted: true },
  });

  getIO().to(`channel:${id}`).emit("member_muted", { channelId: id, userId });

  return res.json({ membership: updated });
}

export async function unmuteUser(req: Request, res: Response) {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "userId is required" });

  const membership = await prisma.channelMember.findUnique({
    where: { userId_channelId: { userId, channelId: id } },
  });
  if (!membership || !membership.isActive) {
    return res.status(404).json({ message: "User is not an active member of this channel" });
  }

  const updated = await prisma.channelMember.update({
    where: { id: membership.id },
    data: { isMuted: false },
  });

  getIO().to(`channel:${id}`).emit("member_unmuted", { channelId: id, userId });

  return res.json({ membership: updated });
}
