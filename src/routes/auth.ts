import { Router } from "express";
import {
  startZohoAuth,
  zohoCallback,
  listOrgs,
  switchOrg,
  me,
  logout,
} from "../controllers/authController";
import { auth } from "../middlewares/auth";
import { requireOrgAdmin } from "../middlewares/roles";

const router = Router();

// Zoho OAuth start and callback
router.get("/zoho/start", startZohoAuth);
router.get("/zoho/callback", zohoCallback);

// Org selection helpers
router.get("/orgs", listOrgs);
router.post("/switch-org", auth, requireOrgAdmin, switchOrg);

router.post("/logout", logout);
router.get("/me", auth, me);

export default router;
