import { Router } from "express";
import { auth } from "../middlewares/auth";
import { requireOrgAdmin } from "../middlewares/roles";
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
router.post("/", requireOrgAdmin, createWorkflow);
router.get("/:id", getWorkflow);
router.put("/:id", requireOrgAdmin, updateWorkflow);
router.delete("/:id", requireOrgAdmin, deleteWorkflow);

// Testing
router.post("/:id/test", testWorkflow);

export default router;
