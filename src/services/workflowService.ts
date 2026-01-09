import Workflow from "../models/Workflow";
import Approval from "../models/Approval";
import User from "../models/User";
import Document from "../models/Document";
import mongoose from "mongoose";

export class WorkflowService {
  /**
   * Get workflow by trigger (document type or department)
   */
  static async getWorkflowForDocument(
    orgId: string | mongoose.Types.ObjectId,
    docType: string,
    department: string
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(String(orgId));
    return Workflow.findOne({
      org: orgObjectId,
      enabled: true,
      $or: [
        { trigger: "document_type", triggerValue: docType },
        { trigger: "department", triggerValue: department },
      ],
    });
  }

  /**
   * Auto-route document through workflow
   */
  static async autoRouteDocument(
    docId: string | mongoose.Types.ObjectId,
    workflow: any
  ) {
    const docObjectId = new mongoose.Types.ObjectId(String(docId));
    if (!workflow || !workflow.steps || workflow.steps.length === 0) {
      return null;
    }

    const doc = await Document.findById(docObjectId);
    if (!doc) throw new Error("Document not found");

    const approvals = [];
    for (const step of workflow.steps) {
      for (const approverId of step.approvers) {
        const approval = await Approval.create({
          docId: docObjectId,
          org: doc.org,
          status: "pending",
          requestedBy: doc.owner,
          requestedAt: new Date(),
          assignee: approverId,
          priority: "medium",
          dueDate: step.dueInDays
            ? new Date(Date.now() + step.dueInDays * 24 * 60 * 60 * 1000)
            : undefined,
        });
        approvals.push(approval);
      }
    }

    doc.approvalChain = workflow.steps.flatMap((s: any) => s.approvers);
    doc.nextApprovalDate = workflow.steps[0]?.dueInDays
      ? new Date(Date.now() + workflow.steps[0].dueInDays * 24 * 60 * 60 * 1000)
      : undefined;
    await doc.save();

    return approvals;
  }

  /**
   * Escalate approval to manager
   */
  static async escalateApproval(
    approvalId: string | mongoose.Types.ObjectId,
    escalateToId: string | mongoose.Types.ObjectId
  ) {
    const approvalObjectId = new mongoose.Types.ObjectId(String(approvalId));
    const escalateToObjectId = new mongoose.Types.ObjectId(String(escalateToId));
    const approval = await Approval.findByIdAndUpdate(
      approvalObjectId,
      {
        status: "escalated",
        escalatedTo: escalateToObjectId,
        escalatedAt: new Date(),
      },
      { new: true }
    );
    return approval;
  }

  /**
   * Check if all approvals for document are complete
   */
  static async isApprovalChainComplete(docId: string | mongoose.Types.ObjectId) {
    const docObjectId = new mongoose.Types.ObjectId(String(docId));
    const pending = await Approval.countDocuments({
      docId: docObjectId,
      status: "pending",
    });
    return pending === 0;
  }

  /**
   * Get overdue approvals
   */
  static async getOverdueApprovals(orgId: string | mongoose.Types.ObjectId) {
    const orgObjectId = new mongoose.Types.ObjectId(String(orgId));
    return Approval.find({
      org: orgObjectId,
      status: "pending",
      dueDate: { $lt: new Date() },
    })
      .populate("assignee")
      .populate("docId");
  }

  /**
   * Send approval reminder (stub for notification service)
   */
  static async sendApprovalReminder(
    approvalId: string | mongoose.Types.ObjectId
  ) {
    const approvalObjectId = new mongoose.Types.ObjectId(String(approvalId));
    const approval = await Approval.findById(approvalObjectId)
      .populate("assignee")
      .populate("docId");

    if (!approval || !approval.assignee) {
      return null;
    }

    const assignee = approval.assignee as any;
    const doc = approval.docId as any;

    // In production, integrate with email/Zoho Cliq
    console.log(
      `[Reminder] Approval pending for ${doc.title} to ${assignee.email}`
    );

    return {
      sent: true,
      to: assignee.email,
      approvalId,
    };
  }
}

export default WorkflowService;
