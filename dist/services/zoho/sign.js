"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSignRequest = createSignRequest;
const axios_1 = __importDefault(require("axios"));
const ZOHO_SIGN_BASE = "https://sign.zoho.com/api/v1";
async function createSignRequest(templateId, recipients, auth) {
    const url = `${ZOHO_SIGN_BASE}/requests`;
    const body = { template_id: templateId, recipients };
    const res = await axios_1.default.post(url, body, {
        headers: { Authorization: `Zoho-oauthtoken ${auth.accessToken}` },
    });
    return res.data;
}
exports.default = { createSignRequest };
