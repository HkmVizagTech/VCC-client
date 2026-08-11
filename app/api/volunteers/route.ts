import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Volunteer } from "@/lib/models";
import { authenticateWithRole } from "@/lib/auth";
import { validatePhone } from "@/lib/utils/phone";

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateWithRole(req, "event_coordinator");
    if (auth instanceof NextResponse) return auth;

    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search");
    const skills = searchParams.get("skills");
    const gender = searchParams.get("gender");

    const filter: any = {};
    if (search) filter.$text = { $search: search };
    if (skills) filter.skills = { $in: skills.split(",") };
    if (gender) filter.gender = gender;

    const [volunteers, total] = await Promise.all([
      Volunteer.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Volunteer.countDocuments(filter),
    ]);

    return NextResponse.json({
      volunteers,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateWithRole(req, "event_coordinator");
    if (auth instanceof NextResponse) return auth;

    await connectDB();
    const body = await req.json();

    if (!body.name) {
      return NextResponse.json(
        { message: "Name is required" },
        { status: 400 }
      );
    }

    const phoneResult = validatePhone(body.phone);
    if (!phoneResult.ok) {
      return NextResponse.json(
        { message: phoneResult.message },
        { status: 400 }
      );
    }

    const existing = await Volunteer.findOne({ phone: phoneResult.phone });
    if (existing) {
      return NextResponse.json(
        { message: "Phone number already registered" },
        { status: 409 }
      );
    }

    const volunteer = await Volunteer.create({
      ...body,
      phone: phoneResult.phone,
    });

    return NextResponse.json(
      { message: "Volunteer created", volunteer },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
