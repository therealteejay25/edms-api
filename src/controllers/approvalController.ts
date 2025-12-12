import { Request, Response } from "express";
import Approval from "../models/Approval";
import Document from "../models/Document";
import ApprovalService from "../services/approvalService";
import WorkflowService from "../services/workflowService";
import AuditLog from "../models/AuditLog";
import Zoho from "../services/zohoIntegration";

export async function listApprovals(req: Request, res: Response) {
  try {
    const { status, assignee, page, limit } = req.query as any;
    // @ts-ignore
    const user = req.user;
    const q: any = { org: user.org };
    if (status) q.status = status;
    if (assignee) q.assignee = assignee;

    const skip = (parseInt(page) || 1 - 1) * (parseInt(limit) || 20);
    const total = await Approval.countDocuments(q);

    const approvals = await Approval.find(q)
      .sort({ dueDate: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit) || 20)
      .populate("requestedBy", "name email")
      .populate("assignee", "name email")
      .populate("decidedBy", "name email")
      .populate("docId", "title fileUrl");

    res.json({ data: approvals, total, page: parseInt(page) || 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to list approvals" });
  }
}

export async function getPendingApprovals(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const approvals = await ApprovalService.getPendingApprovalsForUser(
      user._id,
      user.org
    );
    res.json(approvals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get approvals" });
  }
}

export async function approve(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    // @ts-ignore
    const user = req.user;

    const approval = await ApprovalService.approveDocument(
      id,
      user._id,
      comment
    );

    if (approval) {
      const doc = await Document.findById(approval.docId);
      if (doc) {
        doc.activity.push({
          userId: user._id,
          action: "approved",
          details: comment || "approved by " + user.name,
          createdAt: new Date(),
        });
        await doc.save();
      }

      Zoho.onApproval(approval).catch((e: any) =>
        console.warn("Zoho approval hook failed", e)
      );
    }

    res.json({ ok: true, approval });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to approve" });
  }
}

export async function reject(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    // @ts-ignore
    const user = req.user;

    const approval = await ApprovalService.rejectDocument(
      id,
      user._id,
      comment
    );

    if (approval) {
      const doc = await Document.findById(approval.docId);
      if (doc) {
        doc.status = "draft";
        doc.activity.push({
          userId: user._id,
          action: "rejected",
          details: comment || "rejected by " + user.name,
          createdAt: new Date(),
        });
        await doc.save();
      }

      Zoho.onApproval(approval).catch((e: any) =>
        console.warn("Zoho approval hook failed", e)
      );
    }

    res.json({ ok: true, approval });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to reject" });
  }
}

export async function getApprovalStatus(req: Request, res: Response) {
  try {
    const { docId } = req.params;
    const status = await ApprovalService.getApprovalStatus(docId);
    res.json({ status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get approval status" });
  }
}

export async function escalateApproval(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { escalateToId } = req.body;
    // @ts-ignore
    const user = req.user;

    const approval = await WorkflowService.escalateApproval(id, escalateToId);

    await AuditLog.create({
      org: approval?.org,
      user: user._id,
      action: "approval_escalated",
      resource: "approval",
      resourceId: id,
      changes: { escalatedTo: escalateToId },
    });

    res.json({ approval });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to escalate approval" });
  }
}

export async function getOverdueApprovals(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const overdue = await WorkflowService.getOverdueApprovals(user.org);
    res.json(overdue);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get overdue approvals" });
  }
}

export async function sendReminderNotification(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await WorkflowService.sendApprovalReminder(id);
    res.json({ result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send reminder" });
  }
}

export async function bulkApprove(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const { department } = req.body;

    const result = await ApprovalService.bulkApproveByDepartment(
      user._id,
      department,
      user.org
    );

    await AuditLog.create({
      org: user.org,
      user: user._id,
      action: "bulk_approval",
      resource: "approval",
      resourceId: user._id,
      changes: { department, approvedCount: result.modifiedCount },
    });

    res.json({ approved: result.modifiedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to bulk approve" });
  }
}
