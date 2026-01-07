"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExpiringDocuments = getExpiringDocuments;
exports.sendExpiryReminders = sendExpiryReminders;
exports.archiveExpiredDocuments = archiveExpiredDocuments;
const Document_1 = __importDefault(require("../models/Document"));
const AuditLog_1 = __importDefault(require("../models/AuditLog"));
/**
 * Get documents expiring soon (within X days)
 */
async function getExpiringDocuments(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const days = parseInt(req.query.days) || 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() + days);
        const expiring = await Document_1.default.find({
            org: user.org,
            expiryDate: { $lte: cutoffDate, $gte: new Date() },
            status: { $ne: "archived" },
        })
            .populate("owner", "name email")
            .sort({ expiryDate: 1 });
        res.json({ documents: expiring, count: expiring.length });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to get expiring documents" });
    }
}
/**
 * Send expiry reminders (would integrate with email/notification service)
 */
async function sendExpiryReminders(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const days = parseInt(req.body.days) || 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() + days);
        const expiring = await Document_1.default.find({
            org: user.org,
            expiryDate: { $lte: cutoffDate, $gte: new Date() },
            status: { $ne: "archived" },
        }).populate("owner", "name email");
        // In production, this would send emails/notifications
        // For now, just return the list
        res.json({
            sent: expiring.length,
            documents: expiring.map((d) => ({
                id: d._id,
                title: d.title,
                expiryDate: d.expiryDate,
                owner: d.owner,
            })),
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to send reminders" });
    }
}
/**
 * Auto-archive expired documents
 */
async function archiveExpiredDocuments(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const now = new Date();
        const result = await Document_1.default.updateMany({
            org: user.org,
            expiryDate: { $lt: now },
            status: { $ne: "archived" },
            legalHold: false,
        }, { status: "expired" });
        await AuditLog_1.default.create({
            org: user.org,
            user: user._id,
            action: "bulk_archive_expired",
            resource: "document",
            resourceId: user._id,
            changes: { archivedCount: result.modifiedCount },
        });
        res.json({
            archived: result.modifiedCount,
            message: `Archived ${result.modifiedCount} expired documents`,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to archive expired documents" });
    }
}
