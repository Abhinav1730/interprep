import mongoose from "mongoose";
import type { Kit } from "@interprep/shared";
import { KitModel } from "../models/Kit.js";
import { PracticeRecord } from "../models/Practice.js";

export type KitSummaryRow = {
  id: string;
  status: string;
  title?: string;
  company?: string;
  days: number;
  createdAt: Date;
  updatedAt: Date;
  error?: unknown;
};

export async function listKitsForUser(userId: string): Promise<KitSummaryRow[]> {
  const kits = await KitModel.aggregate<{
    _id: mongoose.Types.ObjectId;
    status: string;
    input: { days: number };
    createdAt: Date;
    updatedAt: Date;
    error?: unknown;
    title?: string;
    company?: string;
  }>([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $sort: { updatedAt: -1 } },
    {
      $project: {
        status: 1,
        input: 1,
        createdAt: 1,
        updatedAt: 1,
        error: 1,
        title: "$kit.role.title",
        company: "$kit.company_brief.name",
      },
    },
  ]);

  return kits.map((k) => ({
    id: String(k._id),
    status: k.status,
    title: k.title,
    company: k.company,
    days: k.input.days,
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
    error: k.error,
  }));
}

export type KitCardMeta = {
  practiced: number;
  totalFlashcards: number;
  todayFocus?: string;
};

export async function cardMetaForUser(userId: string): Promise<Record<string, KitCardMeta>> {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const kits = await KitModel.find({ userId: userObjectId, status: "completed" })
    .select({ createdAt: 1, input: 1, "kit.schedule.days": 1, "kit.flashcards": 1 })
    .sort({ updatedAt: -1 })
    .limit(12)
    .lean();

  if (kits.length === 0) return {};

  const kitIds = kits.map((k) => k._id);
  const counts = await PracticeRecord.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { userId: userObjectId, kitId: { $in: kitIds } } },
    { $group: { _id: "$kitId", count: { $sum: 1 } } },
  ]);
  const countByKit = new Map(counts.map((c) => [String(c._id), c.count]));

  const meta: Record<string, KitCardMeta> = {};
  for (const kit of kits) {
    const kitDoc = kit.kit as Kit | null;
    const days = kitDoc?.schedule?.days ?? [];
    const dayNum = Math.min(
      days.length || kit.input.days,
      Math.max(1, Math.floor((Date.now() - new Date(kit.createdAt).getTime()) / 86400000) + 1),
    );
    const today = days.find((d) => d.day === dayNum);
    meta[String(kit._id)] = {
      practiced: countByKit.get(String(kit._id)) ?? 0,
      totalFlashcards: kitDoc?.flashcards?.length ?? 0,
      todayFocus: today?.focus,
    };
  }
  return meta;
}
