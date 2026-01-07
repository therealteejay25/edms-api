"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listWorkflows = listWorkflows;
exports.createWorkflow = createWorkflow;
exports.updateWorkflow = updateWorkflow;
exports.deleteWorkflow = deleteWorkflow;
exports.getWorkflow = getWorkflow;
exports.testWorkflow = testWorkflow;
const Workflow_1 = __importDefault(require("../models/Workflow"));
const AuditLog_1 = __importDefault(require("../models/AuditLog"));
async function listWorkflows(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const workflows = await Workflow_1.default.find({ org: user.org });
        res.json({ workflows });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to list workflows" });
    }
}
async function createWorkflow(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const { name, description, trigger, triggerValue, steps } = req.body;
        if (user.role === "department_lead") {
            if (!user.department) {
                return res.status(400).json({ message: "Department is required" });
            }
            if (trigger !== "department") {
                return res.status(403).json({ message: "Department leads can only create department workflows" });
            }
        }
        const effectiveTriggerValue = user.role === "department_lead" ? user.department : triggerValue;
        const workflow = await Workflow_1.default.create({
            org: user.org,
            name,
            description,
            trigger,
            triggerValue: effectiveTriggerValue,
            steps,
            enabled: true,
        });
        await AuditLog_1.default.create({
            org: user.org,
            user: user._id,
            action: "workflow_created",
            resource: "workflow",
            resourceId: workflow._id,
            metadata: { name },
        });
        res.json({ workflow });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to create workflow" });
    }
}
async function updateWorkflow(req, res) {
    try {
        const { id } = req.params;
        // @ts-ignore
        const user = req.user;
        const { name, description, trigger, triggerValue, steps, enabled, } = req.body;
        const existing = await Workflow_1.default.findOne({ _id: id, org: user.org });
        if (!existing)
            return res.status(404).json({ message: "Not found" });
        if (user.role === "department_lead") {
            if (!user.department) {
                return res.status(400).json({ message: "Department is required" });
            }
            if (existing.trigger !== "department" || existing.triggerValue !== user.department) {
                return res.status(403).json({ message: "Forbidden" });
            }
            if (trigger && trigger !== "department") {
                return res.status(403).json({ message: "Department leads can only manage department workflows" });
            }
            if (triggerValue && triggerValue !== user.department) {
                return res.status(403).json({ message: "Cannot change department" });
            }
        }
        const update = { name, description, trigger, triggerValue, steps, enabled };
        if (user.role === "department_lead") {
            update.trigger = "department";
            update.triggerValue = user.department;
        }
        const workflow = await Workflow_1.default.findOneAndUpdate({ _id: id, org: user.org }, update, { new: true });
        if (!workflow)
            return res.status(404).json({ message: "Not found" });
        await AuditLog_1.default.create({
            org: user.org,
            user: user._id,
            action: "workflow_updated",
            resource: "workflow",
            resourceId: workflow._id,
            changes: { name, enabled },
        });
        res.json({ workflow });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to update workflow" });
    }
}
async function deleteWorkflow(req, res) {
    try {
        const { id } = req.params;
        // @ts-ignore
        const user = req.user;
        if (user.role === "department_lead") {
            if (!user.department) {
                return res.status(400).json({ message: "Department is required" });
            }
            const existing = await Workflow_1.default.findOne({ _id: id, org: user.org });
            if (!existing)
                return res.status(404).json({ message: "Not found" });
            if (existing.trigger !== "department" || existing.triggerValue !== user.department) {
                return res.status(403).json({ message: "Forbidden" });
            }
        }
        const workflow = await Workflow_1.default.findOneAndDelete({
            _id: id,
            org: user.org,
        });
        if (!workflow)
            return res.status(404).json({ message: "Not found" });
        const deletedName = workflow?.name;
        await AuditLog_1.default.create({
            org: user.org,
            user: user._id,
            action: "workflow_deleted",
            resource: "workflow",
            resourceId: id,
            metadata: { name: deletedName },
        });
        res.json({ ok: true });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to delete workflow" });
    }
}
async function getWorkflow(req, res) {
    try {
        const { id } = req.params;
        // @ts-ignore
        const user = req.user;
        const workflow = await Workflow_1.default.findOne({
            _id: id,
            org: user.org,
        }).populate("steps.approvers");
        if (!workflow)
            return res.status(404).json({ message: "Not found" });
        res.json({ workflow });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to get workflow" });
    }
}
async function testWorkflow(req, res) {
    try {
        const { id } = req.params;
        const { docType, department } = req.body;
        // @ts-ignore
        const user = req.user;
        const workflow = await Workflow_1.default.findOne({
            _id: id,
            org: user.org,
        });
        if (!workflow)
            return res.status(404).json({ message: "Not found" });
        // Verify trigger matches
        const matches = (workflow.trigger === "document_type" &&
            workflow.triggerValue === docType) ||
            (workflow.trigger === "department" &&
                workflow.triggerValue === department);
        res.json({
            matches,
            workflow,
            message: matches
                ? "Workflow would be triggered"
                : "Workflow would not be triggered",
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to test workflow" });
    }
}
