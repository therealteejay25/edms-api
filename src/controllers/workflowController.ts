import { Request, Response } from "express";
import Workflow from "../models/Workflow";
import WorkflowService from "../services/workflowService";
import AuditLog from "../models/AuditLog";

export async function listWorkflows(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const workflows = await Workflow.find({ org: user.org });
    res.json({ workflows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to list workflows" });
  }
}

export async function createWorkflow(req: Request, res: Response) {
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

    const effectiveTriggerValue =
      user.role === "department_lead" ? user.department : triggerValue;

    const workflow = await Workflow.create({
      org: user.org,
      name,
      description,
      trigger,
      triggerValue: effectiveTriggerValue,
      steps,
      enabled: true,
    });

    await AuditLog.create({
      org: user.org,
      user: user._id,
      action: "workflow_created",
      resource: "workflow",
      resourceId: workflow._id,
      metadata: { name },
    });

    res.json({ workflow });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create workflow" });
  }
}

export async function updateWorkflow(req: Request, res: Response) {
  try {
    const { id } = req.params;
    // @ts-ignore
    const user = req.user;
    const {
      name,
      description,
      trigger,
      triggerValue,
      steps,
      enabled,
    } = req.body;

    const existing = await Workflow.findOne({ _id: id, org: user.org });
    if (!existing) return res.status(404).json({ message: "Not found" });

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

    const update: any = { name, description, trigger, triggerValue, steps, enabled };
    if (user.role === "department_lead") {
      update.trigger = "department";
      update.triggerValue = user.department;
    }

    const workflow = await Workflow.findOneAndUpdate(
      { _id: id, org: user.org },
      update,
      { new: true }
    );

    if (!workflow) return res.status(404).json({ message: "Not found" });

    await AuditLog.create({
      org: user.org,
      user: user._id,
      action: "workflow_updated",
      resource: "workflow",
      resourceId: workflow._id,
      changes: { name, enabled },
    });

    res.json({ workflow });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update workflow" });
  }
}

export async function deleteWorkflow(req: Request, res: Response) {
  try {
    const { id } = req.params;
    // @ts-ignore
    const user = req.user;

    if (user.role === "department_lead") {
      if (!user.department) {
        return res.status(400).json({ message: "Department is required" });
      }
      const existing = await Workflow.findOne({ _id: id, org: user.org });
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.trigger !== "department" || existing.triggerValue !== user.department) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }

    const workflow = await Workflow.findOneAndDelete({
      _id: id,
      org: user.org,
    });

    if (!workflow) return res.status(404).json({ message: "Not found" });

    const deletedName = (workflow as any)?.name;

    await AuditLog.create({
      org: user.org,
      user: user._id,
      action: "workflow_deleted",
      resource: "workflow",
      resourceId: id,
      metadata: { name: deletedName },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete workflow" });
  }
}

export async function getWorkflow(req: Request, res: Response) {
  try {
    const { id } = req.params;
    // @ts-ignore
    const user = req.user;

    const workflow = await Workflow.findOne({
      _id: id,
      org: user.org,
    }).populate("steps.approvers");

    if (!workflow) return res.status(404).json({ message: "Not found" });

    res.json({ workflow });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get workflow" });
  }
}

export async function testWorkflow(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { docType, department } = req.body;
    // @ts-ignore
    const user = req.user;

    const workflow = await Workflow.findOne({
      _id: id,
      org: user.org,
    });

    if (!workflow) return res.status(404).json({ message: "Not found" });

    // Verify trigger matches
    const matches =
      (workflow.trigger === "document_type" &&
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to test workflow" });
  }
}
