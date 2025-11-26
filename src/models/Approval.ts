import mongoose, { Schema, Document } from "mongoose";

export interface IApproval extends Document {
  docId: mongoose.Types.ObjectId;
  org: mongoose.Types.ObjectId;
  status: "pending" | "approved" | "rejected";
  requestedBy: mongoose.Types.ObjectId;
  requestedAt: Date;
  decidedBy?: mongoose.Types.ObjectId;
  decidedAt?: Date;
  comment?: string;
}

const ApprovalSchema = new Schema(
  {
    docId: { type: Schema.Types.ObjectId, ref: "Document", required: true },
    org: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    requestedAt: { type: Date, default: Date.now },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    decidedAt: { type: Date },
    comment: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<IApproval>("Approval", ApprovalSchema);
