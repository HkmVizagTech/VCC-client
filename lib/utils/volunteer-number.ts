import { Counter } from "../models";

export async function generateVolunteerNumber(): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { _id: "volunteer" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `HKV-${String(counter.seq).padStart(5, "0")}`;
}
