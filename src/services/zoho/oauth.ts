import axios from "axios";

const AUTH_DOMAIN = process.env.ZOHO_AUTH_DOMAIN || "accounts.zoho.com";
const CLIENT_ID = process.env.ZOHO_CLIENT_ID || "";
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.ZOHO_REDIRECT_URI || "";

export function getAuthUrl(state?: string) {
  const base = `https://${AUTH_DOMAIN}/oauth/v2/auth`;
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    scope: "AaaServer.profile.Read,ZohoCRM.modules.ALL",
    redirect_uri: REDIRECT_URI,
    access_type: "offline",
    prompt: "consent",
  });
  if (state) params.set("state", state);
  return `${base}?${params.toString()}`;
}

export async function exchangeCode(code: string) {
  const url = `https://${AUTH_DOMAIN}/oauth/v2/token`;
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    code,
  });
  const resp = await axios.post(url, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return resp.data; // contains access_token, refresh_token, expires_in, api_domain, etc.
}

export async function refreshToken(refreshToken: string) {
  const url = `https://${AUTH_DOMAIN}/oauth/v2/token`;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
  });
  const resp = await axios.post(url, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return resp.data; // contains access_token, expires_in, and possibly new refresh_token
}

export async function getUserInfo(accessToken: string) {
  // Use Authorization header (Zoho recommends "Zoho-oauthtoken <token>")
  // Some Zoho tenants may require a different auth domain; header-based request is more reliable than query param.
  const url = `https://${AUTH_DOMAIN}/oauth/user/info`;
  try {
    const resp = await axios.get(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    return resp.data; // structure varies; contains email, name, etc.
  } catch (err: any) {
    // try fallback: query param style (older endpoints)
    try {
      const fallback = `https://${AUTH_DOMAIN}/oauth/user/info?access_token=${encodeURIComponent(accessToken)}`;
      const resp2 = await axios.get(fallback);
      return resp2.data;
    } catch (err2) {
      // rethrow original error with fallback attached for debugging
      (err as any).fallback = err2;
      throw err;
    }
  }
}

export default { getAuthUrl, exchangeCode, getUserInfo };
