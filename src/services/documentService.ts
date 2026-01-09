import Document from "../models/Document";
import AuditLog from "../models/AuditLog";
import mongoose from "mongoose";
import path from "path";
import fs from "fs/promises";

export class DocumentService {
  /**
   * Search documents with filters
   */
  static async searchDocuments(
    orgId: string | mongoose.Types.ObjectId,
    filters: {
      search?: string;
      type?: string;
      department?: string;
      status?: string;
      owner?: string | mongoose.Types.ObjectId;
      tags?: string[];
      dateFrom?: Date;
      dateTo?: Date;
      skipArchived?: boolean;
    },
    page = 1,
    limit = 20
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(String(orgId));
    const query: any = { org: orgObjectId };

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

    if (filters.type) query.type = filters.type;
    if (filters.department) query.department = filters.department;
    if (filters.status) query.status = filters.status;
    if (filters.owner)
      query.owner = new mongoose.Types.ObjectId(String(filters.owner));

    if (filters.tags && filters.tags.length > 0) {
      query.tags = { $in: filters.tags };
    }

    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) query.createdAt.$gte = filters.dateFrom;
      if (filters.dateTo) query.createdAt.$lte = filters.dateTo;
    }

    const skip = (page - 1) * limit;
    const total = await Document.countDocuments(query);
    const docs = await Document.find(query)
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
  static async createVersion(
    docId: string | mongoose.Types.ObjectId,
    fileUrl: string,
    userId: string | mongoose.Types.ObjectId
  ) {
    const docObjectId = new mongoose.Types.ObjectId(String(docId));
    const userObjectId = new mongoose.Types.ObjectId(String(userId));
    const doc = await Document.findById(docObjectId);
    if (!doc) throw new Error("Document not found");

    // Keep old version in history
    doc.history.push({
      version: doc.version,
      fileUrl: doc.fileUrl,
      uploadedAt: new Date(),
      uploadedBy: userObjectId,
    });

    // Update document with new version
    doc.version += 1;
    doc.fileUrl = fileUrl;
    await doc.save();

    await AuditLog.create({
      org: doc.org,
      user: userObjectId,
      action: "document_versioned",
      resource: "document",
      resourceId: docObjectId,
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
  static async getVersionHistory(docId: string | mongoose.Types.ObjectId) {
    const docObjectId = new mongoose.Types.ObjectId(String(docId));
    const doc = await Document.findById(docObjectId).populate(
      "history.uploadedBy"
    );
    return doc?.history || [];
  }

  /**
   * Restore document to previous version
   */
  static async restoreVersion(
    docId: string | mongoose.Types.ObjectId,
    version: number,
    userId: string | mongoose.Types.ObjectId
  ) {
    const docObjectId = new mongoose.Types.ObjectId(String(docId));
    const userObjectId = new mongoose.Types.ObjectId(String(userId));
    const doc = await Document.findById(docObjectId);
    if (!doc) throw new Error("Document not found");

    const historyEntry = doc.history.find((h) => h.version === version);
    if (!historyEntry) throw new Error("Version not found");

    // Save current as history
    doc.history.push({
      version: doc.version,
      fileUrl: doc.fileUrl,
      uploadedAt: new Date(),
      uploadedBy: userObjectId,
    });

    // Restore old version
    doc.fileUrl = historyEntry.fileUrl;
    doc.version = version + 1;
    await doc.save();

    await AuditLog.create({
      org: doc.org,
      user: userObjectId,
      action: "document_restored",
      resource: "document",
      resourceId: docObjectId,
      changes: { restoredToVersion: version },
    });

    return doc;
  }

  /**
   * Archive document
   */
  static async archiveDocument(
    docId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ) {
    const docObjectId = new mongoose.Types.ObjectId(String(docId));
    const userObjectId = new mongoose.Types.ObjectId(String(userId));
    const doc = await Document.findByIdAndUpdate(
      docObjectId,
      { status: "archived" },
      { new: true }
    );

    if (doc) {
      await AuditLog.create({
        org: doc.org,
        user: userObjectId,
        action: "document_archived",
        resource: "document",
        resourceId: docObjectId,
        changes: { status: "archived" },
      });
    }

    return doc;
  }

  /**
   * Check retention and auto-archive expired documents
   */
  static async checkRetention(orgId: string | mongoose.Types.ObjectId) {
    const orgObjectId = new mongoose.Types.ObjectId(String(orgId));
    const now = new Date();

    // Archive expired documents
    const expired = await Document.updateMany(
      {
        org: orgObjectId,
        expiryDate: { $lt: now },
        status: { $ne: "archived" },
        legalHold: false,
      },
      { status: "archived" }
    );

    // Mark as expired if past effective date and no legal hold
    await Document.updateMany(
      {
        org: orgObjectId,
        expiryDate: { $lt: now },
        legalHold: false,
      },
      { status: "expired" }
    );

    return {
      archivedCount: expired.modifiedCount,
    };
  }

  /**
   * Set legal hold on document (prevents deletion/archival)
   */
  static async setLegalHold(
    docId: string | mongoose.Types.ObjectId,
    hold: boolean,
    userId: string | mongoose.Types.ObjectId
  ) {
    const docObjectId = new mongoose.Types.ObjectId(String(docId));
    const userObjectId = new mongoose.Types.ObjectId(String(userId));
    const doc = await Document.findByIdAndUpdate(
      docObjectId,
      { legalHold: hold },
      { new: true }
    );

    if (doc) {
      await AuditLog.create({
        org: doc.org,
        user: userObjectId,
        action: `legal_hold_${hold ? "applied" : "removed"}`,
        resource: "document",
        resourceId: docObjectId,
        changes: { legalHold: hold },
      });
    }

    return doc;
  }

  /**
   * Get audit trail for document
   */
  static async getDocumentAudit(docId: mongoose.Types.ObjectId | string) {
    const normalizedId =
      typeof docId === "string" ? new mongoose.Types.ObjectId(docId) : docId;

    return AuditLog.find({ resourceId: normalizedId })
      .populate("user")
      .sort({ createdAt: -1 });
  }

  /**
   * Add document tags
   */
  static async addTags(docId: string | mongoose.Types.ObjectId, tags: string[]) {
    const docObjectId = new mongoose.Types.ObjectId(String(docId));
    const doc = await Document.findByIdAndUpdate(
      docObjectId,
      { $addToSet: { tags: { $each: tags } } },
      { new: true }
    );
    return doc;
  }

  /**
   * Delete document file from disk
   */
  static async deleteFile(fileUrl: string) {
    try {
      const fullPath = path.join(process.cwd(), fileUrl.replace(/^\//, ""));
      await fs.unlink(fullPath);
      return true;
    } catch (err) {
      console.warn("File deletion failed:", err);
      return false;
    }
  }

  static async pruneEligibleDocuments(_orgId: string | mongoose.Types.ObjectId) {
    return {
      prunedCount: 0,
    };
  }

  static async pruneOldDocuments(
    orgId: string | mongoose.Types.ObjectId,
    _retentionYears: number
  ) {
    return this.pruneEligibleDocuments(orgId);
  }
}

export default DocumentService;
