import path from "path";
import fs from "fs/promises";
import multer from "multer";
import { Request } from "express";

function ensureDir(dir: string) {
  return fs.mkdir(dir, { recursive: true }).catch(() => {});
}

export const storage = multer.diskStorage({
  destination: async (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, destination?: string) => void
  ) => {
    // Prefer org in body, fallback to req.user.org if available
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const org = req.body.org || (req.user && req.user.org) || "public";
    const department = req.body.department || "general";
    const type = req.body.type || "misc";
    const dest = path.join(
      process.cwd(),
      "uploads",
      String(org),
      department,
      type
    );
    await ensureDir(dest);
    cb(null, dest);
  },
  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename?: string) => void
  ) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${
      file.originalname
    }`;
    cb(null, unique);
  },
});

export const upload = multer({ storage });

export async function moveFile(currentPath: string, destDir: string) {
  await ensureDir(destDir);
  const fileName = path.basename(currentPath);
  const newPath = path.join(destDir, fileName);
  await fs.rename(currentPath, newPath);
  return newPath;
}
