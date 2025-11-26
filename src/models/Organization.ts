import mongoose, { Schema, Document } from "mongoose";

export interface IOrganization extends Document {
  name: string;
  settings?: Record<string, any>;
  // Zoho related configuration for this organization
  zoho?: {
    enabled?: boolean;
    creatorFormId?: string;
    webhookUrl?: string;
    workdriveFolderId?: string;
    signTemplateId?: string;
  };
  createdAt: Date;
}

const OrganizationSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    settings: { type: Schema.Types.Mixed, default: {} },
    zoho: {
      enabled: { type: Boolean, default: false },
      creatorFormId: { type: String },
      webhookUrl: { type: String },
      workdriveFolderId: { type: String },
      signTemplateId: { type: String },
    },
  },
  { timestamps: true }
);

export default mongoose.model<IOrganization>(
  "Organization",
  OrganizationSchema
);
