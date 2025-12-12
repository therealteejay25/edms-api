import { Router } from "express";
import { auth } from "../middlewares/auth";
import { getDashboardStats } from "../controllers/statsController";

const router = Router();

router.use(auth);
router.get("/", getDashboardStats);

export default router;







