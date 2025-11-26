import { Router } from "express";
import authRoutes from "./auth";
import documentRoutes from "./documents";
import approvalRoutes from "./approvals";
import zohoRoutes from "./zoho";

const router = Router();

router.use("/auth", authRoutes);
router.use("/documents", documentRoutes);
router.use("/approvals", approvalRoutes);
router.use("/zoho", zohoRoutes);

export default router;
