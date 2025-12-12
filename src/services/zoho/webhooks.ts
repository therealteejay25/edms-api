import { Request, Response } from "express";
import Document from "../../models/Document";
import Approval from "../../models/Approval";
import AuditLog from "../../models/AuditLog";

// Receive Zoho Creator form submission for auto-tagging
export async function receiveWebhook(req: Request, res: Response) {
  try {
    const event = req.body;
    console.log(
      "Received Zoho Creator webhook",
      JSON.stringify(event).slice(0, 2000)
    );

    // Example: Auto-tag document based on form data
    if (event.docId && event.tags) {
      const doc = await Document.findById(event.docId);
      if (doc) {
        doc.tags = [...(doc.tags || []), ...event.tags];
        await doc.save();

        await AuditLog.create({
          org: doc.org,
          user: event.userId,
          action: "document_auto_tagged_from_zoho",
          resource: "document",
          resourceId: doc._id,
          metadata: { tags: event.tags, source: "zoho_creator" },
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
}

// Receive WorkDrive upload callback
export async function receiveWorkDriveUploadWebhook(
  req: Request,
  res: Response
) {
  try {
    const { docId, zohoFileId, zohoFileUrl, status } = req.body;
    console.log("Received WorkDrive webhook", { docId, status });

    if (docId && zohoFileId) {
      const doc = await Document.findById(docId);
      if (doc) {
        doc.zohoFileId = zohoFileId;
        doc.zohoFileUrl = zohoFileUrl;
        await doc.save();

        await AuditLog.create({
          org: doc.org,
          user: doc.owner,
          action: "workdrive_upload_completed",
          resource: "document",
          resourceId: docId,
          metadata: { zohoFileId, status },
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("WorkDrive webhook error:", err);
    res.status(500).json({ error: "WorkDrive webhook failed" });
  }
}

// Receive signature completion callback
export async function receiveSignWebhook(req: Request, res: Response) {
  try {
    const { docId, envelopeId, status, signatories } = req.body;
    console.log("Received Sign webhook", { docId, status });

    if (docId && status === "completed") {
      const doc = await Document.findById(docId);
      if (doc) {
        doc.status = "active";
        doc.activity.push({
          userId: doc.owner,
          action: "document_signed",
          details: `Signed via Zoho Sign (${envelopeId})`,
          createdAt: new Date(),
        });
        await doc.save();

        await AuditLog.create({
          org: doc.org,
          user: doc.owner,
          action: "document_signed",
          resource: "document",
          resourceId: docId,
          metadata: { envelopeId, signatories },
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Sign webhook error:", err);
    res.status(500).json({ error: "Sign webhook failed" });
  }
}

// Receive Cliq message interaction
export async function receiveCliqWebhook(req: Request, res: Response) {
  try {
    const { action, docId, userId, approvalId } = req.body;
    console.log("Received Cliq webhook", { action, docId });

    if (action === "approve" && approvalId) {
      const approval = await Approval.findById(approvalId);
      if (approval) {
        approval.status = "approved";
        approval.decidedBy = userId;
        approval.decidedAt = new Date();
        await approval.save();

        const doc = await Document.findById(approval.docId);
        if (doc) {
          doc.activity.push({
            userId,
            action: "approved_via_cliq",
            details: "Approved via Zoho Cliq",
            createdAt: new Date(),
          });
          await doc.save();
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Cliq webhook error:", err);
    res.status(500).json({ error: "Cliq webhook failed" });
  }
}

export default {
  receiveWebhook,
  receiveWorkDriveUploadWebhook,
  receiveSignWebhook,
  receiveCliqWebhook,
};
