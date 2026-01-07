"use strict";
// Placeholder service file to show how Zoho integrations can be added in the future.
// - On upload: trigger webhook to Zoho Flow or call Zoho Creator APIs to create records.
// - On approval: notify Zoho Cliq / Slack via webhook.
// - Replace local storage with Zoho WorkDrive API for file storage and folder structure.
// - Integrate Zoho Sign by creating a signing request and storing returned signed file as a new version.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onDocumentUpload = onDocumentUpload;
exports.onApproval = onApproval;
const Organization_1 = __importDefault(require("../models/Organization"));
const Document_1 = __importDefault(require("../models/Document"));
const Creator = __importStar(require("./zoho/creator"));
const WorkDrive = __importStar(require("./zoho/workdrive"));
const axios_1 = __importDefault(require("axios"));
const User_1 = __importDefault(require("../models/User"));
const ZohoOAuth = __importStar(require("./zoho/oauth"));
async function onDocumentUpload(doc) {
    // doc contains metadata, org, fileUrl, version, etc.
    try {
        const org = await Organization_1.default.findById(doc.org);
        if (!org || !org.zoho?.enabled)
            return;
        const zohoAuth = await getZohoAuthForOrg(org);
        // Create Creator record if configured
        if (org.zoho?.creatorFormId) {
            // creatorFormId expected format: {appName}/{formName}
            const [appName, formName] = org.zoho.creatorFormId.split("/");
            await Creator.createCreatorRecord(String(org.name), appName, formName, {
                title: doc.title,
                type: doc.type,
                department: doc.department,
                fileUrl: doc.fileUrl,
                version: doc.version,
            }, zohoAuth);
        }
        // Optionally upload to WorkDrive
        if (org.zoho?.workdriveFolderId) {
            // In production we would stream the file; for MVP we can store a pointer or upload file buffer
            const filePath = doc.fileUrl.replace(/^\//, "");
            // Read file and upload
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const fs = require("fs");
            const fileStream = fs.createReadStream(filePath);
            const wdResp = await WorkDrive.uploadFile(org.zoho.workdriveFolderId, fileStream, filePath.split("/").pop(), zohoAuth);
            // If we receive a useful response from WorkDrive, attempt to persist file id/url and raw response on the Document
            try {
                const candidateId = wdResp?.data?.file_id ||
                    wdResp?.file_id ||
                    wdResp?.id ||
                    wdResp?.data?.id ||
                    wdResp?.data?.ID;
                const candidateUrl = wdResp?.data?.download_url ||
                    wdResp?.download_url ||
                    wdResp?.file_url ||
                    wdResp?.data?.file_url ||
                    wdResp?.data?.downloadUrl;
                await Document_1.default.findByIdAndUpdate(doc._id, {
                    zohoFileId: candidateId,
                    zohoFileUrl: candidateUrl,
                    zohoRawResponse: wdResp,
                });
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.warn("Failed to persist WorkDrive response to Document", e);
            }
        }
        // Trigger Zoho webhook if present
        if (org.zoho?.webhookUrl) {
            await axios_1.default.post(org.zoho.webhookUrl, { event: "document.upload", doc }, { timeout: 5000 });
        }
        // Send to any configured notification endpoints for this org (e.g., Slack, email webhook)
        const notifs = org?.settings?.notificationUrls || [];
        for (const url of notifs) {
            try {
                await axios_1.default.post(url, { event: "document.upload", doc }, { timeout: 4000 });
            }
            catch (e) {
                // don't block main flow
                // eslint-disable-next-line no-console
                console.warn("Failed to notify endpoint", url, e?.message || e);
            }
        }
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Zoho onDocumentUpload error", err);
    }
}
async function onApproval(approval) {
    try {
        const org = await Organization_1.default.findById(approval.org);
        if (!org || !org.zoho?.enabled)
            return;
        const zohoAuth = await getZohoAuthForOrg(org);
        // Notify webhook
        if (org.zoho?.webhookUrl) {
            await axios_1.default.post(org.zoho.webhookUrl, { event: `approval.${approval.status}`, approval }, { timeout: 5000 });
        }
        // Send to any configured notification endpoints for this org
        const notifs = org?.settings?.notificationUrls || [];
        for (const url of notifs) {
            try {
                await axios_1.default.post(url, { event: `approval.${approval.status}`, approval }, { timeout: 4000 });
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.warn("Failed to notify endpoint", url, e?.message || e);
            }
        }
        // Could add Creator update or WorkDrive tagging here
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Zoho onApproval error", err);
    }
}
async function getZohoAuthForOrg(org) {
    // Priority:
    // 1. Env global token
    // 2. Org-level configured token
    // 3. Use a user's refresh token to obtain a new access token and store it
    const global = process.env.ZOHO_ACCESS_TOKEN;
    if (global)
        return { accessToken: global };
    // Prefer org-level stored tokens
    const orgToken = org?.zoho?.accessToken ||
        org?.zoho?.access_token ||
        org?.settings?.zohoAccessToken;
    if (orgToken)
        return { accessToken: orgToken };
    // find any user in this org with a refresh token
    const user = await User_1.default.findOne({
        org: org._id,
        zohoRefreshToken: { $exists: true },
    }).sort({ createdAt: 1 });
    if (!user || !user.zohoRefreshToken)
        throw new Error("Missing Zoho credentials for org");
    try {
        const refreshed = await ZohoOAuth.refreshToken(user.zohoRefreshToken);
        const accessToken = refreshed.access_token;
        const refreshToken = refreshed.refresh_token || user.zohoRefreshToken;
        user.zohoAccessToken = accessToken;
        user.zohoRefreshToken = refreshToken;
        await user.save();
        // persist at org-level so other users can reuse
        try {
            org.zoho = org.zoho || {};
            org.zoho.accessToken = accessToken;
            if (refreshToken)
                org.zoho.refreshToken = refreshToken;
            await org.save();
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.warn("Failed to persist zoho token at org level", e?.message || e);
        }
        return { accessToken };
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to refresh Zoho token for org", err);
        throw err;
    }
}
exports.default = { onDocumentUpload, onApproval };
