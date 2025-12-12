import { Router } from "express";
import authRoutes from "./auth";
import documentRoutes from "./documents";
import approvalRoutes from "./approvals";
import workflowRoutes from "./workflows";
import auditRoutes from "./audit";
import zohoRoutes from "./zoho";
import usersRoutes from "./users";
import orgRoutes from "./org";
import expiryRoutes from "./expiry";
import statsRoutes from "./stats";

const router = Router();

router.use("/auth", authRoutes);
router.use("/documents", documentRoutes);
router.use("/approvals", approvalRoutes);
router.use("/workflows", workflowRoutes);
router.use("/audit", auditRoutes);
router.use("/zoho", zohoRoutes);
router.use("/users", usersRoutes);
router.use("/org", orgRoutes);
router.use("/expiry", expiryRoutes);
router.use("/stats", statsRoutes);

export default router;
