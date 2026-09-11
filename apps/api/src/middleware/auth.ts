import { createHash, randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { Session } from "../models/Session.js";

const COOKIE = "interprep_session";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type AuthedRequest = Request & { userId: string };

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS,
  };
}

export async function createSession(userId: string, res: Response): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await Session.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TTL_MS),
  });
  res.cookie(COOKIE, token, cookieOptions());
}

export async function clearSession(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[COOKIE];
  if (token) {
    await Session.deleteOne({ tokenHash: hashToken(token) });
  }
  res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: 0 });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE];
  if (!token) {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sign in required" } });
    return;
  }
  const session = await Session.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  }).select("userId");
  if (!session) {
    res.status(401).json({ error: { code: "SESSION_EXPIRED", message: "Session expired" } });
    return;
  }
  (req as AuthedRequest).userId = String(session.userId);
  next();
}
