"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listApprovals = listApprovals;
exports.getPendingApprovals = getPendingApprovals;
exports.approve = approve;
exports.reject = reject;
exports.getApprovalStatus = getApprovalStatus;
exports.escalateApproval = escalateApproval;
exports.getOverdueApprovals = getOverdueApprovals;
exports.sendReminderNotification = sendReminderNotification;
exports.bulkApprove = bulkApprove;
const Approval_1 = __importDefault(require("../models/Approval"));
const Document_1 = __importDefault(require("../models/Document"));
const approvalService_1 = __importDefault(require("../services/approvalService"));
const workflowService_1 = __importDefault(require("../services/workflowService"));
const AuditLog_1 = __importDefault(require("../models/AuditLog"));
const zohoIntegration_1 = __importDefault(require("../services/zohoIntegration"));
async function listApprovals(req, res) {
    try {
        const { status, assignee, page, limit } = req.query;
        // @ts-ignore
        const user = req.user;
        const q = { org: user.org };
        if (status)
            q.status = status;
        if (assignee)
            q.assignee = assignee;
        const skip = (parseInt(page) || 1 - 1) * (parseInt(limit) || 20);
        const total = await Approval_1.default.countDocuments(q);
        const approvals = await Approval_1.default.find(q)
            .sort({ dueDate: 1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit) || 20)
            .populate("requestedBy", "name email")
            .populate("assignee", "name email")
            .populate("decidedBy", "name email")
            .populate("docId", "title fileUrl");
        res.json({ data: approvals, total, page: parseInt(page) || 1 });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to list approvals" });
    }
}
async function getPendingApprovals(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const approvals = await approvalService_1.default.getPendingApprovalsForUser(user._id, user.org);
        res.json(approvals);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to get approvals" });
    }
}
async function approve(req, res) {
    try {
        const { id } = req.params;
        const { comment } = req.body;
        // @ts-ignore
        const user = req.user;
        const approval = await approvalService_1.default.approveDocument(id, user._id, comment);
        if (approval) {
            const doc = await Document_1.default.findById(approval.docId);
            if (doc) {
                doc.activity.push({
                    userId: user._id,
                    action: "approved",
                    details: comment || "approved by " + user.name,
                    createdAt: new Date(),
                });
                await doc.save();
            }
            zohoIntegration_1.default.onApproval(approval).catch((e) => console.warn("Zoho approval hook failed", e));
        }
        res.json({ ok: true, approval });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to approve" });
    }
}
async function reject(req, res) {
    try {
        const { id } = req.params;
        const { comment } = req.body;
        // @ts-ignore
        const user = req.user;
        const approval = await approvalService_1.default.rejectDocument(id, user._id, comment);
        if (approval) {
            const doc = await Document_1.default.findById(approval.docId);
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
            zohoIntegration_1.default.onApproval(approval).catch((e) => console.warn("Zoho approval hook failed", e));
        }
        res.json({ ok: true, approval });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to reject" });
    }
}
async function getApprovalStatus(req, res) {
    try {
        const { docId } = req.params;
        const status = await approvalService_1.default.getApprovalStatus(docId);
        res.json({ status });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to get approval status" });
    }
}
async function escalateApproval(req, res) {
    try {
        const { id } = req.params;
        const { escalateToId } = req.body;
        // @ts-ignore
        const user = req.user;
        const approval = await workflowService_1.default.escalateApproval(id, escalateToId);
        await AuditLog_1.default.create({
            org: approval?.org,
            user: user._id,
            action: "approval_escalated",
            resource: "approval",
            resourceId: id,
            changes: { escalatedTo: escalateToId },
        });
        res.json({ approval });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to escalate approval" });
    }
}
async function getOverdueApprovals(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const overdue = await workflowService_1.default.getOverdueApprovals(user.org);
        res.json(overdue);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to get overdue approvals" });
    }
}
async function sendReminderNotification(req, res) {
    try {
        const { id } = req.params;
        const result = await workflowService_1.default.sendApprovalReminder(id);
        res.json({ result });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to send reminder" });
    }
}
async function bulkApprove(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const { department } = req.body;
        const result = await approvalService_1.default.bulkApproveByDepartment(user._id, department, user.org);
        await AuditLog_1.default.create({
            org: user.org,
            user: user._id,
            action: "bulk_approval",
            resource: "approval",
            resourceId: user._id,
            changes: { department, approvedCount: result.modifiedCount },
        });
        res.json({ approved: result.modifiedCount });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to bulk approve" });
    }
}
