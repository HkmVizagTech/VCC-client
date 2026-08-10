import mongoose from "mongoose";

interface CachedConnection {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var __mongoose: CachedConnection | undefined;
}

const cached: CachedConnection =
  global.__mongoose || {
    conn: null,
    promise: null,
  };

if (!global.__mongoose) {
  global.__mongoose = cached;
}

export async function connectDB() {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGO_URI environment variable is not set");
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
