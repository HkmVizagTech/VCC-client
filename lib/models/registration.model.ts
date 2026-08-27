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

export const SYNC_STATUSES = ["pending", "synced", "failed"] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

/**
 * Outcome of the last mark-attendance push to the community app.
 *
 * VCC records attendance the instant a volunteer scans — that is a fact about
 * our system and must never be lost because a third party is unreachable. But
 * without this, whether the push actually landed was invisible outside Vercel
 * logs, so VCC could show "Attended" while the app showed nothing and nobody
 * could tell which had gone wrong.
 */
export interface AttendanceSync {
  /** The event day that was pushed (`yyyy-MM-dd`). */
  date: string;
  /** What we told them — mirrors is_present yes/no. */
  isPresent: boolean;
  status: SyncStatus;
  attempts: number;
  lastAttemptAt?: Date;
  /** Their error text (or ours) when status is "failed". */
  reason?: string;
}

export interface IRegistration extends Document {
  eventId: Types.ObjectId;
  volunteerId: Types.ObjectId;
  serviceId?: Types.ObjectId;
  status: RegistrationStatus;
  serviceAvailability?: ServiceAvailabilityEntry[];
  /** Per-day attendance outcomes — one entry per event day. */
  dayAttendance?: DayAttendance[];
  /** Last community-app attendance push for this registration. */
  attendanceSync?: AttendanceSync;
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
    attendanceSync: {
      type: {
        _id: false,
        date: { type: String, required: true },
        isPresent: { type: Boolean, required: true },
        status: { type: String, enum: SYNC_STATUSES, required: true },
        attempts: { type: Number, default: 0 },
        lastAttemptAt: Date,
        reason: String,
      },
      default: undefined,
    },
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
// Lets the retry sweeper find unsynced pushes without scanning the collection.
registrationSchema.index({ "attendanceSync.status": 1, "attendanceSync.lastAttemptAt": 1 });

if (mongoose.models.registration) {
  mongoose.deleteModel("registration");
}

export const Registration = mongoose.model<IRegistration>(
  "registration",
  registrationSchema
);
