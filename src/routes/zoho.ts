import { Router } from "express";
import { receiveWebhook } from "../services/zoho/webhooks";

const router = Router();

// Zoho Flow / Creator can POST to this endpoint to notify of events
router.post("/webhook", receiveWebhook);

export default router;
