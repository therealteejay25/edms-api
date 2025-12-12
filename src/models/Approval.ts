import mongoose, { Schema, Document } from "mongoose";

export interface IApproval extends Document {
  docId: mongoose.Types.ObjectId;
  org: mongoose.Types.ObjectId;
  status: "pending" | "approved" | "rejected" | "escalated";
  requestedBy: mongoose.Types.ObjectId;
  requestedAt: Date;
  decidedBy?: mongoose.Types.ObjectId;
  decidedAt?: Date;
  comment?: string;
  dueDate?: Date;
  priority?: "low" | "medium" | "high";
  assignee?: mongoose.Types.ObjectId;
  escalatedTo?: mongoose.Types.ObjectId;
  escalatedAt?: Date;
}

const ApprovalSchema = new Schema(
  {
    docId: { type: Schema.Types.ObjectId, ref: "Document", required: true },
    org: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "escalated"],
      default: "pending",
    },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    requestedAt: { type: Date, default: Date.now },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    decidedAt: { type: Date },
    comment: { type: String },
    dueDate: { type: Date },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    assignee: { type: Schema.Types.ObjectId, ref: "User" },
    escalatedTo: { type: Schema.Types.ObjectId, ref: "User" },
    escalatedAt: { type: Date },
  },
  { timestamps: true }
);

ApprovalSchema.index({ org: 1, status: 1 });
ApprovalSchema.index({ assignee: 1, status: 1 });

export default mongoose.model<IApproval>("Approval", ApprovalSchema);
