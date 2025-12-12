import { Router } from "express";
import { auth } from "../middlewares/auth";
import { requireOrgAdmin } from "../middlewares/roles";
import { upload } from "../services/fileService";
import {
  createDocument,
  listDocuments,
  getDocument,
  uploadVersion,
  getVersionHistory,
  restoreVersion,
  addComment,
  requestApproval,
  pruneHistory,
  extractText,
  archiveDocument,
  setLegalHold,
  addTags,
} from "../controllers/documentController";

const router = Router();

router.use(auth);

// Document CRUD
router.post("/", upload.single("file"), createDocument);
router.get("/", listDocuments);
router.get("/:id", getDocument);
router.post("/:id/version", upload.single("file"), uploadVersion);
router.get("/:id/version-history", getVersionHistory);
router.post("/:id/restore-version", restoreVersion);

// Comments and metadata
router.post("/:id/comment", addComment);
router.post("/:id/tags", addTags);

// Approval workflow
router.post("/:id/request-approval", requestApproval);

// Version and retention management
router.post("/:id/prune-history", requireOrgAdmin, pruneHistory);
router.post("/:id/archive", archiveDocument);
router.post("/:id/legal-hold", setLegalHold);

// Text extraction
router.post("/:id/extract-text", extractText);

export default router;
