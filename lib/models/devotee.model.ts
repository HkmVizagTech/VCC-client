import mongoose, { Schema, type Document } from "mongoose";

export interface IDevotee extends Document {
  name: string;
  phone?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const devoteeSchema = new Schema<IDevotee>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false }
);

devoteeSchema.index({ name: 1 });

if (mongoose.models.devotee) {
  mongoose.deleteModel("devotee");
}

export const Devotee = mongoose.model<IDevotee>("devotee", devoteeSchema);
