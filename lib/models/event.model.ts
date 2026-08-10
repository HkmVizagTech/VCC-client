import mongoose, { Schema, type Document, type Types } from "mongoose";

export const EVENT_STATUSES = [
  "draft",
  "registration_open",
  "registration_closed",
  "ongoing",
  "completed",
  "archived",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export interface IEvent extends Document {
  name: string;
  slug: string;
  description?: string;
  venue?: string;
  bannerImage?: string;
  registrationStart?: Date;
  registrationEnd?: Date;
  eventStart: Date;
  eventEnd: Date;
  status: EventStatus;
  coordinatorId?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IEvent>(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
    },
    description: String,
    venue: { type: String, trim: true },
    bannerImage: String,
    registrationStart: Date,
    registrationEnd: Date,
    eventStart: { type: Date, required: true },
    eventEnd: { type: Date, required: true },
    status: {
      type: String,
      enum: EVENT_STATUSES,
      default: "draft",
    },
    coordinatorId: { type: Schema.Types.ObjectId, ref: "user" },
    createdBy: { type: Schema.Types.ObjectId, ref: "user" },
  },
  { timestamps: true, versionKey: false }
);

eventSchema.index({ status: 1, eventStart: 1 });
eventSchema.index({ coordinatorId: 1 });

export const Event =
  mongoose.models.event || mongoose.model<IEvent>("event", eventSchema);
