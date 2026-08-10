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

export const CUSTOM_FIELD_TYPES = [
  "short_text",
  "long_text",
  "number",
  "email",
  "phone",
  "select",
  "radio",
  "checkbox",
  "date",
] as const;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export interface ICustomField {
  id: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
}

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
  availabilitySlots?: string[];
  customFields?: ICustomField[];
  status: EventStatus;
  coordinatorId?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const customFieldSchema = new Schema<ICustomField>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: CUSTOM_FIELD_TYPES, required: true },
    required: { type: Boolean, default: false },
    options: [{ type: String, trim: true }],
    placeholder: { type: String, trim: true },
    helpText: { type: String, trim: true },
  },
  { _id: false }
);

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
    availabilitySlots: [{ type: String, trim: true }],
    customFields: [customFieldSchema],
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

if (mongoose.models.event) {
  mongoose.deleteModel("event");
}

export const Event = mongoose.model<IEvent>("event", eventSchema);
