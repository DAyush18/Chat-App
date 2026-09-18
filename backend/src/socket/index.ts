import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";

let io: Server | null = null;
const connectedUsers = new Map<string, number>();

export function getIO(): Server {
  if (!io) throw new Error("Socket.IO server has not been initialized yet");
  return io;
}

interface SocketData {
  userId: string;
  email: string;
  role: string;
}

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      credentials: true,
    },
  });

  // Authenticate every socket connection using the JWT access token.
  io.use((socket: Socket, next) => {
    const token =
      (socket.handshake.auth && socket.handshake.auth.token) ||
      (socket.handshake.headers.authorization || "").replace("Bearer ", "");

    if (!token) {
      return next(new Error("Authentication token missing"));
    }
    try {
      const payload = verifyAccessToken(token);
      (socket.data as SocketData) = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      return next();
    } catch {
      return next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const { userId } = socket.data as SocketData;
    const connectionCount = (connectedUsers.get(userId) || 0) + 1;
    connectedUsers.set(userId, connectionCount);
    socket.emit("online_users", { userIds: Array.from(connectedUsers.keys()) });
    if (connectionCount === 1) {
      socket.broadcast.emit("user_online", { userId });
    }

    // Client asks to join a channel's real-time room.
    // We re-verify active membership server-side before allowing the join
    // (never trust the client alone), except channel creators/admin previewing.
    socket.on("join_room", async ({ channelId }: { channelId: string }) => {
      if (!channelId) return;
      const membership = await prisma.channelMember.findUnique({
        where: { userId_channelId: { userId, channelId } },
      });
      const userRole = (socket.data as SocketData).role;
      const canPreview = userRole === "ADMIN" || userRole === "MODERATOR";
      if (!membership?.isActive && !canPreview) {
        socket.emit("error_message", { message: "You must join this channel first" });
        return;
      }
      socket.join(`channel:${channelId}`);
      socket.to(`channel:${channelId}`).emit("presence_join", { channelId, userId });
    });

    socket.on("leave_room", ({ channelId }: { channelId: string }) => {
      if (!channelId) return;
      socket.leave(`channel:${channelId}`);
      socket.to(`channel:${channelId}`).emit("presence_leave", { channelId, userId });
    });

    socket.on("typing", ({ channelId, isTyping }: { channelId: string; isTyping: boolean }) => {
      if (!channelId) return;
      socket.to(`channel:${channelId}`).emit("typing", { channelId, userId, isTyping });
    });

    socket.on("disconnect", () => {
      const remainingConnections = (connectedUsers.get(userId) || 1) - 1;
      if (remainingConnections <= 0) {
        connectedUsers.delete(userId);
        socket.broadcast.emit("user_offline", { userId });
      } else {
        connectedUsers.set(userId, remainingConnections);
      }
    });
  });

  return io;
}
