import mongoose from "mongoose";

export async function connectDb(uri = process.env.MONGODB_URI): Promise<void> {
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(uri);
}

export async function disconnectDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
