import { Request, Response } from "express";
import Approval from "../models/Approval";
import Document from "../models/Document";

export async function listApprovals(req: Request, res: Response) {
  try {
    const { status } = req.query as any;
    // @ts-ignore
    const user = req.user;
    const q: any = { org: user.org };
    if (status) q.status = status;
    const approvals = await Approval.find(q)
      .sort({ requestedAt: -1 })
      .limit(200)
      .populate("requestedBy", "name email");
    res.json({ data: approvals });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Failed to list approvals" });
  }
}

export async function approve(req: Request, res: Response) {
  try {
    const { id } = req.params;
    // @ts-ignore
    const user = req.user;
    const approval = await Approval.findById(id);
    if (!approval) return res.status(404).json({ message: "Not found" });
    if (String(approval.org) !== String(user.org))
      return res.status(403).json({ message: "Forbidden" });
    approval.status = "approved";
    approval.decidedBy = user._id;
    approval.decidedAt = new Date();
    await approval.save();
    const doc = await Document.findById(approval.docId);
    if (doc) {
      doc.status = "approved";
      doc.activity.push({ userId: user._id, action: "approved document" });
      await doc.save();
    }
    // notify Zoho
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Zoho = require("../services/zohoIntegration").default;
    Zoho.onApproval(approval).catch((e: any) =>
      console.warn("Zoho approval hook failed", e)
    );
    res.json({ ok: true, approval });
  } catch (err) {
    // eslint-disable-next-line no-console
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
    const approval = await Approval.findById(id);
    if (!approval) return res.status(404).json({ message: "Not found" });
    if (String(approval.org) !== String(user.org))
      return res.status(403).json({ message: "Forbidden" });
    approval.status = "rejected";
    approval.decidedBy = user._id;
    approval.decidedAt = new Date();
    approval.comment = comment;
    await approval.save();
    const doc = await Document.findById(approval.docId);
    if (doc) {
      doc.status = "rejected";
      doc.activity.push({
        userId: user._id,
        action: "rejected document",
        details: comment,
      });
      await doc.save();
    }
    // notify Zoho
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Zoho = require("../services/zohoIntegration").default;
    Zoho.onApproval(approval).catch((e: any) =>
      console.warn("Zoho approval hook failed", e)
    );
    res.json({ ok: true, approval });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Failed to reject" });
  }
}
