import { Router } from "express";
import { auth } from "../middlewares/auth";
import { getAnalyticsStats, getDashboardStats } from "../controllers/statsController";
import { requireDepartmentLead } from "../middlewares/roles";

const router = Router();

router.use(auth);
router.get("/", getDashboardStats);

router.get("/analytics", requireDepartmentLead, getAnalyticsStats);

export default router;







