import { Router } from "express";
import { auth } from "../middlewares/auth";
import { isAdmin } from "../middlewares/isAdmin";
import {
  listApprovals,
  approve,
  reject,
} from "../controllers/approvalController";

const router = Router();

router.use(auth);

router.get("/", listApprovals);
router.post("/:id/approve", isAdmin, approve);
router.post("/:id/reject", isAdmin, reject);

export default router;
