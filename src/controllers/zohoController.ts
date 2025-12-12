import { Request, Response } from "express";
import Organization from "../models/Organization";
import Document from "../models/Document";
import AuditLog from "../models/AuditLog";

export async function getIntegrationStatus(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const org = await Organization.findById(user.org);
    res.json({
      enabled: org?.zoho?.enabled || false,
      hasWebhookUrl: !!org?.zoho?.webhookUrl,
      hasWorkDriveFolder: !!org?.zoho?.workdriveFolderId,
      hasSignTemplate: !!org?.zoho?.signTemplateId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get integration status" });
  }
}

export async function setupWebhookUrl(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const { webhookUrl } = req.body;

    const org = await Organization.findByIdAndUpdate(
      user.org,
      { "zoho.webhookUrl": webhookUrl },
      { new: true }
    );

    await AuditLog.create({
      org: user.org,
      user: user._id,
      action: "zoho_webhook_configured",
      resource: "settings",
      resourceId: user.org,
      metadata: { webhookUrl },
    });

    res.json({ ok: true, org });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to setup webhook" });
  }
}

export async function uploadToWorkDrive(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const { docId } = req.body;

    const doc = await Document.findOne({ _id: docId, org: user.org });
    if (!doc) return res.status(404).json({ message: "Document not found" });

    // In production, this would call Zoho WorkDrive API
    // For now, mock the upload
    const mockZohoFileId = `zoho_${Date.now()}`;
    const mockZohoUrl = `https://workdrive.zoho.com/file/${mockZohoFileId}`;

    doc.zohoFileId = mockZohoFileId;
    doc.zohoFileUrl = mockZohoUrl;
    await doc.save();

    await AuditLog.create({
      org: user.org,
      user: user._id,
      action: "document_uploaded_to_workdrive",
      resource: "document",
      resourceId: docId,
      metadata: { zohoFileId: mockZohoFileId },
    });

    res.json({
      ok: true,
      zohoFileId: mockZohoFileId,
      zohoUrl: mockZohoUrl,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to upload to WorkDrive" });
  }
}

export async function sendForSignature(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const { docId, signatories } = req.body;

    const doc = await Document.findOne({ _id: docId, org: user.org });
    if (!doc) return res.status(404).json({ message: "Document not found" });

    // Mock sending to Zoho Sign
    const mockEnvelopeId = `zoho_sign_${Date.now()}`;

    await AuditLog.create({
      org: user.org,
      user: user._id,
      action: "document_sent_for_signature",
      resource: "document",
      resourceId: docId,
      metadata: { signatories, envelopeId: mockEnvelopeId },
    });

    res.json({
      ok: true,
      envelopeId: mockEnvelopeId,
      signatories,
      status: "sent_for_signing",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send for signature" });
  }
}

export async function sendCliqNotification(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const { docId, message, recipients } = req.body;

    const doc = await Document.findOne({ _id: docId, org: user.org });
    if (!doc) return res.status(404).json({ message: "Document not found" });

    // Mock Zoho Cliq notification
    console.log(`[Cliq Notification] ${message} to ${recipients.join(", ")}`);

    await AuditLog.create({
      org: user.org,
      user: user._id,
      action: "cliq_notification_sent",
      resource: "document",
      resourceId: docId,
      metadata: { message, recipients },
    });

    res.json({
      ok: true,
      notificationId: `cliq_${Date.now()}`,
      sentTo: recipients,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send Cliq notification" });
  }
}
