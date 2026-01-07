"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const roles_1 = require("../middlewares/roles");
const auditController_1 = require("../controllers/auditController");
const router = (0, express_1.Router)();
router.use(auth_1.auth);
// Audit logging
router.get("/", auditController_1.getAuditLog);
router.get("/export", auditController_1.exportAuditLog);
router.get("/:docId/document", auditController_1.getDocumentAudit);
// Retention management - admin only
router.post("/retention/check", roles_1.requireOrgAdmin, auditController_1.checkRetention);
router.post("/retention/prune", roles_1.requireOrgAdmin, auditController_1.pruneOldDocuments);
exports.default = router;
