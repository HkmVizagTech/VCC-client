import mongoose, { Schema, type Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: "super_admin" | "event_coordinator" | "service_coordinator";
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ["super_admin", "event_coordinator", "service_coordinator"],
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true, versionKey: false }
);

userSchema.index({ role: 1, status: 1 });

export const User =
  mongoose.models.user || mongoose.model<IUser>("user", userSchema);
