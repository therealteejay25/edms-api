"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFile = uploadFile;
const axios_1 = __importDefault(require("axios"));
const ZOHO_WORKDRIVE_BASE = "https://workdrive.zoho.com/api/v1";
async function uploadFile(folderId, fileStream, filename, auth) {
    // This is a placeholder example. In production you'd stream the file with multipart/form-data.
    const url = `${ZOHO_WORKDRIVE_BASE}/files?folder_id=${encodeURIComponent(folderId)}`;
    const res = await axios_1.default.post(url, fileStream, {
        headers: {
            Authorization: `Zoho-oauthtoken ${auth.accessToken}`,
            "Content-Type": "application/octet-stream",
            "X-FILENAME": filename,
        },
    });
    // Try to normalize the response so higher-level code can access ids and download links
    const data = res.data || {};
    const fileId = data?.data?.file_id || data?.file_id || data?.id || data?.data?.ID;
    const downloadUrl = data?.data?.download_url ||
        data?.download_url ||
        data?.file_url ||
        data?.data?.file_url;
    return { raw: data, file_id: fileId, download_url: downloadUrl };
}
exports.default = { uploadFile };
