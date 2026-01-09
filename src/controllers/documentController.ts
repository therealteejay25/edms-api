import { Request, Response } from "express";
import Document from "../models/Document";
import Approval from "../models/Approval";
import { moveFile } from "../services/fileService";
import path from "path";
import Zoho from "../services/zohoIntegration";
import FileText from "../services/fileText";
import DocumentService from "../services/documentService";
import AuditLog from "../models/AuditLog";
import Workflow from "../models/Workflow";
import WorkflowService from "../services/workflowService";
import Organization from "../models/Organization";

// Create a document with file upload
export async function createDocument(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    if (user.role !== "admin" && !user.department) {
      return res.status(400).json({ message: "Department is required" });
    }
    const org = req.body.org || user.org;
    if (!req.file) return res.status(400).json({ message: "file required" });

    // Department enforcement + validation
    const requestedDepartment = String(req.body.department || "").trim();
    const department =
      user.role === "admin" ? requestedDepartment : String(user.department || "");
    if (!department) {
      return res.status(400).json({ message: "department is required" });
    }

    const orgDoc = await Organization.findById(org).select("departments");
    if (orgDoc && Array.isArray(orgDoc.departments) && orgDoc.departments.length) {
      const allowed = orgDoc.departments.some(
        (d: any) => String(d).toLowerCase() === department.toLowerCase()
      );
      if (!allowed) {
        return res.status(400).json({ message: "Invalid department" });
      }
    }

    const fileUrl = path
      .relative(process.cwd(), req.file.path)
      .replace(/\\/g, "/");
    const doc = await Document.create({
      title: req.body.title,
      type: req.body.type,
      department,
      effectiveDate: req.body.effectiveDate,
      expiryDate: req.body.expiryDate,
      status: req.body.status || "draft",
      owner: user._id,
      org,
      fileUrl: `/${fileUrl}`,
      version: 1,
      history: [],
      tags: req.body.tags
        ? typeof req.body.tags === "string"
          ? [req.body.tags]
          : req.body.tags
        : [],
      approvalRequired: req.body.approvalRequired || false,
      retentionYears: req.body.retentionYears,
      activity: [
        { userId: user._id, action: "created document", createdAt: new Date() },
      ],
    });

    // Extract text for preview/search (non-blocking)
    (async () => {
      try {
        const fp = path.join(process.cwd(), doc.fileUrl.replace(/^\//, ""));
        const txt = await FileText.extractTextFromFile(fp);
        if (txt) {
          doc.extractedText = txt;
          await doc.save();
        }
      } catch (e) {
        console.warn("Text extraction failed", (e as any)?.message || e);
      }
    })();

    // Audit log
    await AuditLog.create({
      org,
      user: user._id,
      action: "document_created",
      resource: "document",
      resourceId: doc._id,
      metadata: { title: doc.title, type: doc.type },
    });

    res.json({ doc });

    // Auto-route through workflow if applicable
    (async () => {
      try {
        const workflow = await WorkflowService.getWorkflowForDocument(
          org,
          doc.type,
          doc.department
        );
        if (workflow) {
          await WorkflowService.autoRouteDocument(doc._id, workflow);
        }
      } catch (e) {
        console.warn("Workflow routing failed", e);
      }
    })();

    // Trigger Zoho integrations (non-blocking)
    Zoho.onDocumentUpload(doc).catch((e) =>
      console.warn("Zoho hook failed", e)
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create document" });
  }
}

// List documents with advanced filters
export async function listDocuments(req: Request, res: Response) {
  try {
    const {
      type,
      department,
      status,
      search,
      tags,
      dateFrom,
      dateTo,
      page,
      limit,
      skipArchived,
    } = req.query as any;
    // @ts-ignore
    const user = req.user;

    if (user.role !== "admin" && !user.department) {
      return res.status(400).json({ message: "Department is required" });
    }

    const scopedDepartment = user.role === "admin" ? department : user.department;

    const filters: any = {
      search,
      type,
      department: scopedDepartment,
      status,
      owner: req.query.owner ? req.query.owner : undefined,
      skipArchived: skipArchived !== "false",
    };

    if (tags) {
      filters.tags = typeof tags === "string" ? [tags] : tags;
    }

    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);

    const result = await DocumentService.searchDocuments(
      user.org,
      filters,
      parseInt(page) || 1,
      parseInt(limit) || 20
    );

    res.json({
      data: result.docs,
      total: result.total,
      page: result.page,
      pageSize: parseInt(limit) || 20,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to list documents" });
  }
}

export async function getDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;
    // @ts-ignore
    const user = req.user;

    if (user.role !== "admin" && !user.department) {
      return res.status(400).json({ message: "Department is required" });
    }

    const query: any = { _id: id, org: user.org };
    if (user.role !== "admin") {
      query.department = user.department;
    }

    const doc = await Document.findOne(query)
      .populate("owner", "name email")
      .populate("approvalChain", "name email");

    if (!doc) return res.status(404).json({ message: "Not found" });

    const approvals = await Approval.find({ docId: doc._id })
      .populate("assignee")
      .populate("decidedBy");

    const auditLog = await AuditLog.find({ resourceId: id })
      .populate("user")
      .limit(50);

    res.json({ doc, approvals, auditLog });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get document" });
  }
}

export async function uploadVersion(req: Request, res: Response) {
  try {
    const { id } = req.params;
    // @ts-ignore
    const user = req.user;
    const doc = await Document.findOne({ _id: id, org: user.org });
    if (!doc) return res.status(404).json({ message: "Not found" });
    if (!req.file) return res.status(400).json({ message: "file required" });

    // move current file to history folder
    const currentPath = path.join(
      process.cwd(),
      doc.fileUrl.replace(/^\//, "")
    );
    const historyDir = path.join(
      process.cwd(),
      "uploads",
      String(doc.org),
      "history",
      String(doc._id)
    );

    try {
      const newPath = await moveFile(currentPath, historyDir);
      const histEntry: any = {
        version: doc.version,
        fileUrl: `/${path
          .relative(process.cwd(), newPath)
          .replace(/\\/g, "/")}`,
        uploadedAt: new Date(),
        uploadedBy: user._id,
      };

      try {
        const extracted = await FileText.extractTextFromFile(newPath);
        if (extracted) histEntry.extractedText = extracted;
      } catch (e) {
        /* ignore */
      }

      doc.history.push(histEntry);
    } catch (e) {
      console.warn("Failed to move old file to history", e);
    }

    const newFileUrl = `/${path
      .relative(process.cwd(), req.file.path)
      .replace(/\\/g, "/")}`;

    doc.version = doc.version + 1;
    doc.fileUrl = newFileUrl;

    // extract text for new version
    try {
      const newFsPath = path.join(process.cwd(), req.file.path);
      const t = await FileText.extractTextFromFile(newFsPath);
      if (t) doc.extractedText = t;
    } catch (e) {
      /* ignore */
    }

    doc.activity.push({
      userId: user._id,
      action: "uploaded new version",
      details: `version ${doc.version}`,
      createdAt: new Date(),
    });

    await doc.save();

    await AuditLog.create({
      org: doc.org,
      user: user._id,
      action: "document_version_uploaded",
      resource: "document",
      resourceId: doc._id,
      changes: { version: doc.version },
    });

    res.json({ doc });

    Zoho.onDocumentUpload(doc).catch((e) =>
      console.warn("Zoho hook failed", e)
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to upload version" });
  }
}

export async function getVersionHistory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    // @ts-ignore
    const user = req.user;

    const doc = await Document.findOne({ _id: id, org: user.org });
    if (!doc) return res.status(404).json({ message: "Not found" });

    const history = await DocumentService.getVersionHistory(String(id));
    res.json({ history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get version history" });
  }
}

export async function restoreVersion(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { version } = req.body;
    // @ts-ignore
    const user = req.user;

    const doc = await Document.findOne({ _id: id, org: user.org });
    if (!doc) return res.status(404).json({ message: "Not found" });

    const restored = await DocumentService.restoreVersion(
      String(id),
      version,
      String(user._id)
    );
    res.json({ doc: restored });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to restore version" });
  }
}

export async function addComment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    // @ts-ignore
    const user = req.user;
    const doc = await Document.findOne({ _id: id, org: user.org });
    if (!doc) return res.status(404).json({ message: "Not found" });

    doc.comments.push({
      userId: user._id,
      name: user.name,
      comment,
      createdAt: new Date(),
    });

    doc.activity.push({
      userId: user._id,
      action: "commented",
      details: comment,
      createdAt: new Date(),
    });

    await doc.save();

    await AuditLog.create({
      org: doc.org,
      user: user._id,
      action: "document_commented",
      resource: "document",
      resourceId: doc._id,
      changes: { comment },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add comment" });
  }
}

export async function requestApproval(req: Request, res: Response) {
  try {
    const { id } = req.params;
    // @ts-ignore
    const user = req.user;
    const doc = await Document.findOne({ _id: id, org: user.org });
    if (!doc) return res.status(404).json({ message: "Not found" });

    const approval = await Approval.create({
      docId: doc._id,
      org: doc.org,
      status: "pending",
      requestedBy: user._id,
      assignee: req.body.assignee,
      priority: req.body.priority || "medium",
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
    });

    doc.activity.push({
      userId: user._id,
      action: "requested approval",
      details: String(approval._id),
      createdAt: new Date(),
    });

    await doc.save();

    await AuditLog.create({
      org: doc.org,
      user: user._id,
      action: "approval_requested",
      resource: "approval",
      resourceId: approval._id,
    });

    res.json({ approval });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to request approval" });
  }
}

export async function pruneHistory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { days } = req.body as { days?: number };
    // @ts-ignore
    const user = req.user;
    const doc = await Document.findOne({ _id: id, org: user.org });
    if (!doc) return res.status(404).json({ message: "Not found" });

    const keepDays = typeof days === "number" && days > 0 ? days : 365;
    const cutoff = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000);

    doc.history = (doc.history || []).filter(
      (h: any) => new Date(h.uploadedAt) >= cutoff
    );

    doc.activity.push({
      userId: user._id,
      action: "pruned history",
      details: `kept ${keepDays} days`,
      createdAt: new Date(),
    });

    await doc.save();

    await AuditLog.create({
      org: doc.org,
      user: user._id,
      action: "document_history_pruned",
      resource: "document",
      resourceId: doc._id,
      changes: { keepDays },
    });

    res.json({
      ok: true,
      keptDays: keepDays,
      historyLength: doc.history.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to prune history" });
  }
}

export async function extractText(req: Request, res: Response) {
  try {
    const { id } = req.params;
    // @ts-ignore
    const user = req.user;
    const doc = await Document.findOne({ _id: id, org: user.org });
    if (!doc) return res.status(404).json({ message: "Not found" });

    const filePath = path.join(process.cwd(), doc.fileUrl.replace(/^\//, ""));
    const txt = await FileText.extractTextFromFile(filePath);

    if (txt) {
      doc.extractedText = txt;
      await doc.save();
    }

    res.json({ ok: true, extracted: !!txt, text: txt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to extract text" });
  }
}

export async function archiveDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;
    // @ts-ignore
    const user = req.user;

    const doc = await Document.findOne({ _id: id, org: user.org });
    if (!doc) return res.status(404).json({ message: "Not found" });

    const archived = await DocumentService.archiveDocument(
      String(id),
      String(user._id)
    );
    res.json({ doc: archived });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to archive document" });
  }
}

export async function setLegalHold(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { hold } = req.body;
    // @ts-ignore
    const user = req.user;

    const doc = await Document.findOne({ _id: id, org: user.org });
    if (!doc) return res.status(404).json({ message: "Not found" });

    const updated = await DocumentService.setLegalHold(
      String(id),
      hold,
      String(user._id)
    );
    res.json({ doc: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to set legal hold" });
  }
}

export async function addTags(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { tags } = req.body;
    // @ts-ignore
    const user = req.user;

    const doc = await Document.findOne({ _id: id, org: user.org });
    if (!doc) return res.status(404).json({ message: "Not found" });

    const updated = await DocumentService.addTags(String(id), tags);

    await AuditLog.create({
      org: doc.org,
      user: user._id,
      action: "document_tagged",
      resource: "document",
      resourceId: doc._id,
      changes: { tags },
    });

    res.json({ doc: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add tags" });
  }
}
