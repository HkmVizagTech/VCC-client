import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import mongoose from "mongoose";

const STALE_INDEXES: Array<[string, string]> = [
  ["volunteers", "volunteerNumber_1"],
  ["volunteers", "sevaToken_1"],
  ["events", "slug_1"],
];

async function main() {
  const conn = await mongoose.connect(process.env.MONGO_URI!);
  const db = conn.connection.db;
  if (!db) throw new Error("Could not obtain database handle");
  for (const [coll, index] of STALE_INDEXES) {
    try {
      await db.collection(coll).dropIndex(index);
      console.log(`dropped ${coll}.${index}`);
    } catch (e: any) {
      console.log(`SKIP ${coll}.${index}: ${e.message}`);
    }
  }
  process.exit(0);
}

main();
