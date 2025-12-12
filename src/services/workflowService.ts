import Workflow from "../models/Workflow";
import Approval from "../models/Approval";
import User from "../models/User";
import Document from "../models/Document";
import { ObjectId } from "mongoose";

export class WorkflowService {
  /**
   * Get workflow by trigger (document type or department)
   */
  static async getWorkflowForDocument(
    orgId: ObjectId,
    docType: string,
    department: string
  ) {
    return Workflow.findOne({
      org: orgId,
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
  static async autoRouteDocument(docId: ObjectId, workflow: any) {
    if (!workflow || !workflow.steps || workflow.steps.length === 0) {
      return null;
    }

    const doc = await Document.findById(docId);
    if (!doc) throw new Error("Document not found");

    const approvals = [];
    for (const step of workflow.steps) {
      for (const approverId of step.approvers) {
        const approval = await Approval.create({
          docId,
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
  static async escalateApproval(approvalId: ObjectId, escalateToId: ObjectId) {
    const approval = await Approval.findByIdAndUpdate(
      approvalId,
      {
        status: "escalated",
        escalatedTo: escalateToId,
        escalatedAt: new Date(),
      },
      { new: true }
    );
    return approval;
  }

  /**
   * Check if all approvals for document are complete
   */
  static async isApprovalChainComplete(docId: ObjectId) {
    const pending = await Approval.countDocuments({
      docId,
      status: "pending",
    });
    return pending === 0;
  }

  /**
   * Get overdue approvals
   */
  static async getOverdueApprovals(orgId: ObjectId) {
    return Approval.find({
      org: orgId,
      status: "pending",
      dueDate: { $lt: new Date() },
    })
      .populate("assignee")
      .populate("docId");
  }

  /**
   * Send approval reminder (stub for notification service)
   */
  static async sendApprovalReminder(approvalId: ObjectId) {
    const approval = await Approval.findById(approvalId)
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
