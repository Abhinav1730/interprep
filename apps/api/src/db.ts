import dns from "node:dns";
import mongoose from "mongoose";

dns.setDefaultResultOrder("ipv4first");

function isSrvLookupFailure(err: unknown): boolean {
  const code = (err as { code?: string }).code;
  const syscall = (err as { syscall?: string }).syscall;
  return syscall === "querySrv" || code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEOUT";
}

export async function connectDb(uri = process.env.MONGODB_URI): Promise<void> {
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }
  if (mongoose.connection.readyState === 1) return;

  const opts = {
    serverSelectionTimeoutMS: 12_000,
    family: 4 as const,
  };

  try {
    await mongoose.connect(uri, opts);
    return;
  } catch (err) {
    if (uri.includes("mongodb+srv://") && isSrvLookupFailure(err)) {
      dns.setServers(["8.8.8.8", "1.1.1.1"]);
      try {
        if (mongoose.connection.readyState !== 0) {
          await mongoose.disconnect();
        }
        await mongoose.connect(uri, opts);
        return;
      } catch {
        // fall through to the clearer error
      }
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not connect to MongoDB (${message}). ` +
        `If you use mongodb+srv://, Windows DNS sometimes refuses SRV lookups. ` +
        `In Atlas: Network Access → allow your current IP (or 0.0.0.0/0 for development), ` +
        `confirm the cluster is not paused, then retry. ` +
        `Alternatively use Atlas → Connect → Drivers and pick the standard mongodb:// host list instead of SRV.`,
    );
  }
}

export async function disconnectDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
