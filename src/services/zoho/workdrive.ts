import axios from "axios";

const ZOHO_WORKDRIVE_BASE = "https://workdrive.zoho.com/api/v1";

export interface ZohoAuth {
  accessToken: string;
}

export async function uploadFile(
  folderId: string,
  fileStream: any,
  filename: string,
  auth: ZohoAuth
) {
  // This is a placeholder example. In production you'd stream the file with multipart/form-data.
  const url = `${ZOHO_WORKDRIVE_BASE}/files?folder_id=${encodeURIComponent(
    folderId
  )}`;
  const res = await axios.post(url, fileStream, {
    headers: {
      Authorization: `Zoho-oauthtoken ${auth.accessToken}`,
      "Content-Type": "application/octet-stream",
      "X-FILENAME": filename,
    },
  });
  return res.data;
}

export default { uploadFile };
