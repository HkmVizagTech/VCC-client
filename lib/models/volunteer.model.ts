import mongoose, { Schema, type Document } from "mongoose";

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
  name: string;
  phone: string;
  age?: number;
  gender?: "male" | "female" | "other";
  locality?: string;
  occupation?: string;
  skills: VolunteerSkill[];
  photoKey?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const volunteerSchema = new Schema<IVolunteer>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    age: Number,
    gender: { type: String, enum: ["male", "female", "other"] },
    locality: { type: String, trim: true },
    occupation: { type: String, trim: true },
    skills: [{ type: String, enum: VOLUNTEER_SKILLS }],
    photoKey: { type: String, trim: true },
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
