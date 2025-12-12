import mongoose, { Schema, Document } from "mongoose";

// Lazy load bcrypt to handle cases where native bindings aren't available
let bcrypt: any;
try {
  bcrypt = require("bcrypt");
} catch (err) {
  console.warn("bcrypt not available - password hashing disabled. Install build tools to enable.");
  bcrypt = null;
}

export interface IUser extends Document {
  email: string;
  password?: string;
  name: string;
  role: "admin" | "department_lead" | "user";
  org: mongoose.Types.ObjectId;
  department?: string;
  isActive: boolean;
  zohoId?: string;
  zohoAccessToken?: string;
  zohoRefreshToken?: string;
  comparePassword?(candidate: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String },
    name: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "department_lead", "user"],
      default: "user",
    },
    org: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    department: { type: String },
    isActive: { type: Boolean, default: true },
    zohoId: { type: String },
    zohoAccessToken: { type: String },
    zohoRefreshToken: { type: String },
  },
  { timestamps: true }
);

// Performance indexes
UserSchema.index({ email: 1, org: 1 }, { unique: true });
UserSchema.index({ org: 1, role: 1 });
UserSchema.index({ org: 1, department: 1 });

UserSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  if (!bcrypt) {
    console.warn("bcrypt not available - password stored in plain text (not recommended)");
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (err) {
    console.error("Password hashing failed:", err);
  }
  next();
});

UserSchema.methods.comparePassword = function (candidate: string) {
  if (!this.password) return Promise.resolve(false);
  if (!bcrypt) {
    // Fallback: plain text comparison (not secure, but allows system to work)
    console.warn("bcrypt not available - using plain text comparison");
    return Promise.resolve(candidate === this.password);
  }
  return bcrypt.compare(candidate, this.password as string);
};

export default mongoose.model<IUser>("User", UserSchema);
