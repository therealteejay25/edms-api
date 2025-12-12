import { Router } from "express";
import { auth } from "../middlewares/auth";
import { requireOrgAdmin } from "../middlewares/roles";
import {
  receiveWebhook,
  receiveWorkDriveUploadWebhook,
  receiveSignWebhook,
  receiveCliqWebhook,
} from "../services/zoho/webhooks";
import {
  uploadToWorkDrive,
  sendForSignature,
  sendCliqNotification,
  getIntegrationStatus,
  setupWebhookUrl,
} from "../controllers/zohoController";

const router = Router();

// Public webhooks (no auth - validate from Zoho)
router.post("/webhook", receiveWebhook);
router.post("/webhook/workdrive", receiveWorkDriveUploadWebhook);
router.post("/webhook/sign", receiveSignWebhook);
router.post("/webhook/cliq", receiveCliqWebhook);

// Authenticated endpoints
router.use(auth);

// Integration management
router.get("/status", getIntegrationStatus);
router.post("/setup-webhook", requireOrgAdmin, setupWebhookUrl);

// Actions
router.post("/actions/upload-workdrive", uploadToWorkDrive);
router.post("/actions/send-signature", sendForSignature);
router.post("/actions/notify-cliq", sendCliqNotification);

export default router;
