"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const roles_1 = require("../middlewares/roles");
const fileService_1 = require("../services/fileService");
const documentController_1 = require("../controllers/documentController");
const router = (0, express_1.Router)();
router.use(auth_1.auth);
// Document CRUD
router.post("/", fileService_1.upload.single("file"), documentController_1.createDocument);
router.get("/", documentController_1.listDocuments);
router.get("/:id", documentController_1.getDocument);
router.post("/:id/version", fileService_1.upload.single("file"), documentController_1.uploadVersion);
router.get("/:id/version-history", documentController_1.getVersionHistory);
router.post("/:id/restore-version", documentController_1.restoreVersion);
// Comments and metadata
router.post("/:id/comment", documentController_1.addComment);
router.post("/:id/tags", documentController_1.addTags);
// Approval workflow
router.post("/:id/request-approval", documentController_1.requestApproval);
// Version and retention management
router.post("/:id/prune-history", roles_1.requireOrgAdmin, documentController_1.pruneHistory);
router.post("/:id/archive", documentController_1.archiveDocument);
router.post("/:id/legal-hold", documentController_1.setLegalHold);
// Text extraction
router.post("/:id/extract-text", documentController_1.extractText);
exports.default = router;
