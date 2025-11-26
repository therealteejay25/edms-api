import { Router } from "express";
import {
  startZohoAuth,
  zohoCallback,
  me,
  logout,
} from "../controllers/authController";
import { auth } from "../middlewares/auth";

const router = Router();

// Zoho OAuth start and callback
router.get("/zoho/start", startZohoAuth);
router.get("/zoho/callback", zohoCallback);

router.post("/logout", logout);
router.get("/me", auth, me);

export default router;
