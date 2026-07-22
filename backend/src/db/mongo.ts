import mongoose from "mongoose";

let connected = false;

export async function connectMongo(mongoUrl: string): Promise<boolean> {
  if (!mongoUrl) return false;
  try {
    await mongoose.connect(mongoUrl);
    connected = true;
    // eslint-disable-next-line no-console
    console.log("[mongo] connected");
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[mongo] connection failed, falling back to in-memory store:", err);
    connected = false;
    return false;
  }
}

export function isMongoConnected(): boolean {
  return connected;
}
