"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const roles_1 = require("../middlewares/roles");
const webhooks_1 = require("../services/zoho/webhooks");
const zohoController_1 = require("../controllers/zohoController");
const router = (0, express_1.Router)();
// Public webhooks (no auth - validate from Zoho)
router.post("/webhook", webhooks_1.receiveWebhook);
router.post("/webhook/workdrive", webhooks_1.receiveWorkDriveUploadWebhook);
router.post("/webhook/sign", webhooks_1.receiveSignWebhook);
router.post("/webhook/cliq", webhooks_1.receiveCliqWebhook);
// Authenticated endpoints
router.use(auth_1.auth);
// Integration management
router.get("/status", zohoController_1.getIntegrationStatus);
router.post("/setup-webhook", roles_1.requireOrgAdmin, zohoController_1.setupWebhookUrl);
// Actions
router.post("/actions/upload-workdrive", zohoController_1.uploadToWorkDrive);
router.post("/actions/send-signature", zohoController_1.sendForSignature);
router.post("/actions/notify-cliq", zohoController_1.sendCliqNotification);
exports.default = router;
