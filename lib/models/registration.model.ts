import mongoose, { Schema, type Document, type Types } from "mongoose";

export const REGISTRATION_STATUSES = [
  "registered",
  "assigned",
  "attended",
  "no_show",
  "cancelled",
] as const;

export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export interface ServiceAvailabilityEntry {
  date: string;
  startTime: string;
  endTime: string;
}

export interface DayAttendance {
  date: string;
  status: "attended" | "no_show";
  checkedInAt?: Date;
  source?: "qr" | "admin";
}

export interface CustomAnswer {
  fieldId: string;
  label: string;
  type: string;
  value: unknown;
}

export interface IRegistration extends Document {
  eventId: Types.ObjectId;
  volunteerId: Types.ObjectId;
  serviceId?: Types.ObjectId;
  status: RegistrationStatus;
  serviceAvailability?: ServiceAvailabilityEntry[];
  /** Per-day attendance outcomes — one entry per event day. */
  dayAttendance?: DayAttendance[];
  customAnswers?: CustomAnswer[];
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
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
      },
    ],
    dayAttendance: [
      {
        _id: false,
        date: { type: String, required: true },
        status: { type: String, enum: ["attended", "no_show"], required: true },
        checkedInAt: Date,
        source: { type: String, enum: ["qr", "admin"] },
      },
    ],
    customAnswers: [
      {
        _id: false,
        fieldId: { type: String, required: true },
        label: { type: String, required: true },
        type: { type: String, required: true },
        value: { type: Schema.Types.Mixed },
      },
    ],
    notes: String,
  },
  { timestamps: true, versionKey: false }
);

registrationSchema.index({ eventId: 1, volunteerId: 1 }, { unique: true });
registrationSchema.index({ eventId: 1, status: 1 });
registrationSchema.index({ eventId: 1, createdAt: -1 });
registrationSchema.index({ volunteerId: 1 });

if (mongoose.models.registration) {
  mongoose.deleteModel("registration");
}

export const Registration = mongoose.model<IRegistration>(
  "registration",
  registrationSchema
);
