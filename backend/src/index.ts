import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import authRoutes from "./routes/auth.routes";
import channelRoutes from "./routes/channel.routes";
import userRoutes from "./routes/user.routes";
import { initSocket } from "./socket";

const app = express();
const httpServer = createServer(app);

app.use(cors({ origin: process.env.CORS_ORIGIN || "*", credentials: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/users", userRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

// Central error handler (catches sync/async throws not already handled)
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(err?.status || 500).json({ message: err?.message || "Internal server error" });
  }
);

initSocket(httpServer);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
httpServer.listen(PORT, () => {
  console.log(`API + Socket.IO server listening on http://localhost:${PORT}`);
});
