import { Router } from "express";
import { auth } from "../middlewares/auth";
import { requireOrgAdmin } from "../middlewares/roles";
import {
  getExpiringDocuments,
  sendExpiryReminders,
  archiveExpiredDocuments,
} from "../controllers/expiryController";

const router = Router();

router.use(auth);

router.get("/", getExpiringDocuments);
router.post("/reminders", requireOrgAdmin, sendExpiryReminders);
router.post("/archive", requireOrgAdmin, archiveExpiredDocuments);

export default router;







