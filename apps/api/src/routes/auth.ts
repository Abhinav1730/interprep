import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ensureDb } from "../db.js";
import { User } from "../models/User.js";
import { clearSession, createSession, requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const authRouter = Router();

const BCRYPT_ROUNDS = 10;

const creds = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

authRouter.post("/register", async (req, res) => {
  const parsed = creds.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.issues[0]?.message } });
    return;
  }
  try {
    await ensureDb();
  } catch (err) {
    res.status(503).json({
      error: { code: "DB_UNAVAILABLE", message: err instanceof Error ? err.message : "Database unavailable" },
    });
    return;
  }
  const email = parsed.data.email.toLowerCase();
  const existing = await User.findOne({ email }).select("_id").lean();
  if (existing) {
    res.status(409).json({ error: { code: "EMAIL_TAKEN", message: "An account with that email already exists" } });
    return;
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS);
  const user = await User.create({ email, passwordHash });
  await createSession(String(user._id), res);
  res.status(201).json({ user: { id: user._id, email: user.email } });
});

authRouter.post("/login", async (req, res) => {
  const parsed = creds.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "INVALID_INPUT", message: parsed.error.issues[0]?.message } });
    return;
  }
  try {
    await ensureDb();
  } catch (err) {
    res.status(503).json({
      error: { code: "DB_UNAVAILABLE", message: err instanceof Error ? err.message : "Database unavailable" },
    });
    return;
  }
  const user = await User.findOne({ email: parsed.data.email.toLowerCase() }).select("email passwordHash");
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
    return;
  }
  await createSession(String(user._id), res);
  res.json({ user: { id: user._id, email: user.email } });
});

authRouter.post("/logout", async (req, res) => {
  await clearSession(req, res);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const { userId } = req as AuthedRequest;
  const user = await User.findById(userId).select("email createdAt");
  if (!user) {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Account not found" } });
    return;
  }
  res.json({ user: { id: user._id, email: user.email, createdAt: user.createdAt } });
});
