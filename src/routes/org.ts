import { Router } from "express";
import { auth } from "../middlewares/auth";
import { requireOrgAdmin } from "../middlewares/roles";
import { getOrg, updateOrg } from "../controllers/orgController";

const router = Router();

router.use(auth);

router.get("/", getOrg);
router.post("/", requireOrgAdmin, updateOrg);

export default router;
