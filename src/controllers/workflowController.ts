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

    const workflow = await Workflow.create({
      org: user.org,
      name,
      description,
      trigger,
      triggerValue,
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

    const workflow = await Workflow.findOneAndUpdate(
      { _id: id, org: user.org },
      { name, description, trigger, triggerValue, steps, enabled },
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

    const workflow = await Workflow.findOneAndDelete({
      _id: id,
      org: user.org,
    });

    if (!workflow) return res.status(404).json({ message: "Not found" });

    await AuditLog.create({
      org: user.org,
      user: user._id,
      action: "workflow_deleted",
      resource: "workflow",
      resourceId: id,
      metadata: { name: workflow.name },
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
