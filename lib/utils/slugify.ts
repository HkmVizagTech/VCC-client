import slugifyLib from "slugify";
import crypto from "crypto";
import { Event } from "../models";

export async function generateSlug(name: string): Promise<string> {
  let slug = slugifyLib(name, { lower: true, strict: true });

  const existing = await Event.findOne({ slug });
  if (existing) {
    slug = `${slug}-${crypto.randomBytes(2).toString("hex")}`;
  }

  return slug;
}
