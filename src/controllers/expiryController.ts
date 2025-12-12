import { Request, Response } from "express";
import Document from "../models/Document";
import User from "../models/User";
import AuditLog from "../models/AuditLog";

/**
 * Get documents expiring soon (within X days)
 */
export async function getExpiringDocuments(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const days = parseInt(req.query.days as string) || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);

    const expiring = await Document.find({
      org: user.org,
      expiryDate: { $lte: cutoffDate, $gte: new Date() },
      status: { $ne: "archived" },
    })
      .populate("owner", "name email")
      .sort({ expiryDate: 1 });

    res.json({ documents: expiring, count: expiring.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get expiring documents" });
  }
}

/**
 * Send expiry reminders (would integrate with email/notification service)
 */
export async function sendExpiryReminders(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const days = parseInt(req.body.days as string) || 30;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);

    const expiring = await Document.find({
      org: user.org,
      expiryDate: { $lte: cutoffDate, $gte: new Date() },
      status: { $ne: "archived" },
    }).populate("owner", "name email");

    // In production, this would send emails/notifications
    // For now, just return the list
    res.json({
      sent: expiring.length,
      documents: expiring.map((d) => ({
        id: d._id,
        title: d.title,
        expiryDate: d.expiryDate,
        owner: d.owner,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send reminders" });
  }
}

/**
 * Auto-archive expired documents
 */
export async function archiveExpiredDocuments(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const now = new Date();

    const result = await Document.updateMany(
      {
        org: user.org,
        expiryDate: { $lt: now },
        status: { $ne: "archived" },
        legalHold: false,
      },
      { status: "expired" }
    );

    await AuditLog.create({
      org: user.org,
      user: user._id,
      action: "bulk_archive_expired",
      resource: "document",
      resourceId: user._id,
      changes: { archivedCount: result.modifiedCount },
    });

    res.json({
      archived: result.modifiedCount,
      message: `Archived ${result.modifiedCount} expired documents`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to archive expired documents" });
  }
}







