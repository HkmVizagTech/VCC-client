import mongoose, { Schema, type Document, type Types } from "mongoose";

export const REGISTRATION_STATUSES = [
  "registered",
  "assigned",
  "confirmed",
  "attended",
  "no_show",
  "cancelled",
] as const;

export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export interface ServiceAvailabilityEntry {
  date: string;
  timeSlot: string;
}

export interface IRegistration extends Document {
  eventId: Types.ObjectId;
  volunteerId: Types.ObjectId;
  serviceId?: Types.ObjectId;
  status: RegistrationStatus;
  serviceAvailability?: ServiceAvailabilityEntry[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const registrationSchema = new Schema<IRegistration>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "event", required: true },
    volunteerId: {
      type: Schema.Types.ObjectId,
      ref: "volunteer",
      required: true,
    },
    serviceId: { type: Schema.Types.ObjectId, ref: "service" },
    status: {
      type: String,
      enum: REGISTRATION_STATUSES,
      default: "registered",
    },
    serviceAvailability: [
      {
        _id: false,
        date: { type: String, required: true },
        timeSlot: { type: String, required: true },
      },
    ],
    notes: String,
  },
  { timestamps: true, versionKey: false }
);

registrationSchema.index({ eventId: 1, volunteerId: 1 }, { unique: true });
registrationSchema.index({ eventId: 1, status: 1 });
registrationSchema.index({ volunteerId: 1 });

export const Registration =
  mongoose.models.registration ||
  mongoose.model<IRegistration>("registration", registrationSchema);
