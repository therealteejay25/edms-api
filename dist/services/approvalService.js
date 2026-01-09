"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalService = void 0;
const Approval_1 = __importDefault(require("../models/Approval"));
const Document_1 = __importDefault(require("../models/Document"));
const AuditLog_1 = __importDefault(require("../models/AuditLog"));
const mongoose_1 = __importDefault(require("mongoose"));
class ApprovalService {
    /**
     * Approve a document
     */
    static async approveDocument(approvalId, userId, comment) {
        const approvalObjectId = new mongoose_1.default.Types.ObjectId(String(approvalId));
        const userObjectId = new mongoose_1.default.Types.ObjectId(String(userId));
        const approval = await Approval_1.default.findByIdAndUpdate(approvalObjectId, {
            status: "approved",
            decidedBy: userObjectId,
            decidedAt: new Date(),
            comment,
        }, { new: true });
        if (approval) {
            await AuditLog_1.default.create({
                org: approval.org,
                user: userObjectId,
                action: "document_approved",
                resource: "approval",
                resourceId: approval._id,
                changes: { status: "approved" },
            });
        }
        return approval;
    }
    /**
     * Reject a document
     */
    static async rejectDocument(approvalId, userId, comment) {
        const approvalObjectId = new mongoose_1.default.Types.ObjectId(String(approvalId));
        const userObjectId = new mongoose_1.default.Types.ObjectId(String(userId));
        const approval = await Approval_1.default.findByIdAndUpdate(approvalObjectId, {
            status: "rejected",
            decidedBy: userObjectId,
            decidedAt: new Date(),
            comment,
        }, { new: true });
        if (approval) {
            // Update document status if all approvals are rejected
            const doc = await Document_1.default.findById(approval.docId);
            if (doc) {
                doc.status = "draft";
                await doc.save();
            }
            await AuditLog_1.default.create({
                org: approval.org,
                user: userObjectId,
                action: "document_rejected",
                resource: "approval",
                resourceId: approval._id,
                changes: { status: "rejected", reason: comment },
            });
        }
        return approval;
    }
    /**
     * Get pending approvals for user
     */
    static async getPendingApprovalsForUser(userId, orgId) {
        const userObjectId = new mongoose_1.default.Types.ObjectId(String(userId));
        const orgObjectId = new mongoose_1.default.Types.ObjectId(String(orgId));
        return Approval_1.default.find({
            org: orgObjectId,
            $or: [{ assignee: userObjectId }, { escalatedTo: userObjectId }],
            status: { $in: ["pending", "escalated"] },
        })
            .populate("docId")
            .populate("requestedBy")
            .sort({ dueDate: 1 });
    }
    /**
     * Get all approvals for a document
     */
    static async getDocumentApprovals(docId) {
        const docObjectId = new mongoose_1.default.Types.ObjectId(String(docId));
        return Approval_1.default.find({ docId })
            .populate("decidedBy")
            .populate("assignee")
            .sort({ createdAt: -1 });
    }
    /**
     * Check approval status for document
     */
    static async getApprovalStatus(docId) {
        const docObjectId = new mongoose_1.default.Types.ObjectId(String(docId));
        const approvals = await Approval_1.default.find({ docId: docObjectId });
        const totalApprovals = approvals.length;
        const approved = approvals.filter((a) => a.status === "approved").length;
        const rejected = approvals.filter((a) => a.status === "rejected").length;
        const pending = approvals.filter((a) => a.status === "pending").length;
        return {
            total: totalApprovals,
            approved,
            rejected,
            pending,
            percentage: totalApprovals > 0 ? (approved / totalApprovals) * 100 : 0,
            complete: pending === 0 && rejected === 0,
        };
    }
    /**
     * Mass approve for department lead (all docs from their department)
     */
    static async bulkApproveByDepartment(userId, department, orgId) {
        const userObjectId = new mongoose_1.default.Types.ObjectId(String(userId));
        const orgObjectId = new mongoose_1.default.Types.ObjectId(String(orgId));
        const approvals = await Approval_1.default.find({
            org: orgObjectId,
            assignee: userObjectId,
            status: "pending",
        }).populate("docId");
        const docIds = approvals
            .filter((a) => a.docId?.department === department)
            .map((a) => a._id);
        return Approval_1.default.updateMany({ _id: { $in: docIds } }, {
            status: "approved",
            decidedBy: userObjectId,
            decidedAt: new Date(),
        });
    }
}
exports.ApprovalService = ApprovalService;
exports.default = ApprovalService;
