import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("MONGO_URI not set");
  process.exit(1);
}

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, lowercase: true },
    phone: String,
    password: String,
    role: String,
    status: { type: String, default: "active" },
  },
  { timestamps: true, versionKey: false }
);

async function seed() {
  await mongoose.connect(MONGO_URI!);
  const User = mongoose.models.user || mongoose.model("user", userSchema);

  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME;

  if (!email || !password || !name) {
    console.error("Set SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_NAME");
    process.exit(1);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    console.log("Super admin already exists:", email);
  } else {
    const hashed = await bcrypt.hash(password, 10);
    await User.create({ name, email, password: hashed, role: "super_admin" });
    console.log("Super admin created:", email);
  }

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
