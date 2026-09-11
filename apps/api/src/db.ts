import dns from "node:dns";
import mongoose from "mongoose";

dns.setDefaultResultOrder("ipv4first");

mongoose.set("bufferCommands", false);

function isSrvLookupFailure(err: unknown): boolean {
  const code = (err as { code?: string }).code;
  const syscall = (err as { syscall?: string }).syscall;
  return syscall === "querySrv" || code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEOUT";
}

const connectOptions = {
  serverSelectionTimeoutMS: 5_000,
  connectTimeoutMS: 5_000,
  socketTimeoutMS: 30_000,
  heartbeatFrequencyMS: 10_000,
  maxPoolSize: 10,
  minPoolSize: 1,
  family: 4 as const,
  bufferCommands: false,
};

let connecting: Promise<void> | null = null;

export function isDbReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function pingDb(): Promise<void> {
  if (!isDbReady()) {
    throw new Error("MongoDB is not connected");
  }
  await mongoose.connection.db?.admin().command({ ping: 1 });
}

export async function ensureDb(uri = process.env.MONGODB_URI): Promise<void> {
  if (isDbReady()) return;
  await connectDb(uri);
}

export async function connectDb(uri = process.env.MONGODB_URI): Promise<void> {
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }
  if (isDbReady()) return;
  if (connecting) {
    await connecting;
    return;
  }

  connecting = (async () => {
    try {
      await mongoose.connect(uri, connectOptions);
    } catch (err) {
      if (uri.includes("mongodb+srv://") && isSrvLookupFailure(err)) {
        dns.setServers(["8.8.8.8", "1.1.1.1"]);
        if (mongoose.connection.readyState !== 0) {
          await mongoose.disconnect();
        }
        await mongoose.connect(uri, connectOptions);
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Could not connect to MongoDB (${message}). ` +
          `If you use mongodb+srv://, DNS SRV lookups can be slow or fail on some hosts. ` +
          `In Atlas: Network Access → allow 0.0.0.0/0, confirm the cluster is not paused, then retry. ` +
          `For faster cold starts, use Atlas → Connect → Drivers and pick the standard mongodb:// host list instead of SRV.`,
      );
    } finally {
      connecting = null;
    }
  })();

  await connecting;
}

export async function disconnectDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
