import { Request, Response } from "express";
import AuditLog from "../models/AuditLog";
import DocumentService from "../services/documentService";
import mongoose from "mongoose";

export async function getAuditLog(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const {
      resource,
      resourceId,
      action,
      page,
      limit,
      dateFrom,
      dateTo,
      startDate,
      endDate,
    } = req.query as any;

    const query: any = { org: user.org };

    if (resource) query.resource = resource;
    if (resourceId) query.resourceId = resourceId;
    if (action) query.action = action;

    const normalizedDateFrom = dateFrom || startDate;
    const normalizedDateTo = dateTo || endDate;

    if (normalizedDateFrom || normalizedDateTo) {
      query.createdAt = {};
      if (normalizedDateFrom) query.createdAt.$gte = new Date(normalizedDateFrom);
      if (normalizedDateTo) query.createdAt.$lte = new Date(normalizedDateTo);
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const skip = (pageNum - 1) * limitNum;
    const total = await AuditLog.countDocuments(query);

    const logs = await AuditLog.find(query)
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({ logs, total, page: pageNum });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get audit log" });
  }
}

export async function getDocumentAudit(req: Request, res: Response) {
  try {
    const { docId } = req.params;
    // @ts-ignore
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(docId)) {
      return res.status(400).json({ message: "Invalid document id" });
    }

    const logs = await DocumentService.getDocumentAudit(docId);

    res.json({ logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get document audit" });
  }
}

export async function exportAuditLog(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const { dateFrom, dateTo, resource } = req.query as any;

    const query: any = { org: user.org };

    if (resource) query.resource = resource;

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const logs = await AuditLog.find(query)
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    // Convert to CSV
    const csv = [
      ["Timestamp", "User", "Action", "Resource", "ResourceID", "Changes"].join(
        ","
      ),
      ...logs.map((log) =>
        [
          (log as any).createdAt?.toISOString() || "",
          (log.user as any)?.email || "",
          log.action,
          log.resource,
          log.resourceId,
          JSON.stringify(log.changes || {}),
        ]
          .map((field) => `"${String(field).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=audit-log.csv");
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to export audit log" });
  }
}

export async function checkRetention(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;

    const result = await DocumentService.checkRetention(user.org);
    res.json({ result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to check retention" });
  }
}

export async function pruneOldDocuments(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const { retentionYears } = req.body;

    const result = await DocumentService.pruneOldDocuments(
      user.org,
      retentionYears || 7
    );

    await AuditLog.create({
      org: user.org,
      user: user._id,
      action: "documents_pruned",
      resource: "document",
      resourceId: user._id,
      changes: { prunedCount: result.prunedCount, retentionYears },
    });

    res.json({ result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to prune documents" });
  }
}
