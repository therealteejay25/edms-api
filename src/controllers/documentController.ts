import { Request, Response } from "express";
import Document from "../models/Document";
import Approval from "../models/Approval";
import { moveFile } from "../services/fileService";
import path from "path";
import Zoho from "../services/zohoIntegration";

// Create a document with file upload
export async function createDocument(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const org = req.body.org || user.org;
    if (!req.file) return res.status(400).json({ message: "file required" });
    const fileUrl = path
      .relative(process.cwd(), req.file.path)
      .replace(/\\/g, "/");
    const doc = await Document.create({
      title: req.body.title,
      type: req.body.type,
      department: req.body.department,
      effectiveDate: req.body.effectiveDate,
      status: req.body.status || "draft",
      owner: user._id,
      org,
      fileUrl: `/${fileUrl}`,
      version: 1,
      history: [],
      activity: [{ userId: user._id, action: "created document" }],
    });
    res.json({ doc });
    // Trigger Zoho integrations (non-blocking)
    Zoho.onDocumentUpload(doc).catch((e) =>
      console.warn("Zoho hook failed", e)
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Failed to create document" });
  }
}

// List documents with filters
export async function listDocuments(req: Request, res: Response) {
  try {
    const { type, department, status, search } = req.query as any;
    // @ts-ignore
    const user = req.user;
    // Users see only their org
    const q: any = { org: user.org };
    if (type) q.type = type;
    if (department) q.department = department;
    if (status) q.status = status;
    if (search) q.title = { $regex: search, $options: "i" };
    const docs = await Document.find(q).sort({ updatedAt: -1 }).limit(100);
    // return table-friendly JSON
    const result = docs.map((d) => ({
      id: d._id,
      title: d.title,
      type: d.type,
      department: d.department,
      status: d.status,
      owner: d.owner,
      version: d.version,
      updatedAt: d.updatedAt,
    }));
    res.json({ data: result });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Failed to list documents" });
  }
}

export async function getDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;
    // @ts-ignore
    const user = req.user;
    const doc = await Document.findOne({ _id: id, org: user.org }).populate(
      "owner",
      "name email"
    );
    if (!doc) return res.status(404).json({ message: "Not found" });
    const approvals = await Approval.find({ docId: doc._id });
    res.json({ doc, approvals });
  } catch (err) {
    // eslint-disable-next-line no-console
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
      doc.history.push({
        version: doc.version,
        fileUrl: `/${path
          .relative(process.cwd(), newPath)
          .replace(/\\/g, "/")}`,
        uploadedAt: new Date(),
        uploadedBy: user._id,
      });
    } catch (e) {
      // if moving fails, continue but log
      // eslint-disable-next-line no-console
      console.warn("Failed to move old file to history", e);
    }
    const newFileUrl = `/${path
      .relative(process.cwd(), req.file.path)
      .replace(/\\/g, "/")}`;
    doc.version = doc.version + 0o1;
    doc.fileUrl = newFileUrl;
    doc.activity.push({
      userId: user._id,
      action: "uploaded new version",
      details: `version ${doc.version}`,
      createdAt: new Date.now()
    });
    await doc.save();
    res.json({ doc });
    // trigger zoho for new version
    Zoho.onDocumentUpload(doc).catch((e) =>
      console.warn("Zoho hook failed", e)
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Failed to upload version" });
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
    });
    await doc.save();
    res.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
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
    });
    doc.activity.push({
      userId: user._id,
      action: "requested approval",
      details: String(approval._id),
    });
    await doc.save();
    res.json({ approval });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Failed to request approval" });
  }
}
