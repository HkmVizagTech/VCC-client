import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lib/r2";

// POST /api/upload/photo — upload a volunteer photo, returns { key }
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("photo");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ message: "No photo provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (buffer.byteLength > 1_100_000) {
      return NextResponse.json(
        { message: "Photo exceeds 1 MB limit after compression" },
        { status: 400 }
      );
    }

    const ext = "jpg";
    const key = `volunteers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    return NextResponse.json({ key }, { status: 201 });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("[upload/photo]", e);
    return NextResponse.json(
      { message: e.message || "Upload failed" },
      { status: 500 }
    );
  }
}

// GET /api/upload/photo?key=volunteers/xxx.jpg — serve via pre-signed URL (1 h TTL)
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ message: "key is required" }, { status: 400 });
  }

  try {
    const url = await getSignedUrl(
      r2,
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
      { expiresIn: 3600 }
    );
    const res = NextResponse.redirect(url, { status: 302 });
    res.headers.set(
      "Cache-Control",
      "public, max-age=3000"
    );
    return res;
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json(
      { message: e.message || "Could not generate URL" },
      { status: 500 }
    );
  }
}
