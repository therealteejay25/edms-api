// Placeholder service file to show how Zoho integrations can be added in the future.
// - On upload: trigger webhook to Zoho Flow or call Zoho Creator APIs to create records.
// - On approval: notify Zoho Cliq / Slack via webhook.
// - Replace local storage with Zoho WorkDrive API for file storage and folder structure.
// - Integrate Zoho Sign by creating a signing request and storing returned signed file as a new version.

import Organization from "../models/Organization";
import Document from "../models/Document";
import * as Creator from "./zoho/creator";
import * as WorkDrive from "./zoho/workdrive";
import * as Sign from "./zoho/sign";
import axios from "axios";
import User from "../models/User";
import * as ZohoOAuth from "./zoho/oauth";

export async function onDocumentUpload(doc: any) {
  // doc contains metadata, org, fileUrl, version, etc.
  try {
    const org = await Organization.findById(doc.org);
    if (!org || !org.zoho?.enabled) return;
    const zohoAuth = await getZohoAuthForOrg(org);
    // Create Creator record if configured
    if (org.zoho?.creatorFormId) {
      // creatorFormId expected format: {appName}/{formName}
      const [appName, formName] = org.zoho.creatorFormId.split("/");
      await Creator.createCreatorRecord(
        String(org.name),
        appName,
        formName,
        {
          title: doc.title,
          type: doc.type,
          department: doc.department,
          fileUrl: doc.fileUrl,
          version: doc.version,
        },
        zohoAuth
      );
    }
    // Optionally upload to WorkDrive
    if (org.zoho?.workdriveFolderId) {
      // In production we would stream the file; for MVP we can store a pointer or upload file buffer
      const filePath = doc.fileUrl.replace(/^\//, "");
      // Read file and upload
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require("fs");
      const fileStream = fs.createReadStream(filePath);
      const wdResp: any = await WorkDrive.uploadFile(
        org.zoho.workdriveFolderId,
        fileStream,
        filePath.split("/").pop(),
        zohoAuth
      );
      // If we receive a useful response from WorkDrive, attempt to persist file id/url and raw response on the Document
      try {
        const candidateId =
          wdResp?.data?.file_id ||
          wdResp?.file_id ||
          wdResp?.id ||
          wdResp?.data?.id ||
          wdResp?.data?.ID;
        const candidateUrl =
          wdResp?.data?.download_url ||
          wdResp?.download_url ||
          wdResp?.file_url ||
          wdResp?.data?.file_url ||
          wdResp?.data?.downloadUrl;
        await Document.findByIdAndUpdate(doc._id, {
          zohoFileId: candidateId,
          zohoFileUrl: candidateUrl,
          zohoRawResponse: wdResp,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("Failed to persist WorkDrive response to Document", e);
      }
    }
    // Trigger Zoho webhook if present
    if (org.zoho?.webhookUrl) {
      await axios.post(
        org.zoho.webhookUrl,
        { event: "document.upload", doc },
        { timeout: 5000 }
      );
    }
    // Send to any configured notification endpoints for this org (e.g., Slack, email webhook)
    const notifs: string[] = org?.settings?.notificationUrls || [];
    for (const url of notifs) {
      try {
        await axios.post(
          url,
          { event: "document.upload", doc },
          { timeout: 4000 }
        );
      } catch (e) {
        // don't block main flow
        // eslint-disable-next-line no-console
        console.warn("Failed to notify endpoint", url, (e as any)?.message || e);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Zoho onDocumentUpload error", err);
  }
}

export async function onApproval(approval: any) {
  try {
    const org = await Organization.findById(approval.org);
    if (!org || !org.zoho?.enabled) return;
    const zohoAuth = await getZohoAuthForOrg(org);
    // Notify webhook
    if (org.zoho?.webhookUrl) {
      await axios.post(
        org.zoho.webhookUrl,
        { event: `approval.${approval.status}`, approval },
        { timeout: 5000 }
      );
    }
    // Send to any configured notification endpoints for this org
    const notifs: string[] = org?.settings?.notificationUrls || [];
    for (const url of notifs) {
      try {
        await axios.post(
          url,
          { event: `approval.${approval.status}`, approval },
          { timeout: 4000 }
        );
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("Failed to notify endpoint", url, (e as any)?.message || e);
      }
    }
    // Could add Creator update or WorkDrive tagging here
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Zoho onApproval error", err);
  }
}

async function getZohoAuthForOrg(org: any) {
  // Priority:
  // 1. Env global token
  // 2. Org-level configured token
  // 3. Use a user's refresh token to obtain a new access token and store it
  const global = process.env.ZOHO_ACCESS_TOKEN;
  if (global) return { accessToken: global };

  // Prefer org-level stored tokens
  const orgToken =
    org?.zoho?.accessToken ||
    org?.zoho?.access_token ||
    org?.settings?.zohoAccessToken;
  if (orgToken) return { accessToken: orgToken };

  // find any user in this org with a refresh token
  const user = await User.findOne({
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
      if (refreshToken) org.zoho.refreshToken = refreshToken;
      await org.save();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        "Failed to persist zoho token at org level",
        (e as any)?.message || e
      );
    }
    return { accessToken };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to refresh Zoho token for org", err);
    throw err;
  }
}

export default { onDocumentUpload, onApproval };
