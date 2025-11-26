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
  status: string;
  owner: mongoose.Types.ObjectId;
  org: mongoose.Types.ObjectId;
  fileUrl: string;
  version: number;
  history: IHistoryEntry[];
  comments: IComment[];
  activity: IActivity[];
}

const HistorySchema = new Schema({
  version: { type: Number, required: true },
  fileUrl: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
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
    status: { type: String, default: "draft" },
    owner: { type: Schema.Types.ObjectId, ref: "User" },
    org: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    fileUrl: { type: String, required: true },
    version: { type: Number, default: 1 },
    history: { type: [HistorySchema], default: [] },
    comments: { type: [CommentSchema], default: [] },
    activity: { type: [ActivitySchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model<IDocument>("Document", DocumentSchema);
