"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = getIO;
exports.initSocket = initSocket;
const socket_io_1 = require("socket.io");
const jwt_1 = require("../lib/jwt");
const prisma_1 = require("../lib/prisma");
let io = null;
const connectedUsers = new Map();
function getIO() {
    if (!io)
        throw new Error("Socket.IO server has not been initialized yet");
    return io;
}
function initSocket(httpServer) {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: process.env.CORS_ORIGIN || "*",
            credentials: true,
        },
    });
    // Authenticate every socket connection using the JWT access token.
    io.use((socket, next) => {
        const token = (socket.handshake.auth && socket.handshake.auth.token) ||
            (socket.handshake.headers.authorization || "").replace("Bearer ", "");
        if (!token) {
            return next(new Error("Authentication token missing"));
        }
        try {
            const payload = (0, jwt_1.verifyAccessToken)(token);
            socket.data = {
                userId: payload.sub,
                email: payload.email,
                role: payload.role,
            };
            return next();
        }
        catch {
            return next(new Error("Invalid or expired token"));
        }
    });
    io.on("connection", (socket) => {
        const { userId } = socket.data;
        const connectionCount = (connectedUsers.get(userId) || 0) + 1;
        connectedUsers.set(userId, connectionCount);
        socket.emit("online_users", { userIds: Array.from(connectedUsers.keys()) });
        if (connectionCount === 1) {
            socket.broadcast.emit("user_online", { userId });
        }
        // Client asks to join a channel's real-time room.
        // We re-verify active membership server-side before allowing the join
        // (never trust the client alone), except channel creators/admin previewing.
        socket.on("join_room", async ({ channelId }) => {
            if (!channelId)
                return;
            const membership = await prisma_1.prisma.channelMember.findUnique({
                where: { userId_channelId: { userId, channelId } },
            });
            const userRole = socket.data.role;
            const canPreview = userRole === "ADMIN" || userRole === "MODERATOR";
            if (!membership?.isActive && !canPreview) {
                socket.emit("error_message", { message: "You must join this channel first" });
                return;
            }
            socket.join(`channel:${channelId}`);
            socket.to(`channel:${channelId}`).emit("presence_join", { channelId, userId });
        });
        socket.on("leave_room", ({ channelId }) => {
            if (!channelId)
                return;
            socket.leave(`channel:${channelId}`);
            socket.to(`channel:${channelId}`).emit("presence_leave", { channelId, userId });
        });
        socket.on("typing", ({ channelId, isTyping }) => {
            if (!channelId)
                return;
            socket.to(`channel:${channelId}`).emit("typing", { channelId, userId, isTyping });
        });
        socket.on("disconnect", () => {
            const remainingConnections = (connectedUsers.get(userId) || 1) - 1;
            if (remainingConnections <= 0) {
                connectedUsers.delete(userId);
                socket.broadcast.emit("user_offline", { userId });
            }
            else {
                connectedUsers.set(userId, remainingConnections);
            }
        });
    });
    return io;
}
