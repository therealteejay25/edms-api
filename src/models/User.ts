import mongoose, { Schema, Document } from "mongoose";
// import bcrypt from "bcrypt";

export interface IUser extends Document {
  email: string;
  password?: string;
  name: string;
  role: "admin" | "user";
  org: mongoose.Types.ObjectId;
  department?: string;
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
    role: { type: String, enum: ["admin", "user"], default: "user" },
    org: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    department: { type: String },
    zohoId: { type: String },
    zohoAccessToken: { type: String },
    zohoRefreshToken: { type: String },
  },
  { timestamps: true }
);

UserSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = function (candidate: string) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password as string);
};

export default mongoose.model<IUser>("User", UserSchema);
