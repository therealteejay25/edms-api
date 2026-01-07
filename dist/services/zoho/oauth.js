"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthUrl = getAuthUrl;
exports.exchangeCode = exchangeCode;
exports.refreshToken = refreshToken;
exports.getUserInfo = getUserInfo;
const axios_1 = __importDefault(require("axios"));
const AUTH_DOMAIN = process.env.ZOHO_AUTH_DOMAIN || "accounts.zoho.com";
const CLIENT_ID = process.env.ZOHO_CLIENT_ID || "";
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.ZOHO_REDIRECT_URI || "";
function getAuthUrl(state) {
    const base = `https://${AUTH_DOMAIN}/oauth/v2/auth`;
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "code",
        scope: "AaaServer.profile.Read,ZohoCRM.modules.ALL",
        redirect_uri: REDIRECT_URI,
        access_type: "offline",
        prompt: "consent",
    });
    if (state)
        params.set("state", state);
    return `${base}?${params.toString()}`;
}
async function exchangeCode(code) {
    const url = `https://${AUTH_DOMAIN}/oauth/v2/token`;
    const params = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
    });
    const resp = await axios_1.default.post(url, params.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return resp.data; // contains access_token, refresh_token, expires_in, api_domain, etc.
}
async function refreshToken(refreshToken) {
    const url = `https://${AUTH_DOMAIN}/oauth/v2/token`;
    const params = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
    });
    const resp = await axios_1.default.post(url, params.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return resp.data; // contains access_token, expires_in, and possibly new refresh_token
}
async function getUserInfo(accessToken) {
    // Use Authorization header (Zoho recommends "Zoho-oauthtoken <token>")
    // Some Zoho tenants may require a different auth domain; header-based request is more reliable than query param.
    const url = `https://${AUTH_DOMAIN}/oauth/user/info`;
    try {
        const resp = await axios_1.default.get(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
        return resp.data; // structure varies; contains email, name, etc.
    }
    catch (err) {
        // try fallback: query param style (older endpoints)
        try {
            const fallback = `https://${AUTH_DOMAIN}/oauth/user/info?access_token=${encodeURIComponent(accessToken)}`;
            const resp2 = await axios_1.default.get(fallback);
            return resp2.data;
        }
        catch (err2) {
            // rethrow original error with fallback attached for debugging
            err.fallback = err2;
            throw err;
        }
    }
}
exports.default = { getAuthUrl, exchangeCode, getUserInfo };
