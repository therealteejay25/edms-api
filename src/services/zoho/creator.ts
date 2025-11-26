import axios from "axios";

const ZOHO_BASE = "https://creator.zoho.com/api/v2";

export interface ZohoAuth {
  accessToken: string;
}

export async function createCreatorRecord(
  orgName: string,
  appName: string,
  formName: string,
  record: any,
  auth: ZohoAuth
) {
  // Example: POST /{ownerName}/{appName}/form/{formLinkName}
  const url = `${ZOHO_BASE}/${encodeURIComponent(orgName)}/${encodeURIComponent(
    appName
  )}/form/${encodeURIComponent(formName)}`;
  const res = await axios.post(
    url,
    { data: record },
    { headers: { Authorization: `Zoho-oauthtoken ${auth.accessToken}` } }
  );
  return res.data;
}

export default { createCreatorRecord };
