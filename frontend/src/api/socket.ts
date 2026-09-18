import { io, Socket } from "socket.io-client";
import { getAccessToken } from "./client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket && socket.connected) return socket;

  if (socket) {
    socket.disconnect();
  }

  socket = io(API_URL, {
    auth: { token: getAccessToken() },
    transports: ["websocket"],
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
