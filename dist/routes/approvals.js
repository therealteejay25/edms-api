"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const roles_1 = require("../middlewares/roles");
const approvalController_1 = require("../controllers/approvalController");
const router = (0, express_1.Router)();
router.use(auth_1.auth);
// List approvals with filters
router.get("/", approvalController_1.listApprovals);
router.get("/pending", approvalController_1.getPendingApprovals);
router.get("/pending/mine", approvalController_1.getPendingApprovals);
router.get("/overdue", approvalController_1.getOverdueApprovals);
router.get("/overdue/list", approvalController_1.getOverdueApprovals);
router.get("/:docId/status", approvalController_1.getApprovalStatus);
// Approval actions
router.post("/:id/approve", approvalController_1.approve);
router.post("/:id/reject", approvalController_1.reject);
router.post("/:id/escalate", approvalController_1.escalateApproval);
router.post("/:id/reminder", approvalController_1.sendReminderNotification);
// Bulk operations
router.post("/bulk/approve-department", roles_1.requireDepartmentLead, approvalController_1.bulkApprove);
exports.default = router;
