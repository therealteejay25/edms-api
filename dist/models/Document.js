"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const HistorySchema = new mongoose_1.Schema({
    version: { type: Number, required: true },
    fileUrl: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    extractedText: { type: String },
});
const CommentSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String },
    comment: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});
const ActivitySchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    action: { type: String },
    details: { type: String },
    createdAt: { type: Date, default: Date.now },
});
const DocumentSchema = new mongoose_1.Schema({
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
    owner: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    org: { type: mongoose_1.Schema.Types.ObjectId, ref: "Organization", required: true },
    fileUrl: { type: String, required: true },
    zohoFileId: { type: String },
    zohoFileUrl: { type: String },
    zohoRawResponse: { type: mongoose_1.Schema.Types.Mixed },
    version: { type: Number, default: 1 },
    history: { type: [HistorySchema], default: [] },
    comments: { type: [CommentSchema], default: [] },
    activity: { type: [ActivitySchema], default: [] },
    tags: { type: [String], default: [] },
    approvalRequired: { type: Boolean, default: false },
    legalHold: { type: Boolean, default: false },
    retentionYears: { type: Number },
    nextApprovalDate: { type: Date },
    approvalChain: { type: [mongoose_1.Schema.Types.ObjectId], ref: "User", default: [] },
    extractedText: { type: String },
}, { timestamps: true });
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
exports.default = mongoose_1.default.model("Document", DocumentSchema);
