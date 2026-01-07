"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.receiveWebhook = receiveWebhook;
exports.receiveWorkDriveUploadWebhook = receiveWorkDriveUploadWebhook;
exports.receiveSignWebhook = receiveSignWebhook;
exports.receiveCliqWebhook = receiveCliqWebhook;
const Document_1 = __importDefault(require("../../models/Document"));
const Approval_1 = __importDefault(require("../../models/Approval"));
const AuditLog_1 = __importDefault(require("../../models/AuditLog"));
// Receive Zoho Creator form submission for auto-tagging
async function receiveWebhook(req, res) {
    try {
        const event = req.body;
        console.log("Received Zoho Creator webhook", JSON.stringify(event).slice(0, 2000));
        // Example: Auto-tag document based on form data
        if (event.docId && event.tags) {
            const doc = await Document_1.default.findById(event.docId);
            if (doc) {
                doc.tags = [...(doc.tags || []), ...event.tags];
                await doc.save();
                await AuditLog_1.default.create({
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
    }
    catch (err) {
        console.error("Webhook error:", err);
        res.status(500).json({ error: "Webhook processing failed" });
    }
}
// Receive WorkDrive upload callback
async function receiveWorkDriveUploadWebhook(req, res) {
    try {
        const { docId, zohoFileId, zohoFileUrl, status } = req.body;
        console.log("Received WorkDrive webhook", { docId, status });
        if (docId && zohoFileId) {
            const doc = await Document_1.default.findById(docId);
            if (doc) {
                doc.zohoFileId = zohoFileId;
                doc.zohoFileUrl = zohoFileUrl;
                await doc.save();
                await AuditLog_1.default.create({
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
    }
    catch (err) {
        console.error("WorkDrive webhook error:", err);
        res.status(500).json({ error: "WorkDrive webhook failed" });
    }
}
// Receive signature completion callback
async function receiveSignWebhook(req, res) {
    try {
        const { docId, envelopeId, status, signatories } = req.body;
        console.log("Received Sign webhook", { docId, status });
        if (docId && status === "completed") {
            const doc = await Document_1.default.findById(docId);
            if (doc) {
                doc.status = "active";
                doc.activity.push({
                    userId: doc.owner,
                    action: "document_signed",
                    details: `Signed via Zoho Sign (${envelopeId})`,
                    createdAt: new Date(),
                });
                await doc.save();
                await AuditLog_1.default.create({
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
    }
    catch (err) {
        console.error("Sign webhook error:", err);
        res.status(500).json({ error: "Sign webhook failed" });
    }
}
// Receive Cliq message interaction
async function receiveCliqWebhook(req, res) {
    try {
        const { action, docId, userId, approvalId } = req.body;
        console.log("Received Cliq webhook", { action, docId });
        if (action === "approve" && approvalId) {
            const approval = await Approval_1.default.findById(approvalId);
            if (approval) {
                approval.status = "approved";
                approval.decidedBy = userId;
                approval.decidedAt = new Date();
                await approval.save();
                const doc = await Document_1.default.findById(approval.docId);
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
    }
    catch (err) {
        console.error("Cliq webhook error:", err);
        res.status(500).json({ error: "Cliq webhook failed" });
    }
}
exports.default = {
    receiveWebhook,
    receiveWorkDriveUploadWebhook,
    receiveSignWebhook,
    receiveCliqWebhook,
};
