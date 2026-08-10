import mongoose, { Schema, type Document } from "mongoose";

export interface IOtp extends Document {
  phone: string;
  otp: string;
  expiresAt: Date;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    phone: { type: String, required: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ phone: 1, otp: 1 });

export const Otp =
  mongoose.models.otp || mongoose.model<IOtp>("otp", otpSchema);
