import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDb, isDbReady, pingDb } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { kitsRouter } from "./routes/kits.js";
import { requireAuth } from "./middleware/auth.js";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env") });
dotenv.config();

const app = express();
app.set("etag", false);
const origin = process.env.FRONTEND_URL || "http://localhost:3000";

app.use(
  cors({
    origin,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", async (_req, res) => {
  if (!isDbReady()) {
    res.status(503).json({ ok: false, db: "disconnected" });
    return;
  }
  try {
    await pingDb();
    res.json({ ok: true, db: "connected" });
  } catch {
    res.status(503).json({ ok: false, db: "unreachable" });
  }
});

app.use("/auth", authRouter);
app.use("/kits", requireAuth, kitsRouter);

const port = Number(process.env.PORT || 4000);

async function main() {
  app.listen(port, () => {
    console.log(`API listening on ${port}`);
  });

  await connectDb();
  console.log("MongoDB connected");

  setInterval(() => {
    pingDb().catch(() => {
      connectDb().catch((err) => console.error("MongoDB reconnect failed:", err));
    });
  }, 60_000).unref();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
