"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentService = void 0;
const Document_1 = __importDefault(require("../models/Document"));
const AuditLog_1 = __importDefault(require("../models/AuditLog"));
const mongoose_1 = __importDefault(require("mongoose"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
class DocumentService {
    /**
     * Search documents with filters
     */
    static async searchDocuments(orgId, filters, page = 1, limit = 20) {
        const query = { org: orgId };
        if (filters.skipArchived !== false) {
            query.status = { $ne: "archived" };
        }
        if (filters.search) {
            query.$or = [
                { title: { $regex: filters.search, $options: "i" } },
                { extractedText: { $regex: filters.search, $options: "i" } },
                { tags: { $in: [new RegExp(filters.search, "i")] } },
            ];
        }
        if (filters.type)
            query.type = filters.type;
        if (filters.department)
            query.department = filters.department;
        if (filters.status)
            query.status = filters.status;
        if (filters.owner)
            query.owner = filters.owner;
        if (filters.tags && filters.tags.length > 0) {
            query.tags = { $in: filters.tags };
        }
        if (filters.dateFrom || filters.dateTo) {
            query.createdAt = {};
            if (filters.dateFrom)
                query.createdAt.$gte = filters.dateFrom;
            if (filters.dateTo)
                query.createdAt.$lte = filters.dateTo;
        }
        const skip = (page - 1) * limit;
        const total = await Document_1.default.countDocuments(query);
        const docs = await Document_1.default.find(query)
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("owner")
            .populate("approvalChain");
        return {
            docs,
            total,
            page,
            pages: Math.ceil(total / limit),
        };
    }
    /**
     * Version a document update
     */
    static async createVersion(docId, fileUrl, userId) {
        const doc = await Document_1.default.findById(docId);
        if (!doc)
            throw new Error("Document not found");
        // Keep old version in history
        doc.history.push({
            version: doc.version,
            fileUrl: doc.fileUrl,
            uploadedAt: new Date(),
            uploadedBy: userId,
        });
        // Update document with new version
        doc.version += 1;
        doc.fileUrl = fileUrl;
        await doc.save();
        await AuditLog_1.default.create({
            org: doc.org,
            user: userId,
            action: "document_versioned",
            resource: "document",
            resourceId: docId,
            changes: {
                version: doc.version,
                oldFileUrl: doc.history[doc.history.length - 1].fileUrl,
            },
        });
        return doc;
    }
    /**
     * Get version history
     */
    static async getVersionHistory(docId) {
        const doc = await Document_1.default.findById(docId).populate("history.uploadedBy");
        return doc?.history || [];
    }
    /**
     * Restore document to previous version
     */
    static async restoreVersion(docId, version, userId) {
        const doc = await Document_1.default.findById(docId);
        if (!doc)
            throw new Error("Document not found");
        const historyEntry = doc.history.find((h) => h.version === version);
        if (!historyEntry)
            throw new Error("Version not found");
        // Save current as history
        doc.history.push({
            version: doc.version,
            fileUrl: doc.fileUrl,
            uploadedAt: new Date(),
            uploadedBy: userId,
        });
        // Restore old version
        doc.fileUrl = historyEntry.fileUrl;
        doc.version = version + 1;
        await doc.save();
        await AuditLog_1.default.create({
            org: doc.org,
            user: userId,
            action: "document_restored",
            resource: "document",
            resourceId: docId,
            changes: { restoredToVersion: version },
        });
        return doc;
    }
    /**
     * Archive document
     */
    static async archiveDocument(docId, userId) {
        const doc = await Document_1.default.findByIdAndUpdate(docId, { status: "archived" }, { new: true });
        if (doc) {
            await AuditLog_1.default.create({
                org: doc.org,
                user: userId,
                action: "document_archived",
                resource: "document",
                resourceId: docId,
                changes: { status: "archived" },
            });
        }
        return doc;
    }
    /**
     * Check retention and auto-archive expired documents
     */
    static async checkRetention(orgId) {
        const now = new Date();
        // Archive expired documents
        const expired = await Document_1.default.updateMany({
            org: orgId,
            expiryDate: { $lt: now },
            status: { $ne: "archived" },
            legalHold: false,
        }, { status: "archived" });
        // Mark as expired if past effective date and no legal hold
        await Document_1.default.updateMany({
            org: orgId,
            expiryDate: { $lt: now },
            legalHold: false,
        }, { status: "expired" });
        return {
            archivedCount: expired.modifiedCount,
        };
    }
    /**
     * Set legal hold on document (prevents deletion/archival)
     */
    static async setLegalHold(docId, hold, userId) {
        const doc = await Document_1.default.findByIdAndUpdate(docId, { legalHold: hold }, { new: true });
        if (doc) {
            await AuditLog_1.default.create({
                org: doc.org,
                user: userId,
                action: `legal_hold_${hold ? "applied" : "removed"}`,
                resource: "document",
                resourceId: docId,
                changes: { legalHold: hold },
            });
        }
        return doc;
    }
    /**
     * Get audit trail for document
     */
    static async getDocumentAudit(docId) {
        const normalizedId = typeof docId === "string" ? new mongoose_1.default.Types.ObjectId(docId) : docId;
        return AuditLog_1.default.find({ resourceId: normalizedId })
            .populate("user")
            .sort({ createdAt: -1 });
    }
    /**
     * Add document tags
     */
    static async addTags(docId, tags) {
        const doc = await Document_1.default.findByIdAndUpdate(docId, { $addToSet: { tags: { $each: tags } } }, { new: true });
        return doc;
    }
    /**
     * Delete document file from disk
     */
    static async deleteFile(fileUrl) {
        try {
            const fullPath = path_1.default.join(process.cwd(), fileUrl.replace(/^\//, ""));
            await promises_1.default.unlink(fullPath);
            return true;
        }
        catch (err) {
            console.warn("File deletion failed:", err);
            return false;
        }
    }
    /**
     * Check retention policy and delete eligible documents
     */
    static async pruneOldDocuments(orgId, retentionYears = 7) {
        const cutoffDate = new Date();
        cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionYears);
        const toPrune = await Document_1.default.find({
            org: orgId,
            status: "archived",
            legalHold: false,
            createdAt: { $lt: cutoffDate },
        });
        for (const doc of toPrune) {
            await DocumentService.deleteFile(doc.fileUrl);
            await Document_1.default.findByIdAndDelete(doc._id);
        }
        return {
            prunedCount: toPrune.length,
        };
    }
}
exports.DocumentService = DocumentService;
exports.default = DocumentService;
