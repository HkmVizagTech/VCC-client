import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IService extends Document {
  eventId: Types.ObjectId;
  name: string;
  description?: string;
  requiredVolunteers: number;
  coordinatorId: Types.ObjectId;
  status: "active" | "inactive";
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<IService>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "event", required: true },
    name: { type: String, required: true, trim: true },
    description: String,
    requiredVolunteers: { type: Number, default: 0 },
    coordinatorId: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "user" },
  },
  { timestamps: true, versionKey: false }
);

serviceSchema.index({ eventId: 1 });
serviceSchema.index({ coordinatorId: 1 });
serviceSchema.index({ eventId: 1, name: 1 }, { unique: true });

export const Service =
  mongoose.models.service ||
  mongoose.model<IService>("service", serviceSchema);
