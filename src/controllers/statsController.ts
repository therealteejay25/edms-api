import { Request, Response } from "express";
import Document from "../models/Document";
import Approval from "../models/Approval";
import User from "../models/User";
import { ObjectId } from "mongoose";

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const org = user.org;

    const [
      totalDocuments,
      activeDocuments,
      pendingApprovals,
      expiringSoon,
      recentActivity,
    ] = await Promise.all([
      Document.countDocuments({ org }),
      Document.countDocuments({ org, status: "active" }),
      Approval.countDocuments({ org, status: "pending" }),
      Document.countDocuments({
        org,
        expiryDate: {
          $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          $gte: new Date(),
        },
        status: { $ne: "archived" },
      }),
      Document.countDocuments({
        org,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    res.json({
      totalDocuments,
      activeDocuments,
      pendingApprovals,
      expiringSoon,
      recentActivity,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get stats" });
  }
}







