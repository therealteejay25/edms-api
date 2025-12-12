import mongoose, { Schema, Document } from "mongoose";

export interface IWorkflowStep {
  order: number;
  approvers: mongoose.Types.ObjectId[];
  action: "approve" | "review" | "sign";
  dueInDays?: number;
}

export interface IWorkflow extends Document {
  org: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  trigger: "document_type" | "department" | "manual";
  triggerValue?: string;
  steps: IWorkflowStep[];
  enabled: boolean;
}

const WorkflowStepSchema = new Schema(
  {
    order: { type: Number, required: true },
    approvers: { type: [Schema.Types.ObjectId], ref: "User", required: true },
    action: {
      type: String,
      enum: ["approve", "review", "sign"],
      default: "approve",
    },
    dueInDays: { type: Number },
  },
  { _id: false }
);

const WorkflowSchema = new Schema(
  {
    org: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true },
    description: { type: String },
    trigger: {
      type: String,
      enum: ["document_type", "department", "manual"],
      default: "manual",
    },
    triggerValue: { type: String },
    steps: { type: [WorkflowStepSchema], required: true },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IWorkflow>("Workflow", WorkflowSchema);
