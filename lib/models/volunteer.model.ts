import mongoose, { Schema, type Document } from "mongoose";
import {
  AVAILABILITY_DAYS,
  AVAILABILITY_SLOTS,
  type AvailabilityDay,
  type AvailabilitySlot,
} from "@/lib/availability";

export const VOLUNTEER_SKILLS = [
  "medical",
  "photography",
  "videography",
  "driving",
  "electrical",
  "sound",
  "it",
  "graphic_design",
  "cooking",
  "crowd_management",
  "other",
] as const;

export type VolunteerSkill = (typeof VOLUNTEER_SKILLS)[number];

export interface IVolunteer extends Document {
  volunteerNumber: string;
  name: string;
  phone: string;
  whatsappNumber?: string;
  age?: number;
  gender?: "male" | "female" | "other";
  locality?: string;
  occupation?: string;
  skills: VolunteerSkill[];
  availability?: {
    days: AvailabilityDay[];
    timeSlots: AvailabilitySlot[];
  };
  sevaToken: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const volunteerSchema = new Schema<IVolunteer>(
  {
    volunteerNumber: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    whatsappNumber: { type: String, trim: true },
    age: Number,
    gender: { type: String, enum: ["male", "female", "other"] },
    locality: { type: String, trim: true },
    occupation: { type: String, trim: true },
    skills: [{ type: String, enum: VOLUNTEER_SKILLS }],
    availability: {
      days: [{ type: String, enum: AVAILABILITY_DAYS }],
      timeSlots: [{ type: String, enum: AVAILABILITY_SLOTS }],
    },
    sevaToken: { type: String, unique: true },
    notes: String,
  },
  { timestamps: true, versionKey: false }
);

volunteerSchema.index({ skills: 1 });
volunteerSchema.index(
  { name: "text", phone: "text", locality: "text" },
  { name: "volunteer_text_search" }
);

export const Volunteer =
  mongoose.models.volunteer ||
  mongoose.model<IVolunteer>("volunteer", volunteerSchema);
