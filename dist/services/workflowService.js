"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowService = void 0;
const Workflow_1 = __importDefault(require("../models/Workflow"));
const Approval_1 = __importDefault(require("../models/Approval"));
const Document_1 = __importDefault(require("../models/Document"));
const mongoose_1 = __importDefault(require("mongoose"));
class WorkflowService {
    /**
     * Get workflow by trigger (document type or department)
     */
    static async getWorkflowForDocument(orgId, docType, department) {
        const orgObjectId = new mongoose_1.default.Types.ObjectId(String(orgId));
        return Workflow_1.default.findOne({
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
    static async autoRouteDocument(docId, workflow) {
        const docObjectId = new mongoose_1.default.Types.ObjectId(String(docId));
        if (!workflow || !workflow.steps || workflow.steps.length === 0) {
            return null;
        }
        const doc = await Document_1.default.findById(docObjectId);
        if (!doc)
            throw new Error("Document not found");
        const approvals = [];
        for (const step of workflow.steps) {
            for (const approverId of step.approvers) {
                const approval = await Approval_1.default.create({
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
        doc.approvalChain = workflow.steps.flatMap((s) => s.approvers);
        doc.nextApprovalDate = workflow.steps[0]?.dueInDays
            ? new Date(Date.now() + workflow.steps[0].dueInDays * 24 * 60 * 60 * 1000)
            : undefined;
        await doc.save();
        return approvals;
    }
    /**
     * Escalate approval to manager
     */
    static async escalateApproval(approvalId, escalateToId) {
        const approvalObjectId = new mongoose_1.default.Types.ObjectId(String(approvalId));
        const escalateToObjectId = new mongoose_1.default.Types.ObjectId(String(escalateToId));
        const approval = await Approval_1.default.findByIdAndUpdate(approvalObjectId, {
            status: "escalated",
            escalatedTo: escalateToObjectId,
            escalatedAt: new Date(),
        }, { new: true });
        return approval;
    }
    /**
     * Check if all approvals for document are complete
     */
    static async isApprovalChainComplete(docId) {
        const docObjectId = new mongoose_1.default.Types.ObjectId(String(docId));
        const pending = await Approval_1.default.countDocuments({
            docId: docObjectId,
            status: "pending",
        });
        return pending === 0;
    }
    /**
     * Get overdue approvals
     */
    static async getOverdueApprovals(orgId) {
        const orgObjectId = new mongoose_1.default.Types.ObjectId(String(orgId));
        return Approval_1.default.find({
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
    static async sendApprovalReminder(approvalId) {
        const approvalObjectId = new mongoose_1.default.Types.ObjectId(String(approvalId));
        const approval = await Approval_1.default.findById(approvalObjectId)
            .populate("assignee")
            .populate("docId");
        if (!approval || !approval.assignee) {
            return null;
        }
        const assignee = approval.assignee;
        const doc = approval.docId;
        // In production, integrate with email/Zoho Cliq
        console.log(`[Reminder] Approval pending for ${doc.title} to ${assignee.email}`);
        return {
            sent: true,
            to: assignee.email,
            approvalId,
        };
    }
}
exports.WorkflowService = WorkflowService;
exports.default = WorkflowService;
