import { Request, Response } from "express";
import User from "../models/User";

export async function listUsers(req: Request, res: Response) {
  try {
    // @ts-ignore
    const user = req.user;
    const users = await User.find({ org: user.org }).select(
      "name email role department zohoId"
    );
    res.json({ data: users });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Failed to list users" });
  }
}

export async function updateUserRole(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { role } = req.body as { role?: string };
    if (!role || (role !== "admin" && role !== "user"))
      return res.status(400).json({ message: "Invalid role" });
    // @ts-ignore
    const user = req.user;
    const target = await User.findById(id);
    if (!target) return res.status(404).json({ message: "Not found" });
    if (String(target.org) !== String(user.org))
      return res.status(403).json({ message: "Forbidden" });
    target.role = role as any;
    await target.save();
    res.json({ ok: true, user: { id: target._id, role: target.role } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ message: "Failed to update role" });
  }
}

export default { listUsers, updateUserRole };
