import http from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { connectDB } from "./db.js";
import { redis, connectRedis } from "./redis.js";

async function main(): Promise<void> {
  // Connect data services
  await connectDB();
  await connectRedis();

  const app = createApp();
  const server = http.createServer(app);

  // Setup Socket.IO with Redis adapter
  const io = new SocketIOServer(server, {
    cors: {
      origin: ["http://localhost", "http://localhost:3000", "http://127.0.0.1", "http://127.0.0.1:3000"],
      credentials: true,
    },
  });

  try {
    const subRedis = redis.duplicate();
    await subRedis.connect();
    io.adapter(createAdapter(redis, subRedis));
    logger.info("Socket.IO Redis adapter configured");
  } catch (err) {
    logger.warn({ err }, "Could not initialize Socket.IO Redis adapter, continuing in standalone mode");
  }

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Client connected to Socket.IO");

    socket.on("join:course", (courseId: string) => {
      socket.join(`course:${courseId}`);
    });

    socket.on("join:class", (sessionId: string) => {
      socket.join(`class:${sessionId}`);
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Client disconnected from Socket.IO");
    });
  });

  server.listen(config.port, () => {
    logger.info({ port: config.port }, `Learnly API running at http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  logger.fatal({ err }, "Fatal startup error in API");
  process.exit(1);
});
