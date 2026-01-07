"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middlewares/auth");
const roles_1 = require("../middlewares/roles");
const router = (0, express_1.Router)();
// Zoho OAuth start and callback
router.get("/zoho/start", authController_1.startZohoAuth);
router.get("/zoho/callback", authController_1.zohoCallback);
// Org selection helpers
router.get("/orgs", authController_1.listOrgs);
router.post("/switch-org", auth_1.auth, roles_1.requireOrgAdmin, authController_1.switchOrg);
router.post("/logout", authController_1.logout);
router.get("/me", auth_1.auth, authController_1.me);
exports.default = router;
