import { Router } from "express";
import { auth } from "../middlewares/auth";
import { requireDepartmentLead } from "../middlewares/roles";
import {
  listApprovals,
  getPendingApprovals,
  approve,
  reject,
  getApprovalStatus,
  escalateApproval,
  getOverdueApprovals,
  sendReminderNotification,
  bulkApprove,
} from "../controllers/approvalController";

const router = Router();

router.use(auth);

// List approvals with filters
router.get("/", listApprovals);
router.get("/pending", getPendingApprovals);
router.get("/pending/mine", getPendingApprovals);
router.get("/overdue", getOverdueApprovals);
router.get("/overdue/list", getOverdueApprovals);
router.get("/:docId/status", getApprovalStatus);

// Approval actions
router.post("/:id/approve", approve);
router.post("/:id/reject", reject);
router.post("/:id/escalate", escalateApproval);
router.post("/:id/reminder", sendReminderNotification);

// Bulk operations
router.post("/bulk/approve-department", requireDepartmentLead, bulkApprove);

export default router;
