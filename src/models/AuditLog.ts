import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  org: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  action: string;
  resource: "document" | "approval" | "workflow" | "user" | "settings";
  resourceId: mongoose.Types.ObjectId;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

const AuditLogSchema = new Schema(
  {
    org: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    resource: {
      type: String,
      enum: ["document", "approval", "workflow", "user", "settings"],
      required: true,
    },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    changes: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

AuditLogSchema.index({ org: 1, createdAt: -1 });
AuditLogSchema.index({ resourceId: 1 });

export default mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
