"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const channel_routes_1 = __importDefault(require("./routes/channel.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const socket_1 = require("./socket");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
app.use((0, cors_1.default)({ origin: process.env.CORS_ORIGIN || "*", credentials: true }));
app.use(express_1.default.json());
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", auth_routes_1.default);
app.use("/api/channels", channel_routes_1.default);
app.use("/api/users", user_routes_1.default);
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ message: "Not found" });
});
// Central error handler (catches sync/async throws not already handled)
app.use((err, _req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
_next) => {
    console.error(err);
    res.status(err?.status || 500).json({ message: err?.message || "Internal server error" });
});
(0, socket_1.initSocket)(httpServer);
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
httpServer.listen(PORT, () => {
    console.log(`API + Socket.IO server listening on http://localhost:${PORT}`);
});
