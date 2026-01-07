"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const roles_1 = require("../middlewares/roles");
const workflowController_1 = require("../controllers/workflowController");
const router = (0, express_1.Router)();
router.use(auth_1.auth);
// Workflow CRUD - admin only
router.get("/", workflowController_1.listWorkflows);
router.post("/", roles_1.requireDepartmentLead, workflowController_1.createWorkflow);
router.get("/:id", workflowController_1.getWorkflow);
router.put("/:id", roles_1.requireDepartmentLead, workflowController_1.updateWorkflow);
router.delete("/:id", roles_1.requireDepartmentLead, workflowController_1.deleteWorkflow);
// Testing
router.post("/:id/test", workflowController_1.testWorkflow);
exports.default = router;
