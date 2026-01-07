import { Router } from "express";
import { auth } from "../middlewares/auth";
import { requireOrgAdmin } from "../middlewares/roles";
import {
  getAuditLog,
  getDocumentAudit,
  exportAuditLog,
  checkRetention,
  pruneOldDocuments,
} from "../controllers/auditController";

const router = Router();

router.use(auth);

// Audit logging
router.get("/", getAuditLog);
router.get("/export", exportAuditLog);
router.get("/:docId/document", getDocumentAudit);

// Retention management - admin only
router.post("/retention/check", requireOrgAdmin, checkRetention);
router.post("/retention/prune", requireOrgAdmin, pruneOldDocuments);

export default router;
