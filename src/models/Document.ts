import mongoose, { Schema, Document } from "mongoose";

export interface IComment {
  userId: mongoose.Types.ObjectId;
  name?: string;
  comment: string;
  createdAt: Date;
}

export interface IHistoryEntry {
  version: number;
  fileUrl: string;
  uploadedAt: Date;
  uploadedBy: mongoose.Types.ObjectId;
  extractedText?: string;
}

export interface IActivity {
  userId: mongoose.Types.ObjectId;
  action: string;
  details?: string;
  createdAt: Date;
}

export interface IDocument extends Document {
  title: string;
  type: string;
  department: string;
  effectiveDate?: Date;
  expiryDate?: Date;
  status: "draft" | "active" | "archived" | "expired";
  owner: mongoose.Types.ObjectId;
  org: mongoose.Types.ObjectId;
  fileUrl: string;
  version: number;
  history: IHistoryEntry[];
  comments: IComment[];
  activity: IActivity[];
  zohoFileId?: string;
  zohoFileUrl?: string;
  zohoRawResponse?: any;
  extractedText?: string;
  tags?: string[];
  approvalRequired?: boolean;
  legalHold?: boolean;
  retentionYears?: number;
  nextApprovalDate?: Date;
  approvalChain?: mongoose.Types.ObjectId[];
}

const HistorySchema = new Schema({
  version: { type: Number, required: true },
  fileUrl: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
  extractedText: { type: String },
});

const CommentSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String },
  comment: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const ActivitySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  action: { type: String },
  details: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const DocumentSchema = new Schema(
  {
    title: { type: String, required: true },
    type: { type: String, required: true },
    department: { type: String, required: true },
    effectiveDate: { type: Date },
    expiryDate: { type: Date },
    status: {
      type: String,
      enum: ["draft", "active", "archived", "expired"],
      default: "draft",
    },
    owner: { type: Schema.Types.ObjectId, ref: "User" },
    org: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    fileUrl: { type: String, required: true },
    zohoFileId: { type: String },
    zohoFileUrl: { type: String },
    zohoRawResponse: { type: Schema.Types.Mixed },
    version: { type: Number, default: 1 },
    history: { type: [HistorySchema], default: [] },
    comments: { type: [CommentSchema], default: [] },
    activity: { type: [ActivitySchema], default: [] },
    tags: { type: [String], default: [] },
    approvalRequired: { type: Boolean, default: false },
    legalHold: { type: Boolean, default: false },
    retentionYears: { type: Number },
    nextApprovalDate: { type: Date },
    approvalChain: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    extractedText: { type: String },
  },
  { timestamps: true }
);

// Performance indexes for 1k+ users
DocumentSchema.index({ org: 1, status: 1 });
DocumentSchema.index({ org: 1, department: 1 });
DocumentSchema.index({ org: 1, type: 1 });
DocumentSchema.index({ org: 1, owner: 1 });
DocumentSchema.index({ org: 1, createdAt: -1 });
DocumentSchema.index({ org: 1, updatedAt: -1 });
DocumentSchema.index({ org: 1, tags: 1 });
DocumentSchema.index({ org: 1, expiryDate: 1 });
DocumentSchema.index({ title: "text", extractedText: "text" });

export default mongoose.model<IDocument>("Document", DocumentSchema);
