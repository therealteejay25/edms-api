"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLog = getAuditLog;
exports.getDocumentAudit = getDocumentAudit;
exports.exportAuditLog = exportAuditLog;
exports.checkRetention = checkRetention;
exports.pruneOldDocuments = pruneOldDocuments;
const AuditLog_1 = __importDefault(require("../models/AuditLog"));
const documentService_1 = __importDefault(require("../services/documentService"));
const mongoose_1 = __importDefault(require("mongoose"));
async function getAuditLog(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const { resource, resourceId, action, page, limit, dateFrom, dateTo, startDate, endDate, } = req.query;
        const query = { org: user.org };
        if (resource)
            query.resource = resource;
        if (resourceId)
            query.resourceId = resourceId;
        if (action)
            query.action = action;
        const normalizedDateFrom = dateFrom || startDate;
        const normalizedDateTo = dateTo || endDate;
        if (normalizedDateFrom || normalizedDateTo) {
            query.createdAt = {};
            if (normalizedDateFrom)
                query.createdAt.$gte = new Date(normalizedDateFrom);
            if (normalizedDateTo)
                query.createdAt.$lte = new Date(normalizedDateTo);
        }
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50;
        const skip = (pageNum - 1) * limitNum;
        const total = await AuditLog_1.default.countDocuments(query);
        const logs = await AuditLog_1.default.find(query)
            .populate("user", "name email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);
        res.json({ logs, total, page: pageNum });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to get audit log" });
    }
}
async function getDocumentAudit(req, res) {
    try {
        const { docId } = req.params;
        // @ts-ignore
        const user = req.user;
        if (!mongoose_1.default.Types.ObjectId.isValid(docId)) {
            return res.status(400).json({ message: "Invalid document id" });
        }
        const logs = await documentService_1.default.getDocumentAudit(docId);
        res.json({ logs });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to get document audit" });
    }
}
async function exportAuditLog(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const { dateFrom, dateTo, resource } = req.query;
        const query = { org: user.org };
        if (resource)
            query.resource = resource;
        if (dateFrom || dateTo) {
            query.createdAt = {};
            if (dateFrom)
                query.createdAt.$gte = new Date(dateFrom);
            if (dateTo)
                query.createdAt.$lte = new Date(dateTo);
        }
        const logs = await AuditLog_1.default.find(query)
            .populate("user", "name email")
            .sort({ createdAt: -1 });
        // Convert to CSV
        const csv = [
            ["Timestamp", "User", "Action", "Resource", "ResourceID", "Changes"].join(","),
            ...logs.map((log) => [
                log.createdAt?.toISOString() || "",
                log.user?.email || "",
                log.action,
                log.resource,
                log.resourceId,
                JSON.stringify(log.changes || {}),
            ]
                .map((field) => `"${String(field).replace(/"/g, '""')}"`)
                .join(",")),
        ].join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=audit-log.csv");
        res.send(csv);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to export audit log" });
    }
}
async function checkRetention(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const result = await documentService_1.default.checkRetention(user.org);
        res.json({ result });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to check retention" });
    }
}
async function pruneOldDocuments(req, res) {
    try {
        // @ts-ignore
        const user = req.user;
        const { retentionYears } = req.body;
        const result = await documentService_1.default.pruneOldDocuments(user.org, retentionYears || 7);
        await AuditLog_1.default.create({
            org: user.org,
            user: user._id,
            action: "documents_pruned",
            resource: "document",
            resourceId: user._id,
            changes: { prunedCount: result.prunedCount, retentionYears },
        });
        res.json({ result });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to prune documents" });
    }
}
