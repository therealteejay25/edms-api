import Approval from "../models/Approval";
import Document from "../models/Document";
import AuditLog from "../models/AuditLog";
import mongoose from "mongoose";

export class ApprovalService {
  /**
   * Approve a document
   */
  static async approveDocument(
    approvalId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    comment?: string
  ) {
    const approvalObjectId = new mongoose.Types.ObjectId(String(approvalId));
    const userObjectId = new mongoose.Types.ObjectId(String(userId));
    const approval = await Approval.findByIdAndUpdate(
      approvalObjectId,
      {
        status: "approved",
        decidedBy: userObjectId,
        decidedAt: new Date(),
        comment,
      },
      { new: true }
    );

    if (approval) {
      await AuditLog.create({
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
  static async rejectDocument(
    approvalId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    comment?: string
  ) {
    const approvalObjectId = new mongoose.Types.ObjectId(String(approvalId));
    const userObjectId = new mongoose.Types.ObjectId(String(userId));
    const approval = await Approval.findByIdAndUpdate(
      approvalObjectId,
      {
        status: "rejected",
        decidedBy: userObjectId,
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
  static async getPendingApprovalsForUser(
    userId: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ) {
    const userObjectId = new mongoose.Types.ObjectId(String(userId));
    const orgObjectId = new mongoose.Types.ObjectId(String(orgId));
    return Approval.find({
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
  static async getDocumentApprovals(docId: string | mongoose.Types.ObjectId) {
    const docObjectId = new mongoose.Types.ObjectId(String(docId));
    return Approval.find({ docId })
      .populate("decidedBy")
      .populate("assignee")
      .sort({ createdAt: -1 });
  }

  /**
   * Check approval status for document
   */
  static async getApprovalStatus(docId: string | mongoose.Types.ObjectId) {
    const docObjectId = new mongoose.Types.ObjectId(String(docId));
    const approvals = await Approval.find({ docId: docObjectId });

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
    userId: string | mongoose.Types.ObjectId,
    department: string,
    orgId: string | mongoose.Types.ObjectId
  ) {
    const userObjectId = new mongoose.Types.ObjectId(String(userId));
    const orgObjectId = new mongoose.Types.ObjectId(String(orgId));
    const approvals = await Approval.find({
      org: orgObjectId,
      assignee: userObjectId,
      status: "pending",
    }).populate("docId");

    const docIds = approvals
      .filter((a) => (a.docId as any)?.department === department)
      .map((a) => a._id);

    return Approval.updateMany(
      { _id: { $in: docIds } },
      {
        status: "approved",
        decidedBy: userObjectId,
        decidedAt: new Date(),
      }
    );
  }
}

export default ApprovalService;
