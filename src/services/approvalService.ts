import Approval from "../models/Approval";
import Document from "../models/Document";
import AuditLog from "../models/AuditLog";
import { ObjectId } from "mongoose";

export class ApprovalService {
  /**
   * Approve a document
   */
  static async approveDocument(
    approvalId: ObjectId,
    userId: ObjectId,
    comment?: string
  ) {
    const approval = await Approval.findByIdAndUpdate(
      approvalId,
      {
        status: "approved",
        decidedBy: userId,
        decidedAt: new Date(),
        comment,
      },
      { new: true }
    );

    if (approval) {
      await AuditLog.create({
        org: approval.org,
        user: userId,
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
  static async rejectDocument(
    approvalId: ObjectId,
    userId: ObjectId,
    comment?: string
  ) {
    const approval = await Approval.findByIdAndUpdate(
      approvalId,
      {
        status: "rejected",
        decidedBy: userId,
        decidedAt: new Date(),
        comment,
      },
      { new: true }
    );

    if (approval) {
      // Update document status if all approvals are rejected
      const doc = await Document.findById(approval.docId);
      if (doc) {
        doc.status = "draft";
        await doc.save();
      }

      await AuditLog.create({
        org: approval.org,
        user: userId,
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
  static async getPendingApprovalsForUser(userId: ObjectId, orgId: ObjectId) {
    return Approval.find({
      org: orgId,
      $or: [{ assignee: userId }, { escalatedTo: userId }],
      status: { $in: ["pending", "escalated"] },
    })
      .populate("docId")
      .populate("requestedBy")
      .sort({ dueDate: 1 });
  }

  /**
   * Get all approvals for a document
   */
  static async getDocumentApprovals(docId: ObjectId) {
    return Approval.find({ docId })
      .populate("decidedBy")
      .populate("assignee")
      .sort({ createdAt: -1 });
  }

  /**
   * Check approval status for document
   */
  static async getApprovalStatus(docId: ObjectId) {
    const approvals = await Approval.find({ docId });

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
  static async bulkApproveByDepartment(
    userId: ObjectId,
    department: string,
    orgId: ObjectId
  ) {
    const approvals = await Approval.find({
      org: orgId,
      assignee: userId,
      status: "pending",
    }).populate("docId");

    const docIds = approvals
      .filter((a) => (a.docId as any)?.department === department)
      .map((a) => a._id);

    return Approval.updateMany(
      { _id: { $in: docIds } },
      {
        status: "approved",
        decidedBy: userId,
        decidedAt: new Date(),
      }
    );
  }
}

export default ApprovalService;
