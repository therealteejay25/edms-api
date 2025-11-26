import axios from "axios";

const ZOHO_SIGN_BASE = "https://sign.zoho.com/api/v1";

export interface ZohoAuth {
  accessToken: string;
}

export async function createSignRequest(
  templateId: string,
  recipients: any[],
  auth: ZohoAuth
) {
  const url = `${ZOHO_SIGN_BASE}/requests`;
  const body = { template_id: templateId, recipients };
  const res = await axios.post(url, body, {
    headers: { Authorization: `Zoho-oauthtoken ${auth.accessToken}` },
  });
  return res.data;
}

export default { createSignRequest };
