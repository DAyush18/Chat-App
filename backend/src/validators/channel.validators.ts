import { z } from "zod";

//control Channel create , Updaate , Delete
export const createChannelSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
  isPrivate: z.boolean().optional().default(false),
});

export const updateChannelSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(300).optional(),
  isPrivate: z.boolean().optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty").max(2000),
});

export const muteUserSchema = z.object({
  userId: z.string().min(1, "userId is required"),
});

export const changeRoleSchema = z.object({
  role: z.enum(["ADMIN", "MODERATOR", "MEMBER"]),
});
