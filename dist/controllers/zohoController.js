"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIntegrationStatus = getIntegrationStatus;
exports.setupWebhookUrl = setupWebhookUrl;
exports.uploadToWorkDrive = uploadToWorkDrive;
exports.sendForSignature = sendForSignature;
exports.sendCliqNotification = sendCliqNotification;
const Organization_1 = __importDefault(require("../models/Organization"));
const Document_1 = __importDefault(require("../models/Document"));
const AuditLog_1 = __importDefault(require("../models/AuditLog"));
async function getIntegrationStatus(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const org = await Organization_1.default.findById(user.org);
        res.json({
            enabled: org?.zoho?.enabled || false,
            hasWebhookUrl: !!org?.zoho?.webhookUrl,
            hasWorkDriveFolder: !!org?.zoho?.workdriveFolderId,
            hasSignTemplate: !!org?.zoho?.signTemplateId,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to get integration status" });
    }
}
async function setupWebhookUrl(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const { webhookUrl } = req.body;
        const org = await Organization_1.default.findByIdAndUpdate(user.org, { "zoho.webhookUrl": webhookUrl }, { new: true });
        await AuditLog_1.default.create({
            org: user.org,
            user: user._id,
            action: "zoho_webhook_configured",
            resource: "settings",
            resourceId: user.org,
            metadata: { webhookUrl },
        });
        res.json({ ok: true, org });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to setup webhook" });
    }
}
async function uploadToWorkDrive(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const { docId } = req.body;
        const doc = await Document_1.default.findOne({ _id: docId, org: user.org });
        if (!doc)
            return res.status(404).json({ message: "Document not found" });
        // In production, this would call Zoho WorkDrive API
        // For now, mock the upload
        const mockZohoFileId = `zoho_${Date.now()}`;
        const mockZohoUrl = `https://workdrive.zoho.com/file/${mockZohoFileId}`;
        doc.zohoFileId = mockZohoFileId;
        doc.zohoFileUrl = mockZohoUrl;
        await doc.save();
        await AuditLog_1.default.create({
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to upload to WorkDrive" });
    }
}
async function sendForSignature(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const { docId, signatories } = req.body;
        const doc = await Document_1.default.findOne({ _id: docId, org: user.org });
        if (!doc)
            return res.status(404).json({ message: "Document not found" });
        // Mock sending to Zoho Sign
        const mockEnvelopeId = `zoho_sign_${Date.now()}`;
        await AuditLog_1.default.create({
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to send for signature" });
    }
}
async function sendCliqNotification(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const { docId, message, recipients } = req.body;
        const doc = await Document_1.default.findOne({ _id: docId, org: user.org });
        if (!doc)
            return res.status(404).json({ message: "Document not found" });
        // Mock Zoho Cliq notification
        console.log(`[Cliq Notification] ${message} to ${recipients.join(", ")}`);
        await AuditLog_1.default.create({
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to send Cliq notification" });
    }
}
