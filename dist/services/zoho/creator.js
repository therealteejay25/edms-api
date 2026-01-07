"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCreatorRecord = createCreatorRecord;
const axios_1 = __importDefault(require("axios"));
const ZOHO_BASE = "https://creator.zoho.com/api/v2";
async function createCreatorRecord(orgName, appName, formName, record, auth) {
    // Example: POST /{ownerName}/{appName}/form/{formLinkName}
    const url = `${ZOHO_BASE}/${encodeURIComponent(orgName)}/${encodeURIComponent(appName)}/form/${encodeURIComponent(formName)}`;
    const res = await axios_1.default.post(url, { data: record }, { headers: { Authorization: `Zoho-oauthtoken ${auth.accessToken}` } });
    return res.data;
}
exports.default = { createCreatorRecord };
