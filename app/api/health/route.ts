import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";

export async function GET() {
  try {
    await connectDB();
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      mongodb:
        mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    });
  } catch {
    return NextResponse.json(
      { status: "error", mongodb: "disconnected" },
      { status: 503 }
    );
  }
}
