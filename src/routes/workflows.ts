import { Router } from "express";
import { auth } from "../middlewares/auth";
import { requireDepartmentLead } from "../middlewares/roles";
import {
  listWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  getWorkflow,
  testWorkflow,
} from "../controllers/workflowController";

const router = Router();

router.use(auth);

// Workflow CRUD - admin only
router.get("/", listWorkflows);
router.post("/", requireDepartmentLead, createWorkflow);
router.get("/:id", getWorkflow);
router.put("/:id", requireDepartmentLead, updateWorkflow);
router.delete("/:id", requireDepartmentLead, deleteWorkflow);

// Testing
router.post("/:id/test", testWorkflow);

export default router;
